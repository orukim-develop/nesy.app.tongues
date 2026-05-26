import type { RunInput } from "../index";
import { type Settings } from "../lib/settings";
import { nextReviewDate } from "../lib/srs";
import { todayISO } from "../lib/utils";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function handleRenderBoard(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const view = args.view ?? "overview";

  // --- 1. 채점 부수효과: 시각화는 tool 을 직접 못 부르므로,
  //        study 버튼 클릭이 grade_card_id 를 args 로 실어 보내면 여기서 적용한다.
  if (args.grade_card_id) {
    const rows = await data.list("card:");
    const target = rows.find((r) => (r.value as any)?.id === args.grade_card_id);
    if (target) {
      const card = target.value as any;
      const correct = args.grade_correct === true || args.grade_correct === "true";
      card.level = correct
        ? Math.min((card.level ?? 0) + 1, settings.srs_intervals.length - 1)
        : 0;
      card.next_review = nextReviewDate(card.level, settings.srs_intervals);
      card.last_seen = todayISO();
      await data.set(target.key, card);
    }
  }

  // --- 2. 풀 로드 (채점 반영 후) ---
  const rows = await data.list("card:");
  const cards = rows.map((r) => r.value as any).filter(Boolean);

  // ===== Study view (공부 모드) =====
  if (view === "study") {
    return renderStudy(args, cards, settings);
  }

  // ===== 통계 view (overview / by_tag / timeline / defended) =====
  return renderStats(view, cards);
}

// ---------------------------------------------------------------------------
// Study mode renderer
// ---------------------------------------------------------------------------
function renderStudy(args: any, allCards: any[], settings: Settings) {
  const filterMode = args.filter_mode ?? "quota";
  const tagFilter = args.tag ?? "";
  const targetLang = args.target_language ?? "";
  const now = todayISO();

  // 큐 구성
  let queue = [...allCards];
  if (filterMode === "quota") {
    queue = queue.filter((c) => !c.next_review || c.next_review <= now);
  } else if (filterMode === "tag" && tagFilter) {
    queue = queue.filter((c) => (c.tags ?? []).includes(tagFilter));
  }
  if (targetLang) queue = queue.filter((c) => c.target_language === targetLang);

  // 정렬: 빈도 desc + level asc (review.ts 와 동일)
  queue.sort(
    (a, b) => (b.count ?? 1) - (a.count ?? 1) || (a.level ?? 0) - (b.level ?? 0)
  );

  // 채점이 방금 적용되었다면 다음 카드로 자동 이동
  let currentId = args.card_id;
  if (args.grade_card_id) {
    // 방금 채점한 카드 다음 → 큐에서 그 카드는 빠졌거나 next_review 가 뒤로 갔으므로,
    // 큐 첫 카드로 (또는 동일 위치 다음 카드로) 자연스럽게 넘어감.
    currentId = undefined;
  }

  const currentCard =
    queue.find((c) => c.id === currentId) ?? queue[0] ?? null;
  const flipped = args.flipped === true || args.flipped === "true";

  // 모든 태그 (태그 필터 셀렉터 옵션용)
  const tagSet = new Set<string>();
  for (const c of allCards) for (const t of c.tags ?? []) tagSet.add(t);
  const allTags = Array.from(tagSet).sort();

  // 진행도
  const indexInQueue = currentCard
    ? queue.findIndex((c) => c.id === currentCard.id) + 1
    : 0;
  const totalInQueue = queue.length;

  const filterChip = (mode: string, label: string) =>
    `<button class="${filterMode === mode ? "chip on" : "chip"}"
      onclick="postState({view:'study', filter_mode:'${mode}'})">
      ${label}
    </button>`;

  const tagOptions =
    allTags.length === 0
      ? '<option value="">태그 없음</option>'
      : ['<option value="">— 태그 선택 —</option>']
          .concat(
            allTags.map(
              (t) =>
                `<option value="${escapeHtml(t)}" ${
                  t === tagFilter ? "selected" : ""
                }>${escapeHtml(t)}</option>`
            )
          )
          .join("");

  // 카드 본문
  let cardBlock = "";
  if (!currentCard) {
    cardBlock = `
      <div class="empty">
        <div class="empty-icon">📭</div>
        <div class="empty-title">${
          filterMode === "quota"
            ? "오늘 복습할 카드가 없어요"
            : filterMode === "tag" && !tagFilter
              ? "태그를 선택하세요"
              : "조건에 맞는 카드가 없어요"
        }</div>
        <div class="empty-sub">다른 필터를 고르거나 새 카드를 추가해보세요.</div>
      </div>`;
  } else {
    const front = escapeHtml(currentCard.front ?? "");
    const back = escapeHtml(currentCard.back ?? "");
    const reason = escapeHtml(currentCard.rule_or_reason ?? "");
    const example = escapeHtml(currentCard.example_sentence ?? "");
    const cloze = escapeHtml(currentCard.cloze_format ?? "");
    const cardType = escapeHtml(currentCard.card_type ?? "card");
    const lang = escapeHtml(currentCard.target_language ?? "");

    cardBlock = `
      <div class="card-wrap">
        <div class="card-meta">
          <span class="badge">${cardType}</span>
          <span class="badge alt">${lang}</span>
          <span class="badge alt">lv ${currentCard.level ?? 0}</span>
          <span class="counter">${indexInQueue} / ${totalInQueue}</span>
        </div>

        <div class="card ${flipped ? "flipped" : ""}">
          <div class="front">
            <div class="card-text">${front}</div>
            ${cloze ? `<div class="card-cloze">${cloze}</div>` : ""}
          </div>
          ${
            flipped
              ? `
            <div class="back">
              <div class="card-text">${back}</div>
              ${reason ? `<div class="card-reason">📖 ${reason}</div>` : ""}
              ${example ? `<div class="card-example">"${example}"</div>` : ""}
            </div>
          `
              : ""
          }
        </div>

        <div class="actions">
          ${
            !flipped
              ? `<button class="btn primary" onclick="postState({view:'study', filter_mode:'${filterMode}', tag:'${escapeHtml(
                  tagFilter
                )}', card_id:'${currentCard.id}', flipped:true})">뒤집기</button>
              <button class="btn ghost" onclick="postState({view:'study', filter_mode:'${filterMode}', tag:'${escapeHtml(
                tagFilter
              )}'})">건너뛰기</button>`
              : `<button class="btn ok" onclick="postState({view:'study', filter_mode:'${filterMode}', tag:'${escapeHtml(
                  tagFilter
                )}', grade_card_id:'${currentCard.id}', grade_correct:true})">알았음</button>
              <button class="btn no" onclick="postState({view:'study', filter_mode:'${filterMode}', tag:'${escapeHtml(
                tagFilter
              )}', grade_card_id:'${currentCard.id}', grade_correct:false})">모르겠음</button>`
          }
        </div>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
${BASE_CSS}
${STUDY_CSS}
</style></head><body>
${TABS_HTML(view)}
<div class="filters">
  ${filterChip("quota", `오늘 할당량 (${settings.daily_review_target})`)}
  ${filterChip("tag", "태그별")}
  ${filterChip("all", "전체")}
  ${
    filterMode === "tag"
      ? `<select onchange="postState({view:'study', filter_mode:'tag', tag:this.value})">
           ${tagOptions}
         </select>`
      : ""
  }
</div>
${cardBlock}
${POST_STATE_JS}
</body></html>`;

  return { html };
}

// ---------------------------------------------------------------------------
// Stats renderer (기존 4탭)
// ---------------------------------------------------------------------------
function renderStats(view: string, cards: any[]) {
  const total = cards.length;
  const byType: Record<string, number> = { vocab: 0, grammar: 0, phrase: 0, other: 0 };
  const byLang: Record<string, number> = {};
  const byTag: Record<string, number> = {};
  let defended = 0;
  let acquitted = 0;
  let givenUp = 0;

  const today = new Date();
  const daily: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    daily[d] = 0;
  }

  for (const c of cards) {
    const t = c.card_type ?? "other";
    byType[t] = (byType[t] ?? 0) + 1;
    byLang[c.target_language ?? "?"] = (byLang[c.target_language ?? "?"] ?? 0) + 1;
    for (const tag of c.tags ?? []) byTag[tag] = (byTag[tag] ?? 0) + 1;
    if ((c.defense_log ?? []).length > 0) {
      defended++;
      if (c.status === "acquitted") acquitted++;
      if (c.status === "given_up") givenUp++;
    }
    const d = (c.created_at ?? "").slice(0, 10);
    if (d in daily) daily[d]++;
  }

  const tagRows = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const langRows = Object.entries(byLang).sort((a, b) => b[1] - a[1]);
  const dailyMax = Math.max(1, ...Object.values(daily));
  const safeTotal = Math.max(1, total);

  const dueToday = cards.filter(
    (c) => c.next_review && c.next_review <= todayISO()
  ).length;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
${BASE_CSS}
.row{display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:11px}
.row .label{min-width:80px;color:#7a8a9a}
.bar{height:6px;background:#1a2a3a;border-radius:3px;flex:1;overflow:hidden}
.fill{height:100%;background:linear-gradient(90deg,#c9a96e,#a08040)}
.spark{display:flex;gap:2px;align-items:flex-end;height:40px;margin-top:6px}
.spark div{flex:1;background:#5d8ae8;border-radius:1px;min-height:1px}
.def{padding:8px;background:rgba(232,184,93,0.08);border-radius:6px;margin-top:8px;font-size:11px}
.def .num{color:#e8b85d;font-weight:700}
</style></head><body>
${TABS_HTML(view)}
<div class="grid">
  <div class="stat"><div class="v">${total}</div><div class="l">총 카드</div></div>
  <div class="stat"><div class="v">${defended}</div><div class="l">우긴 카드</div></div>
  <div class="stat"><div class="v">${dueToday}</div><div class="l">오늘 복습</div></div>
</div>

${
  view === "overview"
    ? `
<div style="margin-bottom:14px">
  <div style="color:#7a8a9a;font-size:11px;margin-bottom:6px">언어별</div>
  ${langRows
    .map(
      ([k, v]) => `
    <div class="row">
      <div class="label">${escapeHtml(k)}</div>
      <div class="bar"><div class="fill" style="width:${(v / safeTotal) * 100}%"></div></div>
      <div style="min-width:24px;text-align:right;color:#c9a96e">${v}</div>
    </div>
  `
    )
    .join("")}
</div>
<div>
  <div style="color:#7a8a9a;font-size:11px;margin-bottom:6px">카드 타입</div>
  ${Object.entries(byType)
    .filter(([, v]) => v > 0)
    .map(
      ([k, v]) => `
    <div class="row">
      <div class="label">${escapeHtml(k)}</div>
      <div class="bar"><div class="fill" style="width:${(v / safeTotal) * 100}%"></div></div>
      <div style="min-width:24px;text-align:right;color:#c9a96e">${v}</div>
    </div>
  `
    )
    .join("")}
</div>
`
    : ""
}

${
  view === "by_tag"
    ? `
<div>
  <div style="color:#7a8a9a;font-size:11px;margin-bottom:6px">태그별 (상위 12개)</div>
  ${
    tagRows.length === 0
      ? '<div style="color:#5a6a7a;font-size:11px">태그 없음</div>'
      : tagRows
          .map(
            ([k, v]) => `
    <div class="row">
      <div class="label" style="min-width:120px">${escapeHtml(k)}</div>
      <div class="bar"><div class="fill" style="width:${(v / tagRows[0][1]) * 100}%"></div></div>
      <div style="min-width:24px;text-align:right;color:#c9a96e">${v}</div>
    </div>
  `
          )
          .join("")
  }
</div>
`
    : ""
}

${
  view === "timeline"
    ? `
<div>
  <div style="color:#7a8a9a;font-size:11px;margin-bottom:6px">최근 14일 추가</div>
  <div class="spark">
    ${Object.entries(daily)
      .map(
        ([d, v]) =>
          `<div title="${d}: ${v}" style="height:${(v / dailyMax) * 100}%"></div>`
      )
      .join("")}
  </div>
  <div style="display:flex;justify-content:space-between;font-size:9px;color:#5a6a7a;margin-top:4px">
    <span>${Object.keys(daily)[0].slice(5)}</span>
    <span>${Object.keys(daily)[Object.keys(daily).length - 1].slice(5)}</span>
  </div>
</div>
`
    : ""
}

${
  view === "defended"
    ? `
<div class="def">
  <div>우기기 시도: <span class="num">${defended}</span>장</div>
  <div>무죄(acquitted): <span class="num">${acquitted}</span>장</div>
  <div>포기(given up): <span class="num">${givenUp}</span>장</div>
  <div style="margin-top:6px;color:#7a8a9a;font-size:10px">우긴 카드는 ${defended > 0 ? "메타인지 약점 신호" : "아직 없음 — 의심을 더 해보세요"}</div>
</div>
`
    : ""
}

${POST_STATE_JS}
</body></html>`;

  return { html };
}

// ---------------------------------------------------------------------------
// 공통 조각들 (CSS / 탭 / JS)
// ---------------------------------------------------------------------------
const BASE_CSS = `
body{font-family:-apple-system,'Noto Sans KR',sans-serif;background:#0f1923;color:#e8e4df;padding:14px;margin:0;font-size:13px}
h2{color:#c9a96e;font-size:14px;margin:0 0 10px;letter-spacing:1px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.stat{background:#14222f;padding:10px;border-radius:6px;text-align:center}
.stat .v{font-size:22px;color:#c9a96e;font-weight:700}
.stat .l{font-size:10px;color:#5a6a7a;margin-top:2px}
.tab{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.tab button{padding:4px 10px;background:transparent;border:1px solid #2a3a4a;color:#7a8a9a;border-radius:14px;font-size:10px;cursor:pointer}
.tab button.on{border-color:#c9a96e;color:#c9a96e;background:rgba(201,169,110,0.1)}
`;

const STUDY_CSS = `
.filters{display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.chip{padding:4px 10px;background:transparent;border:1px solid #2a3a4a;color:#7a8a9a;border-radius:14px;font-size:11px;cursor:pointer}
.chip.on{border-color:#c9a96e;color:#c9a96e;background:rgba(201,169,110,0.1)}
.filters select{background:#14222f;color:#e8e4df;border:1px solid #2a3a4a;border-radius:14px;padding:4px 8px;font-size:11px}
.card-wrap{margin-top:6px}
.card-meta{display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:10px}
.badge{background:#14222f;color:#c9a96e;padding:2px 8px;border-radius:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.badge.alt{color:#7a8a9a;background:#0f1923;border:1px solid #2a3a4a}
.counter{margin-left:auto;color:#5a6a7a;font-size:11px}
.card{background:#14222f;border-radius:10px;padding:18px;min-height:140px;margin-bottom:12px;border:1px solid #2a3a4a}
.card.flipped{border-color:#c9a96e}
.front,.back{display:flex;flex-direction:column;gap:8px}
.front{align-items:center;justify-content:center;text-align:center}
.back{margin-top:14px;padding-top:14px;border-top:1px dashed #2a3a4a}
.card-text{font-size:20px;color:#e8e4df;line-height:1.4;font-weight:600}
.back .card-text{font-size:16px;color:#c9a96e;font-weight:500}
.card-cloze{margin-top:6px;font-size:11px;color:#7a8a9a;font-style:italic}
.card-reason{font-size:11px;color:#9aa8b8;line-height:1.5}
.card-example{font-size:12px;color:#7a8a9a;font-style:italic;border-left:2px solid #c9a96e;padding-left:8px}
.actions{display:flex;gap:8px;justify-content:center}
.btn{padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;letter-spacing:.5px;flex:1;max-width:160px}
.btn.primary{background:#c9a96e;color:#0f1923}
.btn.ghost{background:transparent;color:#7a8a9a;border:1px solid #2a3a4a}
.btn.ok{background:#3a8a5a;color:#fff}
.btn.no{background:#8a3a3a;color:#fff}
.empty{text-align:center;padding:30px 12px;color:#5a6a7a}
.empty-icon{font-size:32px;margin-bottom:8px}
.empty-title{font-size:14px;color:#9aa8b8;margin-bottom:4px}
.empty-sub{font-size:11px;color:#5a6a7a}
`;

function TABS_HTML(currentView: string): string {
  const tabs: Array<[string, string]> = [
    ["overview", "전체"],
    ["by_tag", "태그별"],
    ["timeline", "14일"],
    ["defended", "우긴 카드"],
    ["study", "공부"],
  ];
  return `
<h2>방언이 터지는 마법 ▸ 보드</h2>
<div class="tab">
  ${tabs
    .map(
      ([v, label]) =>
        `<button class="${currentView === v ? "on" : ""}" onclick="postState({view:'${v}'})">${label}</button>`
    )
    .join("")}
</div>`;
}

const POST_STATE_JS = `
<script>
function postState(state) {
  parent.postMessage({ type: "widget-state-change", state: state }, "*");
}
</script>`;
