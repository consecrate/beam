export type Settings = typeof DEFAULT_SETTINGS;

export const DEFAULT_SETTINGS = {
  targetLang: "de",
  nativeLang: "en",
  dailyGoal: 20,
  autoKnownOnPageTurn: true,
  hoverTranslations: true,
  showGenderColors: true,
  ttsRate: 0.9,
  ttsVoice: undefined as string | undefined,
  fontSize: 21,
  theme: "system" as "system" | "light" | "dark",
};
