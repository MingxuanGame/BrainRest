import { queue } from "./EventQueue";
import type { Event } from "../models/events/Event";
import type { FullscreenChange } from "../models/events/FullscreenChange";
import { calculateTabSwitchCount } from "./helper/TabSwitchAnalyzer";
import { calcuateMouseAnthropy, calculateEyeHandDelay } from "./helper/MouseTrackAnalyzer";
import { calculateEventFrequency } from "./helper/EventFrequencyAnalyzer";

/* ------------------------------------------------------------------ */
/* 常量                                                               */
/* ------------------------------------------------------------------ */

/** dispatch 计算周期（ms）。需 < 滑动窗口时长，避免漏采活跃度状态 */
const TICK_MS = 1000;

/** 归一化基准：T 每次切换记 25 分，4 次即满分 100 */
const TAB_SWITCH_UNIT = 25;
/** 归一化基准：D 眼-手延迟每 5ms 记 1 分，500ms 即满分 100 */
const EYE_HAND_DELAY_UNIT = 5;
/** 归一化基准：I 交互频率每 eps 记 10 分，10eps 即满分 100 */
const EVENT_FREQ_UNIT = 10;

/** 自学习学习率 */
const LEARNING_RATE = 0.05;
/** 上一次疲劳值的记忆衰减系数 λ（提供迟滞，避免瞬时波动导致抖动） */
const PREV_FATIGUE_DECAY = 0.5;

/** 触发阈值（对应加权原始分 0-100） */
const THRESHOLD = {
  mild: 60,
  moderate: 75,
  severe: 90,
} as const;

/** 休息权重 R（0-100），越高代表用户越处于"被动/休息"状态，越不该判为疲劳 */
const REST_WEIGHT = {
  normal: 0,
  videoFullscreen: 30,
  mouseIdle: 40,
  windowBlur: 50,
  deviceLocked: 80,
} as const;

/** 判定"鼠标静止"的时长阈值 */
const MOUSE_IDLE_MS = 20_000;
/** 判定"窗口失焦"的时长阈值 */
const WINDOW_BLUR_MS = 30_000;

/** 已触发提示后再次触发的冷却时间 */
const REFIRE_COOLDOWN_MS = 60_000;

/** 权重持久化存储键 */
const WEIGHTS_STORAGE_KEY = "brainrest_fatigue_weights";

/** 归入"用户主动交互"的事件类型（用于鼠标/键盘活跃度判定） */
const INTERACTION_TYPES = new Set<string>([
  "click",
  "mousemove",
  "scroll",
  "keydown",
  "keyup",
  "touchstart",
  "touchmove",
  "touchend",
]);

/* ------------------------------------------------------------------ */
/* 类型                                                               */
/* ------------------------------------------------------------------ */

export type FatigueLevel = "none" | "mild" | "moderate" | "severe";

const LEVEL_RANK: Record<FatigueLevel, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

/** 四项归一化指标（均为 0-100） */
export interface FatigueMetrics {
  /** T 标签页乱跳 */
  tabSwitch: number;
  /** E 鼠标轨迹熵 */
  mouseEntropy: number;
  /** D 眼-手延迟 */
  eyeHandDelay: number;
  /** I 交互频率 */
  eventFrequency: number;
}

/** 各指标对应的权重（和为 1） */
export interface FatigueWeights {
  tabSwitch: number;
  mouseEntropy: number;
  eyeHandDelay: number;
  eventFrequency: number;
}

/** 一次 dispatch 的完整结果 */
export interface FatigueResult {
  metrics: FatigueMetrics;
  weights: FatigueWeights;
  /** 加权原始分 wT·T + wE·E + wD·D + wI·I（0-100） */
  weightedScore: number;
  /** 休息权重 R（0-100） */
  restWeight: number;
  /** 最终疲劳指数 F（0-100） */
  fatigue: number;
  level: FatigueLevel;
  timestamp: number;
}

type TriggerListener = (result: FatigueResult) => void;

/* ------------------------------------------------------------------ */
/* 工具函数                                                           */
/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isInteraction(event: Event): boolean {
  return INTERACTION_TYPES.has(event.type);
}

function levelOf(fatigue: number): FatigueLevel {
  if (fatigue >= THRESHOLD.severe) return "severe";
  if (fatigue >= THRESHOLD.moderate) return "moderate";
  if (fatigue >= THRESHOLD.mild) return "mild";
  return "none";
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                         */
/* ------------------------------------------------------------------ */

class RuleEventDispatcher {
  private static instance: RuleEventDispatcher | null = null;

  /** 各指标权重，初始等权，和为 1 */
  private weights: FatigueWeights = {
    tabSwitch: 0.25,
    mouseEntropy: 0.25,
    eyeHandDelay: 0.25,
    eventFrequency: 0.25,
  };

  /** 上一周期的疲劳值 F_prev */
  private prevFatigue = 0;

  /** 最近一次计算结果 */
  private lastResult: FatigueResult | null = null;

  /** 触发提示时的指标快照（用于自学习） */
  private lastTriggerMetrics: FatigueMetrics | null = null;

  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<TriggerListener>();

  /* --- 活跃度 / 休息状态（跨滑动窗口维护） --- */
  private lastActivityAt = Date.now();
  private isFocused = true;
  private lastBlurAt: number | null = null;
  private videoFullscreen = false;
  private deviceLocked = false;

  /* --- 触发去抖 --- */
  private lastFiredRank = 0;
  private lastFiredAt = 0;

  private constructor() {
    void this.loadWeights();
  }

  static getInstance(): RuleEventDispatcher {
    if (!RuleEventDispatcher.instance) {
      RuleEventDispatcher.instance = new RuleEventDispatcher();
    }
    return RuleEventDispatcher.instance;
  }

  /* ---------------------------------------------------------------- */
  /* 生命周期                                                         */
  /* ---------------------------------------------------------------- */

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick();
    }, TICK_MS);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  /* ---------------------------------------------------------------- */
  /* 外部可注入的休息状态（锁屏由 IdleListener 通过 chrome.idle 写入） */
  /* ---------------------------------------------------------------- */

  setVideoFullscreen(active: boolean): void {
    this.videoFullscreen = active;
  }

  setDeviceLocked(locked: boolean): void {
    this.deviceLocked = locked;
  }

  /* ---------------------------------------------------------------- */
  /* 订阅触发事件                                                     */
  /* ---------------------------------------------------------------- */

  onTrigger(listener: TriggerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getLastResult(): FatigueResult | null {
    return this.lastResult;
  }

  getWeights(): FatigueWeights {
    return { ...this.weights };
  }

  /* ---------------------------------------------------------------- */
  /* 核心：对滑动窗口事件做一次 dispatch 并算出疲劳指数               */
  /* ---------------------------------------------------------------- */

  private tick(): FatigueResult {
    const events = queue.getEvents();
    this.updateActivityState(events);

    const metrics = this.computeMetrics();
    const restWeight = this.computeRestWeight();

    const weightedScore =
      this.weights.tabSwitch * metrics.tabSwitch +
      this.weights.mouseEntropy * metrics.mouseEntropy +
      this.weights.eyeHandDelay * metrics.eyeHandDelay +
      this.weights.eventFrequency * metrics.eventFrequency;

    // F = 加权分 × (1 - R/100) + F_prev × λ，钳制到 [0, 100]
    const fatigue = clamp(
      weightedScore * (1 - restWeight / 100) + this.prevFatigue * PREV_FATIGUE_DECAY,
      0,
      100,
    );
    this.prevFatigue = fatigue;

    const result: FatigueResult = {
      metrics,
      weights: { ...this.weights },
      weightedScore,
      restWeight,
      fatigue,
      level: levelOf(fatigue),
      timestamp: Date.now(),
    };
    this.lastResult = result;

    this.maybeFire(result);
    return result;
  }

  /* ---------------------------------------------------------------- */
  /* 指标归一化（均映射到 0-100）                                     */
  /* ---------------------------------------------------------------- */

  private computeMetrics(): FatigueMetrics {
    // T：切换次数 × 25，封顶 100
    const tabSwitch = clamp(calculateTabSwitchCount() * TAB_SWITCH_UNIT, 0, 100);

    // E：熵值 × 100
    const mouseEntropy = clamp(calcuateMouseAnthropy() * 100, 0, 100);

    // D：延迟 / 5，封顶 100；无有效点击时视为 0
    const delayMs = calculateEyeHandDelay();
    const eyeHandDelay =
      delayMs === null ? 0 : clamp(delayMs / EYE_HAND_DELAY_UNIT, 0, 100);

    // I：事件数/秒 × 10，封顶 100
    const eventFrequency = clamp(
      calculateEventFrequency() * EVENT_FREQ_UNIT,
      0,
      100,
    );

    return { tabSwitch, mouseEntropy, eyeHandDelay, eventFrequency };
  }

  /* ---------------------------------------------------------------- */
  /* 休息权重 R：取所有命中场景中的最大值                             */
  /* ---------------------------------------------------------------- */

  private computeRestWeight(): number {
    if (this.deviceLocked) return REST_WEIGHT.deviceLocked;

    const now = Date.now();
    let rest: number = REST_WEIGHT.normal;

    if (
      !this.isFocused &&
      this.lastBlurAt !== null &&
      now - this.lastBlurAt > WINDOW_BLUR_MS
    ) {
      rest = Math.max(rest, REST_WEIGHT.windowBlur);
    }

    if (now - this.lastActivityAt > MOUSE_IDLE_MS) {
      rest = Math.max(rest, REST_WEIGHT.mouseIdle);
    }

    if (this.videoFullscreen) {
      rest = Math.max(rest, REST_WEIGHT.videoFullscreen);
    }

    return rest;
  }

  /**
   * 根据窗口内事件刷新跨窗口维护的活跃度 / 焦点 / 全屏状态。
   * 相关状态保存在实例上，因此即使事件已滑出窗口仍然有效。
   */
  private updateActivityState(events: Event[]): void {
    let latestInteractionAt = -1;
    const focusEvents: Event[] = [];
    const fullscreenEvents: Event[] = [];

    for (const event of events) {
      if (isInteraction(event)) {
        if (event.timestamp > latestInteractionAt) {
          latestInteractionAt = event.timestamp;
        }
      } else if (event.type === "focus" || event.type === "blur") {
        focusEvents.push(event);
      } else if (event.type === "fullscreen_change") {
        fullscreenEvents.push(event);
      }
    }

    if (latestInteractionAt > this.lastActivityAt) {
      this.lastActivityAt = latestInteractionAt;
    }

    // 应用窗口内最新的一次焦点变化
    focusEvents.sort((a, b) => a.timestamp - b.timestamp);
    const latestFocus = focusEvents.at(-1);
    if (latestFocus) {
      if (latestFocus.type === "blur") {
        this.isFocused = false;
        this.lastBlurAt = latestFocus.timestamp;
      } else {
        this.isFocused = true;
        this.lastBlurAt = null;
      }
    }

    // 应用窗口内最新的一次全屏状态变化
    fullscreenEvents.sort((a, b) => a.timestamp - b.timestamp);
    const latestFullscreen = fullscreenEvents.at(-1) as FullscreenChange | undefined;
    if (latestFullscreen) {
      this.videoFullscreen = latestFullscreen.active;
    }
  }

  /* ---------------------------------------------------------------- */
  /* 触发去抖：等级抬升或冷却结束后再次触发                           */
  /* ---------------------------------------------------------------- */

  private maybeFire(result: FatigueResult): void {
    const rank = LEVEL_RANK[result.level];

    if (rank === 0) {
      this.lastFiredRank = 0;
      return;
    }

    const now = result.timestamp;
    const escalated = rank > this.lastFiredRank;
    const cooledDown = now - this.lastFiredAt > REFIRE_COOLDOWN_MS;
    if (!escalated && !cooledDown) return;

    this.lastFiredRank = rank;
    this.lastFiredAt = now;
    this.lastTriggerMetrics = result.metrics;

    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch {
        // 单个订阅者异常不影响其它订阅者
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* 自学习：根据用户反馈调整权重                                     */
  /*   r = +1（认同累了）：w_i += lr · (v_i/100) · (1 - w_i)          */
  /*   r = -1（拒绝）：    w_i -= lr · (v_i/100) · w_i                */
  /*   最后：w_i ← w_i / Σw_j                                         */
  /* ---------------------------------------------------------------- */

  recordFeedback(agree: boolean): void {
    const snapshot = this.lastTriggerMetrics ?? this.lastResult?.metrics;
    if (!snapshot) return;

    const keys: (keyof FatigueWeights & keyof FatigueMetrics)[] = [
      "tabSwitch",
      "mouseEntropy",
      "eyeHandDelay",
      "eventFrequency",
    ];

    for (const key of keys) {
      const v = snapshot[key] / 100; // 归一化到 0-1
      const w = this.weights[key];
      this.weights[key] = agree
        ? w + LEARNING_RATE * v * (1 - w)
        : w - LEARNING_RATE * v * w;
    }

    this.normalizeWeights();
    void this.saveWeights();
  }

  private normalizeWeights(): void {
    const sum =
      this.weights.tabSwitch +
      this.weights.mouseEntropy +
      this.weights.eyeHandDelay +
      this.weights.eventFrequency;
    if (sum <= 0) return;

    this.weights.tabSwitch /= sum;
    this.weights.mouseEntropy /= sum;
    this.weights.eyeHandDelay /= sum;
    this.weights.eventFrequency /= sum;
  }

  /* ---------------------------------------------------------------- */
  /* 权重持久化                                                       */
  /* ---------------------------------------------------------------- */

  private async loadWeights(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(WEIGHTS_STORAGE_KEY);
      const saved = stored[WEIGHTS_STORAGE_KEY] as Partial<FatigueWeights> | undefined;
      if (saved) {
        this.weights = { ...this.weights, ...saved };
        this.normalizeWeights();
      }
    } catch {
      // 读取失败时保持等权初始值
    }
  }

  private async saveWeights(): Promise<void> {
    try {
      await chrome.storage.local.set({ [WEIGHTS_STORAGE_KEY]: this.weights });
    } catch {
      // 写入失败不影响运行时权重
    }
  }
}

/** 全局唯一实例 */
export const dispatcher = RuleEventDispatcher.getInstance();

export default dispatcher;
