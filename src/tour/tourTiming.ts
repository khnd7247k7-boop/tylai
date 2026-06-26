/** Wait for navigation / layout after the user taps a tour target. */
export const TOUR_POST_CLICK_SETTLE_MS = 650;

/** Default delay inside step prepare hooks. */
export const TOUR_STEP_PREPARE_MS = 420;

/** Extra settle time after opening a full-screen modal (Log Food, etc.). */
export const TOUR_MODAL_SETTLE_MS = 780;

/** After scrolling a target into view inside a scroll view. */
export const TOUR_SCROLL_SETTLE_MS = 320;

export async function tourPause(ms = TOUR_STEP_PREPARE_MS): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
