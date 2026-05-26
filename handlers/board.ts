import type { RunInput } from "../index";
import { type Settings } from "../lib/settings";
import { todayISO } from "../lib/utils";

export async function handleRenderBoard(
  args: any,
  data: RunInput["data"],
  _settings: Settings
) {
  const rows = await data.list("card:");
  const cards = rows.map((r) => r.value as any).filter(Boolean);

  const view = args.view ?? "overview";
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

  const tagRows = Object.entries(byTag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const langRows = Object.entries(byLang).sort((a, b) => b[1] - a[1]);
  const dailyMax = Math.max(1, ...Object.values(daily));
  const safeTotal = Math.max(1, total);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,'Noto Sans KR',sans-serif;background:#0f1923;color:#e8e4df;padding:14px;margin:0;font-size:13px}
h2{color:#c9a96e;font-size:14px;margin:0 0 10px;letter-spacing:1px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.stat{background:#14222f;padding:10px;border-radius:6px;text-align:center}
.stat .v{font-size:22px;color:#c9a96e;font-weight:700}
.stat .l{font-size:10px;color:#5a6a7a;margin-top:2px}
.row{display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:11px}
.row .label{min-width:80px;color:#7a8a9a}
.bar{height:6px;background:#1a2a3a;border-radius:3px;flex:1;overflow:hidden}
.fill{height:100%;background:linear-gradient(90deg,#c9a96e,#a08040)}
.spark{display:flex;gap:2px;align-items:flex-end;height:40px;margin-top:6px}
.spark div{flex:1;background:#5d8ae8;border-radius:1px;min-height:1px}
.tab{display:flex;gap:6px;margin-bottom:12px}
.tab button{padding:4px 10px;background:transparent;border:1px solid #2a3a4a;color:#7a8a9a;border-radius:14px;font-size:10px;cursor:pointer}
.tab button.on{border-color:#c9a96e;color:#c9a96e;background:rgba(201,169,110,0.1)}
.def{padding:8px;background:rgba(232,184,93,0.08);border-radius:6px;margin-top:8px;font-size:11px}
.def .num{color:#e8b85d;font-weight:700}
</style></head><body>
<h2>방언이 터지는 마법 ▸ 보드</h2>
<div class="tab">
  ${["overview", "by_tag", "timeline", "defended"]
    .map(
      (v) =>
        `<button class="${view === v ? "on" : ""}" onclick="setView('${v}')">${v}</button>`
    )
    .join("")}
</div>
<div class="grid">
  <div class="stat"><div class="v">${total}</div><div class="l">총 카드</div></div>
  <div class="stat"><div class="v">${defended}</div><div class="l">우긴 카드</div></div>
  <div class="stat"><div class="v">${cards.filter((c) => c.next_review && c.next_review <= todayISO()).length}</div><div class="l">오늘 복습</div></div>
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
      <div class="label">${k}</div>
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
      <div class="label">${k}</div>
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
      <div class="label" style="min-width:120px">${k}</div>
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

<script>
function setView(v) {
  parent.postMessage({ type: "widget-state-change", state: { view: v } }, "*");
}
</script>
</body></html>`;

  return { html };
}
