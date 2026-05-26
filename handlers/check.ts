import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { nextReviewDate } from "../lib/srs";
import { uid, todayISO, normalizeKey } from "../lib/utils";

export async function handleCheckText(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const targetLang = args.target_language ?? settings.default_target_language;
  const errors = (args.errors ?? []) as any[];

  // Match each error against existing card pool to find duplicates
  const existing = await data.list("card:");
  const matched = errors.map((e) => {
    const key = normalizeKey(e.original);
    const dup = existing.find((row) => {
      const v = row.value as any;
      return (
        v && normalizeKey(v.front) === key && v.target_language === targetLang
      );
    });
    return {
      ...e,
      duplicate_of: dup ? (dup.value as any).id : null,
      previous_count: dup ? (dup.value as any).count ?? 1 : 0,
    };
  });

  // Save the check session so we can reference it later for defense
  const sessionId = uid();
  await data.set(`session:${sessionId}`, {
    id: sessionId,
    original_text: args.original_text,
    polished_version: args.polished_version,
    errors: matched,
    target_language: targetLang,
    created_at: todayISO(),
  });

  return {
    session_id: sessionId,
    errors: matched,
    polished_version: args.polished_version,
    summary: `${matched.length}개 항목 발견 (${matched.filter((m) => m.duplicate_of).length}개는 반복 패턴).`,
    instruction_to_caller:
      languageReminder(settings, targetLang) +
      " 사용자에게 각 항목을 보여주고 인정/변명 옵션을 제시하세요.",
  };
}

export async function handleSaveCorrection(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const targetLang = args.target_language;
  const front = args.original;
  const back = args.corrected;
  const key = normalizeKey(front);

  // Find existing card with same front + language
  const existing = await data.list("card:");
  const dup = existing.find((row) => {
    const v = row.value as any;
    return v && normalizeKey(v.front) === key && v.target_language === targetLang;
  });

  if (dup) {
    const v = dup.value as any;
    v.count = (v.count ?? 1) + 1;
    v.last_seen = todayISO();
    v.back = back;
    v.rule_or_reason = args.rule_or_reason ?? v.rule_or_reason;
    await data.set(dup.key, v);
    return {
      action: "incremented",
      card_id: v.id,
      count: v.count,
      instruction_to_caller: languageReminder(settings, targetLang),
    };
  }

  // Infer card_type from category if not provided
  let cardType = "grammar";
  if (args.category === "vocab" || args.category === "awkward") cardType = "vocab";
  if (args.cloze_format)
    cardType = args.category === "vocab" ? "vocab" : "phrase";

  const card = {
    id: uid(),
    front,
    back,
    card_type: cardType,
    category: args.category,
    rule_or_reason: args.rule_or_reason ?? "",
    example_sentence: args.example_sentence ?? "",
    cloze_format: args.cloze_format ?? "",
    target_language: targetLang,
    tags: args.tags ?? [],
    count: 1,
    level: 0,
    created_at: todayISO(),
    last_seen: todayISO(),
    next_review: nextReviewDate(0, settings.srs_intervals),
    defense_log: [],
  };

  await data.set(`card:${targetLang}:${card.id}`, card);
  return {
    action: "created",
    card,
    instruction_to_caller: languageReminder(settings, targetLang),
  };
}
