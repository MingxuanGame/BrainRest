import type { TriggerBaselineMap } from "./types";

/** 触发路径基调表：按 A/B/C 给出休息主基调 */
export const triggerBaseline: TriggerBaselineMap = {
    A: {
        label: "持续高认知负荷",
        fatigue: "cognitive",
        durationMin: [10, 15],
        coreActivities: ["离屏散步", "远眺窗外/自然", "闭眼放松"],
        avoid: ["刷手机", "看信息流", "继续处理信息"],
        rationale: "前额叶谷氨酸累积，需认知脱离与定向注意力恢复(ART)",
    },
    B: {
        label: "累积等效负荷",
        fatigue: "cognitive_accumulated",
        durationMin: [5, 8],
        coreActivities: ["起身走动", "喝水", "深呼吸"],
        avoid: ["久坐不动"],
        rationale: "长时间温和累积，微休息即可显著恢复活力",
    },
    C: {
        label: "神经肌肉/眼疲劳",
        fatigue: "physical",
        durationMin: [3, 5],
        coreActivities: ["肩颈手腕拉伸", "20-20-20 护眼", "起身活动"],
        avoid: ["保持同一姿势"],
        rationale: "眼-手协调下降、轨迹变乱，需缓解睫状肌与肌肉疲劳",
    },
};
