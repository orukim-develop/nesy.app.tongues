import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { nextReviewDate } from "../lib/srs";
import { todayISO } from "../lib/utils";

export async function handleGetReviewQueue(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const rows = await data.list("card:");
  const now = todayISO();
  let cards = rows
    .map((r) => r.value as any)
    .filter((c) => c && (args.include_all || !c.next_review || c.next_review <= now));

  if (args.target_language)
    cards = cards.filter((c) => c.target_language === args.target_language);
  if (args.card_type)
    cards = cards.filter((c) => c.card_type === args.card_type);
  if (args.tags && args.tags.length) {
    cards = cards.filter((c) =>
      (c.tags ?? []).some((t: string) => args.tags.includes(t))
    );
  }

  // Sort by frequency desc, then level asc (weak high-frequency first)
  cards.sort(
    (a, b) => (b.count ?? 1) - (a.count ?? 1) || (a.level ?? 0) - (b.level ?? 0)
  );

  const limit = args.limit ?? settings.daily_review_target;
  cards = cards.slice(0, limit);

  return {
    queue: cards,
    total: cards.length,
    instruction_to_caller:
      languageReminder(
        settings,
        args.target_language ?? settings.default_target_language
      ) + " 카드를 한 장씩 제시하고 사용자가 답한 뒤 grade_card로 채점하세요.",
  };
}

export async function handleGradeCard(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const rows = await data.list("card:");
  const target = rows.find((r) => (r.value as any)?.id === args.card_id);
  if (!target) throw new Error(`Card not found: ${args.card_id}`);
  const card = target.value as any;
  card.level = args.correct
    ? Math.min((card.level ?? 0) + 1, settings.srs_intervals.length - 1)
    : 0;
  card.next_review = nextReviewDate(card.level, settings.srs_intervals);
  card.last_seen = todayISO();
  await data.set(target.key, card);
  return {
    card_id: card.id,
    new_level: card.level,
    next_review: card.next_review,
  };
}
