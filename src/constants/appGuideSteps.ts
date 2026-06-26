export type AppGuideTapItem = {
  button: string;
  does: string;
};

export type AppGuideStep = {
  id: string;
  title: string;
  content: string;
  button: string;
  tapPrompt: string;
};

/** Five-step guide — same flow as the web spotlight tour, for native modal replay. */
export const APP_GUIDE_STEPS: AppGuideStep[] = [
  {
    id: 'start-today',
    title: 'Start Today',
    content:
      'Ready to train? This is your main action on the Dashboard — jump straight into today\'s workout.',
    button: 'START TODAY',
    tapPrompt: 'On the Dashboard, tap START TODAY.',
  },
  {
    id: 'log-food',
    title: 'Log Food',
    content:
      'Track meals and macros in one tap. Use this tile whenever you need to log breakfast, lunch, dinner, or snacks.',
    button: 'Log Food',
    tapPrompt: 'On the Dashboard, tap the Log Food tile.',
  },
  {
    id: 'tab-workouts',
    title: 'Workouts',
    content:
      'Plans, AI builder, session history, and logging past workouts all live under the Workouts tab.',
    button: 'Workouts tab',
    tapPrompt: 'Tap Workouts in the bottom tab bar.',
  },
  {
    id: 'tab-nutrition',
    title: 'Nutrition',
    content:
      'Your full food log, barcode scan, and USDA search open from the Nutrition tab.',
    button: 'Nutrition tab',
    tapPrompt: 'Tap Nutrition in the bottom tab bar.',
  },
  {
    id: 'tab-more',
    title: 'Settings & Tools',
    content:
      'More is your hub for Settings, Health trends, and replaying this guide anytime via App guide.',
    button: 'More tab',
    tapPrompt: 'Tap More in the bottom tab bar when you need settings or extra tools.',
  },
];
