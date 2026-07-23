import { calculateDeleteKeyRatio } from "./KeyboardAnalyzer";
import { calcuateMouseAnthropy, calculateEyeHandDelay } from "./MouseTrackAnalyzer";
import { calculateSwitchEntropy } from "./SwitchEntropyAnalyzer";

const MAX_EYE_HAND_DELAY_MS = 2000;

export interface InteractionScores {
  /** Mouse direction entropy, scaled from [0, 1] to [0, 100]. */
  mouseEntropy: number;
  /** Eye-hand dwell delay in milliseconds, scaled from [0, 2000] to [0, 100]. */
  eyeHandDelay: number | null;
  /** Backspace/Delete ratio, scaled from [0, 1] to [0, 100]. */
  deleteKeyRatio: number;
  /** Cross-category tab/window switch entropy, scaled from [0, 1] to [0, 100]. */
  switchEntropy: number;
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
  };
}
