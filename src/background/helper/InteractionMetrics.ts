import { calculateDeleteKeyRatio } from "./KeyboardAnalyzer";
import { calcuateMouseAnthropy, calculateEyeHandDelay } from "./MouseTrackAnalyzer";
import { calculateSwitchEntropy } from "./SwitchEntropyAnalyzer";
import { calculateEventFrequency } from "./EventFrequencyAnalyzer";

const MAX_EYE_HAND_DELAY_MS = 2000;
// 归一化基准：达到该每秒事件数即视为满负荷（100）
const MAX_EVENTS_PER_SEC = 20;

export interface InteractionScores {
  /** Mouse direction entropy, scaled from [0, 1] to [0, 100]. */
  mouseEntropy: number;
  /** Eye-hand dwell delay in milliseconds, scaled from [0, 2000] to [0, 100]. */
  eyeHandDelay: number | null;
  /** Backspace/Delete ratio, scaled from [0, 1] to [0, 100]. */
  deleteKeyRatio: number;
  /** Cross-category tab/window switch entropy, scaled from [0, 1] to [0, 100]. */
  switchEntropy: number;
  /** Per-second event frequency, scaled from [0, MAX_EVENTS_PER_SEC] to [0, 100]. */
  eventFrequency: number;
}

function scaleTo100(value: number, maximum: number): number {
  return Math.round(Math.min(Math.max(value / maximum, 0), 1) * 100);
}

/** Returns all interaction metrics in a consistent 0-100 range. */
export async function calculateInteractionScores(): Promise<InteractionScores> {
  const eyeHandDelay = calculateEyeHandDelay();
  const switchEntropy = await calculateSwitchEntropy();

  return {
    mouseEntropy: scaleTo100(calcuateMouseAnthropy(), 1),
    eyeHandDelay: eyeHandDelay === null ? null : scaleTo100(eyeHandDelay, MAX_EYE_HAND_DELAY_MS),
    deleteKeyRatio: scaleTo100(calculateDeleteKeyRatio(), 1),
    switchEntropy: scaleTo100(switchEntropy, 1),
    eventFrequency: scaleTo100(calculateEventFrequency(), MAX_EVENTS_PER_SEC),
  };
}
