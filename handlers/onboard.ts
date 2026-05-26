import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { SRS_DEFAULT } from "../lib/srs";
import { todayISO } from "../lib/utils";

export async function handleOnboard(
  args: any,
  data: RunInput["data"],
  _settings: Settings
) {
  const targetLang = args.target_language;
  const nativeLang = args.native_language ?? "ko";

  const profile = {
    goal: args.goal,
    target_language: targetLang,
    native_language: nativeLang,
    level: args.level ?? "intermediate",
    contexts: args.contexts ?? [],
    tone_preference: args.tone_preference ?? "both",
    known_weaknesses: args.known_weaknesses ?? "",
    created_at: todayISO(),
  };
  await data.set("profile:current", profile);

  // ⚠️ 온보딩이 user_settings 도 초기화 — 그래야 플랫폼 user_settings UI 에
  // "사용자 선택" 으로 값이 박혀 보임. 안 그러면 평생 manifest default 만 보임.
  // response_language_mode / daily_review_target / srs_intervals 은 인터뷰 안 묻고
  // sensible default 로 적재 (사용자가 나중에 update_user_settings 로 자유 변경).
  const initSettings = {
    default_target_language: targetLang,
    native_language: nativeLang,
    response_language_mode: args.response_language_mode ?? "target_only",
    daily_review_target: args.daily_review_target ?? 20,
    srs_intervals: args.srs_intervals ?? SRS_DEFAULT.map(String),
  };
  await data.set("__settings", initSettings);

  // Reread to construct languageReminder with the just-saved settings.
  const newSettings: Settings = {
    ...initSettings,
    response_language_mode: initSettings.response_language_mode as Settings["response_language_mode"],
    srs_intervals: initSettings.srs_intervals.map((x: any) => parseInt(x, 10)),
  };

  return {
    message: `프로파일 저장 완료. 목표: "${profile.goal}" / 언어: ${profile.target_language}. 이제 첨삭하거나 카드를 추가할 수 있습니다.`,
    profile,
    settings: initSettings,
    instruction_to_caller: languageReminder(newSettings, profile.target_language),
  };
}
