import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { nextReviewDate } from "../lib/srs";
import { uid, todayISO } from "../lib/utils";

export async function handleAddCard(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const targetLang = args.target_language ?? settings.default_target_language;
  const card = {
    id: uid(),
    front: args.front,
    back: args.back,
    card_type: args.card_type ?? "vocab",
    examples: args.examples ?? [],
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

export async function handleListCards(
  args: any,
  data: RunInput["data"],
  _settings: Settings
) {
  const rows = await data.list("card:");
  let cards = rows.map((r) => r.value as any).filter(Boolean);

  if (args.target_language)
    cards = cards.filter((c) => c.target_language === args.target_language);
  if (args.tags && args.tags.length) {
    cards = cards.filter((c) =>
      (c.tags ?? []).some((t: string) => args.tags.includes(t))
    );
  }
  if (args.card_type) cards = cards.filter((c) => c.card_type === args.card_type);
  if (args.only_defended)
    cards = cards.filter((c) => (c.defense_log ?? []).length > 0);
  if (args.search) {
    const q = args.search.toLowerCase();
    cards = cards.filter(
      (c) =>
        c.front?.toLowerCase().includes(q) || c.back?.toLowerCase().includes(q)
    );
  }

  if (args.sort === "recent")
    cards.sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );
  else if (args.sort === "level")
    cards.sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  else cards.sort((a, b) => (b.count ?? 1) - (a.count ?? 1));

  return {
    cards: cards.slice(0, args.limit ?? 50),
    total: cards.length,
  };
}
