import type { RunInput } from "../index";
import { SRS_DEFAULT } from "./srs";

export type Settings = {
  default_target_language: string;
  native_language: string;
  response_language_mode: "target_only" | "native_only" | "mixed" | "auto";
  daily_review_target: number;
  srs_intervals: number[];
};

export async function readSettings(data: RunInput["data"]): Promise<Settings> {
  const s = ((await data.get("__settings")) as any) ?? {};
  return {
    default_target_language: s.default_target_language ?? "en",
    native_language: s.native_language ?? "ko",
    response_language_mode: s.response_language_mode ?? "target_only",
    daily_review_target: s.daily_review_target ?? 20,
    srs_intervals: (s.srs_intervals ?? SRS_DEFAULT.map(String)).map((x: any) =>
      parseInt(x, 10)
    ),
  };
}

export function languageReminder(settings: Settings, targetLang: string): string {
  switch (settings.response_language_mode) {
    case "target_only":
      return `INSTRUCTION_TO_CALLER: Respond to the user in ${targetLang} only. If the user explicitly requests an explanation in ${settings.native_language}, then switch.`;
    case "native_only":
      return `INSTRUCTION_TO_CALLER: Respond in ${settings.native_language}.`;
    case "mixed":
      return `INSTRUCTION_TO_CALLER: Examples in ${targetLang}; explanations in ${settings.native_language}.`;
    default:
      return `INSTRUCTION_TO_CALLER: Match the user's last message language.`;
  }
}
