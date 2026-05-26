import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { todayISO } from "../lib/utils";

export async function handleOnboard(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const profile = {
    goal: args.goal,
    target_language: args.target_language,
    native_language: args.native_language ?? settings.native_language,
    level: args.level ?? "intermediate",
    contexts: args.contexts ?? [],
    tone_preference: args.tone_preference ?? "both",
    known_weaknesses: args.known_weaknesses ?? "",
    created_at: todayISO(),
  };
  await data.set("profile:current", profile);

  return {
    message: `프로파일 저장 완료. 목표: "${profile.goal}" / 언어: ${profile.target_language}. 이제 첨삭하거나 카드를 추가할 수 있습니다.`,
    profile,
    instruction_to_caller: languageReminder(settings, profile.target_language),
  };
}
