import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { todayISO, normalizeKey } from "../lib/utils";

export async function handleDefend(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const turn = args.turn_number ?? 1;
  const cardId = args.original_correction_id;

  // Find the card
  const rows = await data.list("card:");
  const target = rows.find((r) => (r.value as any)?.id === cardId);

  // If no card exists yet, store defense in a pending log keyed by the original text
  let card: any;
  let key: string;
  if (target) {
    card = target.value;
    key = target.key;
  } else {
    key = `pending_defense:${normalizeKey(cardId)}`;
    const existing = await data.get(key);
    card = existing ?? { id: cardId, defense_log: [], created_at: todayISO() };
  }

  card.defense_log = card.defense_log ?? [];
  card.defense_log.push({
    turn,
    user_argument: args.user_argument,
    verdict: args.verdict,
    verdict_reason: args.verdict_reason,
    final_expression: args.final_expression ?? null,
    timestamp: todayISO(),
  });

  // Handle terminal verdicts
  let outcome = "pending";
  if (args.verdict === "acquitted") {
    outcome = "acquitted";
    card.status = "acquitted";
    if (card.count && card.count > 1) card.count -= 1;
  } else if (args.verdict === "corrected") {
    outcome = "corrected";
    if (args.final_expression) card.back = args.final_expression;
  } else if (args.verdict === "give_up" || turn >= 5) {
    outcome = "given_up";
    card.status = "given_up";
  }

  await data.set(key, card);

  return {
    turn_number: turn,
    turns_remaining: Math.max(0, 5 - turn),
    outcome,
    defense_log: card.defense_log,
    instruction_to_caller:
      languageReminder(
        settings,
        card.target_language ?? settings.default_target_language
      ) +
      (turn >= 5
        ? " 5턴 한도 도달. 더 이상 변명 불가."
        : ` ${5 - turn}턴 남음.`),
  };
}
