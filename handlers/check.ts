import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { nextReviewDate } from "../lib/srs";
import { uid, todayISO, normalizeKey } from "../lib/utils";

// ---------------------------------------------------------------------------
// Shared helper: 한 개 항목(필드명 다를 수 있음)을 카드 풀과 매칭해 중복 표시.
// frontField: errors 는 "original", upgrades 도 "original" 동일.
// ---------------------------------------------------------------------------
type PoolRow = { key: string; value: any; updated_at: string };

function matchOne(
  item: any,
  pool: PoolRow[],
  targetLang: string,
  frontField = "original"
) {
  const key = normalizeKey(item[frontField] ?? "");
  const dup = pool.find((row) => {
    const v = row.value as any;
    return (
      v && normalizeKey(v.front) === key && v.target_language === targetLang
    );
  });
  return {
    ...item,
    duplicate_of: dup ? (dup.value as any).id : null,
    previous_count: dup ? (dup.value as any).count ?? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// check_text — 1차 첨삭. grammar + awkward 필수 수정만.
// ---------------------------------------------------------------------------
export async function handleCheckText(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const targetLang = args.target_language ?? settings.default_target_language;
  const errors = (args.errors ?? []) as any[];

  // 정책 가드(soft): upgrade 카테고리가 섞여 들어오면 분리해서 별도 안내.
  // 호출 AI 가 description 을 안 지킨 경우의 안전망 — throw 하지 않고 호출자에게 알림만.
  const essential = errors.filter(
    (e) => e.category !== "upgrade" && e.category !== "level_up"
  );
  const upgradeLeak = errors.filter(
    (e) => e.category === "upgrade" || e.category === "level_up"
  );

  const pool = await data.list("card:");
  const matched = essential.map((e) => matchOne(e, pool, targetLang));

  const sessionId = uid();
  await data.set(`session:${sessionId}`, {
    id: sessionId,
    kind: "check",
    original_text: args.original_text,
    polished_version: args.polished_version,
    errors: matched,
    upgrades: [],
    target_language: targetLang,
    created_at: todayISO(),
  });

  const dupCount = matched.filter((m) => m.duplicate_of).length;

  return {
    session_id: sessionId,
    errors: matched,
    polished_version: args.polished_version,
    summary: `${matched.length}개 필수 수정 항목 (${dupCount}개는 반복 패턴).`,
    upgrade_leak: upgradeLeak.length > 0 ? upgradeLeak.length : undefined,
    instruction_to_caller:
      languageReminder(settings, targetLang) +
      " 필수 수정 항목만 사용자에게 보여주고 인정/변명 옵션 제시." +
      " 응답 끝에 한 줄 추가: '더 고급 표현이나 발전 방법도 보고 싶으면 말씀해 주세요.'" +
      (upgradeLeak.length > 0
        ? ` ⚠️ upgrade 카테고리 ${upgradeLeak.length}건이 섞여 들어와 무시했어요. 발전 제안은 suggest_upgrades 로 별도 호출해주세요.`
        : ""),
  };
}

// ---------------------------------------------------------------------------
// suggest_upgrades — 2차 발전 제안. 사용자 명시 요청 시만.
// ---------------------------------------------------------------------------
export async function handleSuggestUpgrades(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const targetLang = args.target_language ?? settings.default_target_language;
  const upgrades = (args.upgrades ?? []) as any[];

  const pool = await data.list("card:");
  const matched = upgrades.map((u) => matchOne(u, pool, targetLang));

  // 세션 이어붙이거나 신규 생성
  let sessionId = args.session_id;
  if (sessionId) {
    const existing = await data.get(`session:${sessionId}`);
    if (existing) {
      existing.upgrades = matched;
      existing.upgraded_version = args.upgraded_version;
      existing.updated_at = todayISO();
      await data.set(`session:${sessionId}`, existing);
    } else {
      sessionId = null; // not found → 신규로 fallback
    }
  }
  if (!sessionId) {
    sessionId = uid();
    await data.set(`session:${sessionId}`, {
      id: sessionId,
      kind: "upgrade",
      original_text: args.original_text,
      upgraded_version: args.upgraded_version,
      errors: [],
      upgrades: matched,
      target_language: targetLang,
      created_at: todayISO(),
    });
  }

  const dupCount = matched.filter((m) => m.duplicate_of).length;

  return {
    session_id: sessionId,
    upgrades: matched,
    upgraded_version: args.upgraded_version,
    summary: `${matched.length}개 발전 제안 (${dupCount}개는 이미 카드 풀에 있음).`,
    instruction_to_caller:
      languageReminder(settings, targetLang) +
      " 발전 제안을 보여주되, 카드 저장은 사용자가 '외울래/카드로 추가' 같이" +
      " 명시 요청한 항목만 save_correction(tier='upgrade') 으로 저장. " +
      "단순 동의/무반응은 저장 X — 보여주기만 하고 끝.",
  };
}

// ---------------------------------------------------------------------------
// save_correction — 인정 항목(필수) 또는 명시적 픽 항목(발전) 카드 적재.
// ---------------------------------------------------------------------------
export async function handleSaveCorrection(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const targetLang = args.target_language;
  const front = args.original;
  const back = args.corrected;
  const key = normalizeKey(front);

  // tier 추론: 명시 안 됐으면 category 로
  const tier =
    args.tier ??
    (args.category === "upgrade" || args.category === "level_up"
      ? "upgrade"
      : "essential");

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
    // tier 는 한 번 essential 로 박혔으면 유지 (필수 학습이 우선).
    // 다만 처음 upgrade 로 들어왔다 essential 로 재인식되면 격상.
    if (v.tier === "upgrade" && tier === "essential") v.tier = "essential";
    await data.set(dup.key, v);
    return {
      action: "incremented",
      card_id: v.id,
      count: v.count,
      tier: v.tier,
      instruction_to_caller: languageReminder(settings, targetLang),
    };
  }

  // Infer card_type from category if not provided
  let cardType = "grammar";
  if (args.category === "vocab" || args.category === "awkward") cardType = "vocab";
  if (args.category === "upgrade") cardType = "phrase"; // 발전 제안은 보통 표현·콜로케이션
  if (args.cloze_format)
    cardType = args.category === "vocab" ? "vocab" : "phrase";

  const card = {
    id: uid(),
    front,
    back,
    card_type: cardType,
    category: args.category,
    tier,
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
