// ---- helpers shared by the drawings ----
window.cbb = {
ok: id => dash.data(id).status === 'ok',
rows: id => dash.data(id).status === 'ok' ? dash.data(id).data : [],
signed: v => v == null || isNaN(v) ? '—' : (v > 0 ? '+' : '') + d3.format('.2f')(v),
money: v => v == null || isNaN(v) ? '—' : (v < 0 ? '−$' : (v > 0 ? '+$' : '$')) + d3.format('.2f')(Math.abs(v)),
pct: v => v == null || isNaN(v) ? '—' : d3.format('.1f')(v) + '%',
td: (tr, text, cls) => { const c = document.createElement('td'); c.textContent = text == null || text === '' ? '—' : text; if (cls) c.className = cls; tr.appendChild(c); return c; },
key: (...parts) => parts.map(p => encodeURIComponent(String(p))).join(','),
failed: (el, id) => { const s = dash.data(id).status; if (s === 'error') { el.replaceChildren(); const tr = document.createElement('tr'); const c = document.createElement('td'); c.colSpan = 20; c.className = 'muted'; c.textContent = 'Failed to load'; tr.appendChild(c); el.appendChild(tr); return true; } return false; },
tierCls: t => t === 'High' ? 'ok' : t === 'Medium' ? 'warn' : 'bad',
};

// ---- refresh: re-read the feed sheet now ----
document.querySelectorAll('.refresh-btn').forEach(b => b.addEventListener('click', () => dash.refresh('feed')));

// ---- tabs ----
const showTab = (name) => {
document.querySelectorAll('[data-page]').forEach(s => { s.hidden = s.dataset.page !== name; });
document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
dash.setLink(name);
};
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { showTab(b.dataset.tab); if (b.dataset.tab === 'record') requestAnimationFrame(() => dash.draw('units-chart')); }));
{ let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => dash.draw('units-chart'), 150); }); }
const start = location.hash.slice(1); if (['today', 'record', 'rankings', 'stats', 'matchup', 'upcoming'].includes(start)) showTab(start);

// ---- header ----
const one = (id, where, field, fmt) => { const rows = cbb.rows(id); const r = where ? rows.find(x => Object.entries(where).every(([k, v]) => x[k] === v)) : rows[0]; return r ? fmt(r[field]) : '—'; };
dash.draw('updated', el => { el.textContent = one('meta', { key: 'updated' }, 'value', v => v || '—'); });
const SH = { group: 'STRONG + High' }, ALL = { group: 'Rexpom picks' };
dash.draw('t-sh-rec', el => { el.textContent = one('record', SH, 'record', v => v);
  const r = cbb.rows('record').find(g => g.group === 'STRONG + High'), sub = el.closest('.tile') && el.closest('.tile').querySelector('.sub');
  if (r && !r.n && sub) { el.textContent = 'Not yet'; sub.textContent = 'Best Bets need both teams on 4+ D-I games (most teams by about Nov 20)'; } });
const tint = (el, v) => { el.className = typeof v === 'number' ? (v > 0 ? 'ok' : v < 0 ? 'bad' : '') : ''; };
dash.draw('t-sh-units', el => { el.textContent = one('record', SH, 'units', cbb.signed); tint(el, one('record', SH, 'units', x => x)); });
dash.draw('t-sh-pct', el => { el.textContent = one('record', SH, 'win_pct', cbb.pct); });
dash.draw('t-all-rec', el => { el.textContent = one('record', ALL, 'record', v => v); });
dash.draw('t-all-units', el => { el.textContent = one('record', ALL, 'units', cbb.signed); tint(el, one('record', ALL, 'units', x => x)); });
dash.draw('t-all-pct', el => { el.textContent = one('record', ALL, 'win_pct', cbb.pct); });
// Rex's real bets in units (1 unit = $1)
dash.draw('t-bets-rec', el => { el.textContent = one('bet_summary', null, 'record', v => v); });
dash.draw('t-bets-pl', el => { el.textContent = one('bet_summary', null, 'profit', cbb.signed); const v = one('bet_summary', null, 'profit', x => x); el.className = typeof v === 'number' ? (v >= 0 ? 'ok' : 'bad') : ''; });
dash.draw('t-bets-pct', el => { el.textContent = one('bet_summary', null, 'win_pct', cbb.pct); });
dash.draw('t-bets-pend', el => { const r = cbb.rows('bet_summary')[0]; el.textContent = r && r.pending ? ` · ⏳ ${r.pending} pending (${d3.format('.2f')(r.pending_u)}u)` : ''; });
dash.draw('t-bets-staked', el => { el.textContent = one('bet_summary', null, 'staked', v => v == null ? '—' : d3.format('.2f')(v) + 'u'); });

// ---- share card: an image of today's picks ----
document.querySelectorAll('.share-btn').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.share-panel').forEach(p => { p.hidden = false; }); dash.draw('share-card'); }));
let shareShow = 'mine';
let shareDay = '';
document.querySelectorAll('.share-day').forEach(s => s.addEventListener('change', () => { shareDay = s.value; dash.draw('share-card'); }));
document.querySelectorAll('.share-show').forEach(s => s.addEventListener('change', () => { shareShow = s.value; dash.draw('share-card'); }));
document.querySelectorAll('.share-close').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.share-panel').forEach(p => { p.hidden = true; }); }));
dash.draw('share-card', el => {
el.replaceChildren(); if (dash.data('picks').status !== 'ok' || dash.data('record').status !== 'ok') { el.textContent = '—'; return; }
const now = new Date(); let slateYmd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const board0 = cbb.rows('picks'); if (board0.length && board0[0].date) slateYmd = rexpom.ymdOf(board0[0].date);   // the slate's day, so late-night games still count as today
const trk = dash.data('tracker').status === 'ok' ? cbb.rows('tracker') : [];
// Rex, 11/25: pick any past day's card from the dropdown
{ const days = [...new Set([slateYmd, ...trk.map(t => String(t.ymd)), ...(rexpom.bets || []).filter(b => b.stake > 0).map(b => b.ymd)])].filter(Boolean).sort().reverse();
  const md = y => `${+y.slice(4, 6)}/${+y.slice(6)}`;
  document.querySelectorAll('.share-day').forEach(sel => { const keep = sel.value; sel.replaceChildren(); days.forEach(y => { const o = document.createElement('option'); o.value = y === slateYmd ? '' : y; o.textContent = y === slateYmd ? `Today (${md(y)})` : md(y); sel.appendChild(o); }); sel.value = keep; if (sel.value !== keep) sel.value = ''; }); }
const isToday = !shareDay || shareDay === slateYmd, dayYmd = isToday ? slateYmd : shareDay;
const trkDay = trk.filter(t => String(t.ymd) === dayYmd);
const board = isToday ? board0 : trkDay.map(t => Object.assign({}, t, { size: t.stake || t.risk || 0 }));
const tByGame = new Map(trkDay.map(t => [t.game, t.t]));
const finals = new Map((dash.data('scores').status === 'ok' ? cbb.rows('scores') : []).filter(x => String(x.ymd) === dayYmd && x.away_score !== '' && x.away_score != null).flatMap(x => [[x.game, x], [x.home + ' @ ' + x.away, x]]));
const findPick = b => board.find(p => p.game === b.game && p.type === b.type);
const graded = new Map((dash.data('bets').status === 'ok' ? cbb.rows('bets') : []).map(x => [x.id, x]));
const tkRes = new Map(trkDay.map(t => [t.game + '|' + t.type, t.result]));
const tipMin = p => { const iso = tByGame.get(p.game); if (iso) return Date.parse(iso); const m = String(p.tip || '').match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return 9e15; let h = +m[1] % 12 + (/pm/i.test(m[3]) ? 12 : 0); if (h < 6) h += 24; return 8e15 + h * 60 + +m[2]; };
let picks;
if (shareShow === 'mine') picks = (rexpom.bets || []).filter(b => b.stake > 0 && b.ymd === dayYmd).map(b => { const gr = graded.get(b.id); const res = gr && ['W', 'L', 'P'].includes(gr.result) ? gr.result : ''; return Object.assign(mineRow(b), { res, pl: res ? gr.pl : null }); });
else picks = board.filter(p => p.flag !== 'Watch' && p.type !== '1H Spread' && (shareShow !== 'best' || (p.flag === 'STRONG' && p.tier === 'High'))).map(p => { const r = tkRes.get(p.game + '|' + p.type); const res = ['W', 'L', 'P'].includes(r) ? r : '';
  return Object.assign({}, p, { size: +p.size || 0, res, pl: res ? rexpom.profit(+p.size || 0, p.price || -110, res) : null }); });
picks.sort((a, b) => tipMin(a) - tipMin(b) || b.size - a.size);   // Rex, 11/25: in tip-off order
function mineRow(b) { const p = findPick(b) || {};
  if (b.kind === 'own') { const hit = window.rexpomMatch ? window.rexpomMatch(b.bet, b.ymd) : null;
    return { bet: hit ? window.rexpomShortBet(b.bet) : b.bet, game: hit ? hit.game : (b.game || ''), tip: hit ? hit.tip : '', size: b.stake, odds: b.odds || '-110' }; }
  if (/parlay/i.test(b.type || '')) return { bet: String(b.bet).replace(/\s*\(swapped\)/i, ''), game: '', tip: '', size: b.stake, odds: b.odds || '-110', legs: String(b.game || '').split(' · ').filter(Boolean) };   // Rex, 11/25: full parlay on the card
  return { bet: b.bet, game: b.game || p.game || '', tip: p.tip || '', size: b.stake, odds: b.odds || '-110' }; }
const filt = shareShow === 'mine' ? "Rex's bets" : shareShow === 'best' ? 'Best Bets' : 'Model picks';
const rec = g => cbb.rows('record').find(r => r.group === g) || {}; const all = rec('Rexpom picks'); const bs = cbb.rows('bet_summary')[0] || {};
const day = isToday ? one('meta', { key: 'date' }, 'value', v => v || '') : `${+dayYmd.slice(4, 6)}/${+dayYmd.slice(6)}/${dayYmd.slice(2, 4)}`;
const anyRes = picks.some(p => p.res);
const W = 1080, P = 56, rowH = 76, LEGH = 40, rowsH = picks.reduce((t, p) => t + rowH + (p.legs ? p.legs.length * LEGH + 10 : 0), 0), H = 330 + Math.max(rowH, rowsH) + (picks.length || anyRes ? 96 : 0) + 270;
const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d1b2a'); bg.addColorStop(1, '#16263a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
const T = (t, x, y, size, color, weight = '400', align = 'left') => { g.font = `${weight} ${size}px Georgia, 'Times New Roman', serif`; g.fillStyle = color; g.textAlign = align; g.fillText(t, x, y); };
const S = (t, x, y, size, color, weight = '400', align = 'left') => { g.font = `${weight} ${size}px -apple-system, 'Segoe UI', Arial, sans-serif`; g.fillStyle = color; g.textAlign = align; g.fillText(t, x, y); };
const fit = (t, size, weight, maxW) => { g.font = `${weight} ${size}px -apple-system, 'Segoe UI', Arial, sans-serif`; if (g.measureText(t).width <= maxW) return t; while (t.length > 3 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; };
const units = v => (v > 0 ? '+' : '') + (v ?? 0).toFixed(2) + 'u';
const whale = sz => sz >= 5 ? '🐋'.repeat(Math.floor(sz / 5)) + ' ' : '';   // Rex, 11/25: a whale per 5 units
const ODDS_X = W - P - 250;   // odds column (right edge)
T('Rexpom', P, 104, 72, '#ffffff'); S((isToday ? "Today's picks · " : 'Picks · ') + day + (filt ? ' · ' + filt : ''), P, 156, 34, '#9fb3c8');
S('BET', P, 236, 24, '#7f93a8', '600'); S('ODDS', ODDS_X, 236, 24, '#7f93a8', '600', 'right'); S(anyRes ? 'RESULT' : 'UNITS', W - P, 236, 24, '#7f93a8', '600', 'right');
g.fillStyle = '#2b3d52'; g.fillRect(P, 252, W - 2 * P, 2);
let y = 252;
if (!picks.length) { S(shareShow === 'mine' ? 'No bets entered for this day.' : 'No picks on the board for this day.', P, y + 56, 34, '#cfd9e3'); y += rowH; }
for (const p of picks) {
const hRow = rowH + (p.legs ? p.legs.length * LEGH + 10 : 0);
if (p.legs && !p.res) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); if (g.roundRect) g.roundRect(P - 16, y + 6, W - 2 * P + 32, hRow - 10, 14); else g.rect(P - 16, y + 6, W - 2 * P + 32, hRow - 10); g.fill(); }
if (p.res) { g.fillStyle = p.res === 'W' ? 'rgba(46,160,67,0.14)' : p.res === 'L' ? 'rgba(220,60,60,0.14)' : 'rgba(160,160,160,0.10)'; g.fillRect(P - 16, y + 4, W - 2 * P + 32, hRow - 6); }
{ const bt = betTeam(p.bet, p.game); let x0 = P;
  if (bt) { const c = teamColor(bt); g.fillStyle = c.bg; g.beginPath(); if (g.roundRect) g.roundRect(P, y + 14, 96, 56, 10); else g.rect(P, y + 14, 96, 56); g.fill();
    g.font = `700 ${c.abbr.length > 3 ? 22 : 26}px -apple-system, 'Segoe UI', Arial, sans-serif`; g.fillStyle = c.fg; g.textAlign = 'center'; g.fillText(c.abbr, P + 48, y + 51); x0 = P + 116; }
  const betTxt = String(p.bet).replace(/\s*\((DK|our)[^)]*\)\s*$/, '');
  S(fit(betTxt, 34, '700', ODDS_X - 120 - x0), x0, y + 44, 34, '#ffffff', '700');
  { const od = p.odds != null && p.odds !== '' ? p.odds : p.price; const n = +String(od ?? '').replace('+', '');   // Rex, 11/25: odds in their own column
    if (od != null && od !== '' && !isNaN(n) && n !== 0) S((n > 0 ? '+' : '') + n, ODDS_X, y + 50, 30, '#cfd9e3', '600', 'right'); }
  const fs = finals.get(p.game);
  if (p.legs) {   // Rex, 11/25: the parlay drawn as one block: a rail joining its legs, each with a team badge
    const tc = dash.data('colors').status === 'ok' ? cbb.rows('colors').map(r => r.team).sort((u, v) => v.length - u.length) : [];
    const lx = x0 + 18, top0 = y + 62, n = p.legs.length;
    g.fillStyle = '#3b5675'; g.fillRect(lx, top0, 3, (n - 1) * LEGH + 18);
    p.legs.forEach((lg0, k) => { const lg = legName(lg0); const team = tc.find(t => lg.startsWith(t + ' ')); const ly = y + 82 + k * LEGH;
      g.fillStyle = '#3b5675'; g.beginPath(); g.arc(lx + 1.5, ly - 8, 6, 0, 2 * Math.PI); g.fill();
      let tx = lx + 22;
      if (team) { const c2 = teamColor(team); g.fillStyle = c2.bg; g.beginPath(); if (g.roundRect) g.roundRect(tx, ly - 24, 68, 30, 7); else g.rect(tx, ly - 24, 68, 30); g.fill();
        g.font = "700 16px -apple-system, 'Segoe UI', Arial, sans-serif"; g.fillStyle = c2.fg; g.textAlign = 'center'; g.fillText(c2.abbr, tx + 34, ly - 3); }
      tx += 80;
      S(fit(lg, 27, '600', ODDS_X - 110 - tx), tx, ly, 27, '#dbe5ef', '600'); }); }
  else if (fs) { S(fit(`Final: ${fs.away} ${fs.away_score}, ${fs.home} ${fs.home_score}`, 22, '400', ODDS_X - 110 - x0), x0, y + 70, 22, '#cfd9e3'); }
  else S(fit([p.game, p.tip].filter(Boolean).join(' · '), 22, '400', ODDS_X - 110 - x0), x0, y + 70, 22, '#8aa0b6'); }
if (p.res) {
  const col = p.res === 'W' ? '#5fd37a' : p.res === 'L' ? '#ff7b7b' : '#cfd9e3';
  S((p.res === 'W' ? '✅ ' : p.res === 'L' ? '❌ ' : '➖ ') + units(p.pl), W - P, y + 44, 32, col, '700', 'right');
  S(whale(p.size) + d3.format('.2~f')(p.size) + 'u bet', W - P, y + 70, 20, '#8aa0b6', '400', 'right');
} else S(whale(p.size) + d3.format('.2~f')(p.size) + 'u', W - P, y + 50, 34, '#ffffff', '700', 'right');
y += hRow; }
y += 20; g.fillStyle = '#2b3d52'; g.fillRect(P, y, W - 2 * P, 2);
if (picks.length) {   // Rex, 11/25: wagered and potential payout, small, under the units column
  const mult = p => { const od = p.odds != null && p.odds !== '' ? p.odds : p.price; const n = +String(od ?? '').replace('+', ''); return !n || isNaN(n) ? 100 / 110 : n > 0 ? n / 100 : 100 / -n; };
  const wag = picks.reduce((t, p) => t + (+p.size || 0), 0), win = picks.reduce((t, p) => t + (+p.size || 0) * mult(p), 0);
  S(`Wagered ${d3.format('.2~f')(wag)}u`, W - P, y + 36, 24, '#cfd9e3', '600', 'right');
  S(`Potential payout ${d3.format('.2f')(wag + win)}u (+${d3.format('.2f')(win)}u)`, W - P, y + 66, 24, '#5fd37a', '600', 'right');
  }
if (anyRes) { const done = picks.filter(p => p.res), w = done.filter(p => p.res === 'W').length, l = done.filter(p => p.res === 'L').length, pu = done.length - w - l, net = done.reduce((s, p) => s + (p.pl || 0), 0), left = picks.length - done.length;
  const lab = `${isToday ? 'Today' : 'Day'}: ${w}-${l}${pu ? '-' + pu : ''} · `;
  S(lab, P, y + 56, 34, '#ffffff', '700');
  const x1 = P + g.measureText(lab).width; S(units(net), x1, y + 56, 34, net > 0 ? '#5fd37a' : net < 0 ? '#ff7b7b' : '#cfd9e3', '700');
  if (left) S(`${left} still to play`, P, y + 90, 24, '#8aa0b6');
  }
y += picks.length || anyRes ? 96 : 0;
// season records (Rex, 11/25: back on the card)
S('SEASON', P, y + 50, 22, '#7f93a8', '600');
const col = (lab, recTxt, u, x) => { S(lab, x, y + 92, 30, '#9fb3c8', '600'); S(recTxt || '—', x, y + 154, 60, '#ffffff', '700'); S(units(+u || 0), x, y + 200, 40, (+u || 0) >= 0 ? '#5fd37a' : '#ff7b7b', '700'); };
col("Rex's Bets", bs.record, bs.profit, P); col('Rexpom picks', all.record ? all.record.replace(/-0$/, '') : '', all.units, P + 500);
S('1 unit = base bet · for fun, not financial advice', W / 2, H - 34, 20, '#6f849a', '400', 'center');
const url = c.toDataURL('image/png'); const img = document.createElement('img'); img.src = url; img.alt = "Rexpom picks card";
let blob = null; c.toBlob(b => { blob = b; }, 'image/png');
const getBlob = () => blob ? Promise.resolve(blob) : new Promise(r => c.toBlob(r, 'image/png'));
const fname = 'rexpom-picks-' + String(day).replace(/\//g, '-') + '.png';
const acts = document.createElement('div'); acts.className = 'acts';
const cp = document.createElement('button'); cp.type = 'button'; cp.textContent = '📋 Copy image';
cp.onclick = async () => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': getBlob() })]); cp.textContent = '✅ Copied'; } catch (e) { cp.textContent = 'Copy not allowed here: press and hold the image'; } };
acts.append(cp);
const hint = document.createElement('div'); hint.className = 'hint'; hint.textContent = 'On a phone you can also press and hold the image to save or send it.';
el.append(acts, img, hint);
});

// ---- today ----

/* click a game row (Today's picks / Upcoming) to see the projected score and each team's last 5 games */
const OPEN_ROWS = new Set();
function gameDetail(away, home, proj) {
  const box = document.createElement('div');
  const p = document.createElement('div'); p.className = 'gd-proj'; p.textContent = proj ? 'Projected score: ' + proj : 'Projected score: —'; box.appendChild(p);
  const wrap = document.createElement('div'); wrap.className = 'gd-teams';
  for (const t of [away, home]) {
    const col = document.createElement('div'); const h = document.createElement('h4'); h.textContent = t + ' — last 5'; col.appendChild(h);
    const games = cbb.rows('recent').filter(r => r.team === t);
    if (!games.length) { const n = document.createElement('div'); n.className = 'muted'; n.textContent = 'No games yet'; col.appendChild(n); }
    else { const tb = document.createElement('table'); for (const g of games) { const tr = document.createElement('tr');
      cbb.td(tr, g.date, 'muted'); cbb.td(tr, `${g.where} ${g.opp}`); cbb.td(tr, `${g.result} ${g.score}`, g.result === 'W' ? 'ok' : 'bad'); tb.appendChild(tr); } col.appendChild(tb); }
    wrap.appendChild(col);
  }
  box.appendChild(wrap); return box;
}
function makeExpandable(tr, key, away, home, proj) {          // rows open the game sheet (Rex, 11/20)
  tr.classList.add('clickable'); tr.title = 'Tap for the game preview';
  const compact = () => tr.closest('.picks-table') && window.matchMedia('(max-width: 700px)').matches;   // Rex, 11/24: phones tap to expand
  tr.addEventListener('click', ev => { if (ev.target.closest('input,button,select,a,.mine')) return; if (compact()) { tr.classList.toggle('open'); return; } openGame(away, home, proj); });
  if (tr.closest('.picks-table')) { const c = tr.querySelector('.c-bet'); if (c && !c.querySelector('.gp-btn')) { const gb = document.createElement('button'); gb.type = 'button'; gb.className = 'gp-btn'; gb.textContent = '🔎 Game preview'; gb.addEventListener('click', ev => { ev.stopPropagation(); openGame(away, home, proj); }); c.appendChild(gb); } }
}

/* ---------- sheets: game preview and team pages ---------- */
const SIG_G = 11, HCA_KP = 3.2;
const Phi = z => { const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2); return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y); };
function sheet(build) {
  let s = document.getElementById('sheet');
  if (!s) {
    s = document.createElement('div'); s.id = 'sheet'; s.className = 'sheet';
    s.innerHTML = '<div class="sheet-card" role="dialog" aria-modal="true"><button type="button" class="sheet-x" aria-label="Close">✕</button><div class="sheet-body"></div></div>';
    document.querySelector('.cbb').appendChild(s);
    s.addEventListener('click', e => { if (e.target === s || e.target.closest('.sheet-x')) s.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') s.classList.remove('open'); });
  }
  const body = s.querySelector('.sheet-body'); body.replaceChildren(); build(body);
  s.classList.add('open'); s.querySelector('.sheet-card').scrollTop = 0;
}
// ---- public betting % (Rex, 11/24): money % vs bets % on our side; 10+ points apart = where the bigger bettors are
cbb.splitSig = window.splitSig;
const splitText = p => p.sig ? `${p.sig === 'with' ? '💰 Sharp money with us' : p.sig === 'against' ? '⚠ Sharp money against' : 'Money even'} · ${p.money_pct}% of money, ${p.bets_pct}% of bets` : '';
// alt-spread parlay legs say so; +/-0.5 is the moneyline (Rex, 11/25)
const legName = t => { t = String(t || ''); if (/\s[+-]0\.5$/.test(t)) return t.replace(/\s[+-]0\.5$/, ' ML'); return /\s[+-]\d+(\.\d+)?$/.test(t) ? t + ' (alt)' : t; };
// ---- line moves shown as "from → to" (Rex, 11/25)
const lineMove = (from, to, v) => { if (to == null || to === '') return ''; const f = from == null || from === '' ? '?' : from; if (v == null || v === 0 || String(f) === String(to)) return `Line ${f} → ${to} (no move)`;
  return `${v > 0 ? '✅' : '⚠'} Line ${f} → ${to} (${v > 0 ? 'our way' : 'against us'})`; };
// ---- team badges (Rex, 11/24): short code on the school's colors (ESPN's team list); no logos
const teamColor = t => { let m = null; if (dash.data('colors').status === 'ok') { const rows = cbb.rows('colors'); if (window._tcRows !== rows.length) { window._tcRows = rows.length; window._tcMap = new Map(rows.map(r => [r.team, r])); } m = window._tcMap; } const r = m && m.get(t);
  const abbr = (r && r.abbr) || String(t || '').replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(w => !/^(of|the|at)$/i.test(w)).map(w => w[0]).join('').slice(0, 4).toUpperCase() || '?';
  let bg = r && r.color ? '#' + r.color : '#3a4656', fg = '#ffffff';
  const lum = h => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  if (lum(bg) > 0.72) { fg = r && r.alt && lum('#' + r.alt) < 0.5 ? '#' + r.alt : '#1a1a1a'; }
  return { abbr, bg, fg }; };
const teamBadge = t => { const c = teamColor(t); const s = document.createElement('span'); s.className = 'tb'; s.textContent = c.abbr; s.style.background = c.bg; s.style.color = c.fg; s.title = t; return s; };
const betTeam = (bet, game) => { const [ga, gh] = String(game || '').split(' @ '); const b = String(bet || ''); return ga && b.startsWith(ga) ? ga : gh && b.startsWith(gh) ? gh : null; };
window.rexpomTeamColor = teamColor; window.rexpomBetTeam = betTeam;
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const teamLink = t => { const b = el('button', 'tlink', t); b.type = 'button'; b.onclick = () => openTeam(t); return b; };
const sgn1 = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
function lastFive(t) {
  const col = el('div', 'gd-col'); col.appendChild(el('h4', null, t + ' — last 5'));
  const games = cbb.rows('recent').filter(r => r.team === t);
  if (!games.length) col.appendChild(el('div', 'muted', 'No games yet'));
  else { const tb = el('table'); for (const g of games) { const tr = el('tr'); cbb.td(tr, g.date, 'muted'); cbb.td(tr, `${g.where} ${g.opp}`); cbb.td(tr, `${g.result} ${g.score}`, g.result === 'W' ? 'ok' : 'bad'); tb.appendChild(tr); } col.appendChild(tb); }
  return col;
}
function openGame(away, home, proj) {
  const up = cbb.rows('upcoming').find(u => u.away === away && u.home === home) || {};
  const picks = cbb.rows('picks').filter(p => p.game === `${away} @ ${home}`);
  const rk = new Map(cbb.rows('rankings').map(r => [r.team, r]));
  const neutral = up.neutral === 'yes';
  sheet(b => {
    const h = el('div', 'sh-title'); h.append(teamBadge(away), teamLink(away), el('span', 'muted', neutral ? ' vs ' : ' @ '), teamBadge(home), teamLink(home)); b.appendChild(h);
    const ra = rk.get(away), rh = rk.get(home);
    b.appendChild(el('div', 'muted', [up.date, up.tip, neutral ? 'neutral site' : `at ${home}`].filter(Boolean).join(' · ') +
      (ra && rh ? ` · our ranks #${ra.rank} vs #${rh.rank}` : '')));
    // ---- predictions from each model
    const models = [];
    let ap = +up.ap, hp = +up.hp;
    if (!(ap > 0) && proj) { const m = String(proj).match(/(\d+)\D+(\d+)/); if (m) { ap = +m[1]; hp = +m[2]; } }
    const poss = +up.poss || 70, tot = ap + hp;
    if (ap > 0) models.push({ name: 'Rexpom (ours)', a: ap, h: hp, note: 'efficiency, roster, injuries, rest and travel' });
    if (ra && rh && ra.kp_net != null && rh.kp_net != null && tot > 0) {
      const m = (rh.kp_net - ra.kp_net) * poss / 100 + (neutral ? 0 : HCA_KP);
      models.push({ name: 'KenPom', a: (tot - m) / 2, h: (tot + m) / 2, note: 'KenPom ratings (our pace and total)' });
    }
    const sp = up.spread === '' || up.spread == null ? null : +up.spread, ou = up.total === '' || up.total == null ? null : +up.total;
    if (sp != null && !isNaN(sp)) { const T = ou && !isNaN(ou) ? ou : tot; models.push({ name: 'Vegas (DraftKings)', a: (T + sp) / 2, h: (T - sp) / 2, note: `line ${home} ${sp > 0 ? '+' : ''}${sp}${ou ? ` · total ${ou}` : ''}` }); }
    if (models.length > 1) { const n = models.length; models.push({ name: 'Average of all', a: models.reduce((s, m) => s + m.a, 0) / n, h: models.reduce((s, m) => s + m.h, 0) / n, note: '' }); }
    const tbl = el('table', 'sh-models'); const hd = el('tr');
    for (const t of ['Model', 'Score', 'Margin', 'Total', `${home} win`]) hd.appendChild(el('th', null, t));
    tbl.appendChild(hd);
    for (const m of models) {
      const tr = el('tr', m.name.startsWith('Average') ? 'avg' : ''); const mg = m.h - m.a;
      const c0 = el('td'); c0.appendChild(el('div', null, m.name)); if (m.note) c0.appendChild(el('div', 'muted small', m.note)); tr.appendChild(c0);
      tr.appendChild(el('td', 'num', `${Math.round(m.a)}–${Math.round(m.h)}`));
      tr.appendChild(el('td', 'num', `${mg >= 0 ? home : away} ${sgn1(-Math.abs(mg))}`));
      tr.appendChild(el('td', 'num', (m.a + m.h).toFixed(0))); tr.appendChild(el('td', 'num', Math.round(100 * Phi(mg / SIG_G)) + '%'));
      tbl.appendChild(tr);
    }
    if (models.length) { const w = el('div', 'scroll'); w.appendChild(tbl); b.appendChild(el('h4', null, `Predicted score (${away}–${home})`)); b.appendChild(w); }
    // ---- our play on this game
    for (const p of picks.filter(p => p.flag !== 'Watch' || picks.length === 1)) {
      const box = el('div', 'sh-pick');
      box.appendChild(el('b', null, `${p.flag === 'STRONG' ? '🔥 STRONG' : p.flag === 'Big' ? '🏀 Big Game' : p.flag === 'Lean' ? '👍 Lean' : p.flag === 'Under' ? '📉 Under' : p.flag === 'Over' ? '📈 Over' : '👀 Watch'}: ${p.bet}`));
      const bits = [`edge ${p.edge} pts`, `win chance ${cbb.pct(p.chance)}`, p.tier && `${p.tier} confidence`, p.price && `DK ${+p.price > 0 ? '+' : ''}${p.price}`, p.size ? `bet ${p.size}u` : 'no bet'];
      if (p.close && p.clv !== '' && p.clv != null) bits.push(lineMove(p.best_line, p.close, +p.clv));
      box.appendChild(el('div', 'muted', bits.filter(Boolean).join(' · ')));
      b.appendChild(box);
    }
    const two = el('div', 'gd-teams'); two.append(lastFive(away), lastFive(home)); b.appendChild(two);
  });
}
function openTeam(t) {
  const r = cbb.rows('rankings').find(x => x.team === t) || {};
  const s = cbb.rows('stats').find(x => x.team === t) || {};
  sheet(b => {
    b.appendChild(el('div', 'sh-title', t));
    b.appendChild(el('div', 'muted', [r.conf, r.record && `${r.record}${r.conf_record ? ` (${r.conf_record} conf)` : ''}`].filter(Boolean).join(' · ')));
    const tiles = el('div', 'sh-tiles');
    const tile = (lab, v, sub) => { const d = el('div', 'sh-tile'); d.appendChild(el('div', 'muted small', lab)); d.appendChild(el('div', 'big', v ?? '—')); if (sub) d.appendChild(el('div', 'muted small', sub)); tiles.appendChild(d); };
    tile('Our rank', r.rank ? `#${r.rank}` : '—', r.move ? (r.move > 0 ? `▲${r.move} this month` : `▼${-r.move} this month`) : '');
    tile('AP', r.ap ? `#${r.ap}` : 'NR'); tile('KenPom', r.kenpom ? `#${r.kenpom}` : '—', r.kp_net != null ? `net ${sgn1(r.kp_net)}` : '');
    tile('Net rating', r.net != null ? sgn1(r.net) : '—', 'pts per 100 poss vs avg');
    b.appendChild(tiles);
    const rows = [['Offense (pts/100)', r.off], ['Defense (pts/100 allowed)', r.def], ['Tempo (poss/game)', r.pace],
      ['Effective FG%', s.efg, s.efg_d], ['Turnover %', s.to, s.to_d], ['Off. rebound %', s.orb, s.drb],
      ['Free-throw rate', s.ftr, s.ftr_d], ['3-pt %', s.p3, s.p3_d], ['2-pt %', s.p2, s.p2_d], ['3-pt attempt rate', s.p3rate, s.p3rate_d],
      ['FT %', s.ft], ['Strength of schedule', s.sos], ['Wins above bubble', s.wab], ['Title chance', r.champ != null ? r.champ + '%' : null]];
    const tb = el('table', 'sh-stats'); const hd = el('tr'); for (const x of ['', 'Team', 'Opponents']) hd.appendChild(el('th', null, x)); tb.appendChild(hd);
    for (const [lab, v, o] of rows) { if (v == null || v === '') continue; const tr = el('tr'); tr.appendChild(el('td', null, lab)); tr.appendChild(el('td', 'num', typeof v === 'number' ? (Math.abs(v) < 1 && v !== 0 ? v.toFixed(2) : String(+v.toFixed(1))) : v)); tr.appendChild(el('td', 'num muted', o == null || o === '' ? '' : String(+(+o).toFixed(1)))); tb.appendChild(tr); }
    b.appendChild(el('h4', null, 'Season stats')); b.appendChild(tb);
    b.appendChild(lastFive(t));
    const ups = cbb.rows('upcoming').filter(u => u.away === t || u.home === t);
    if (ups.length) {
      b.appendChild(el('h4', null, 'Coming up'));
      for (const u of ups) { const btn = el('button', 'sh-up', `${u.date} ${u.tip || ''} · ${u.away} ${u.neutral === 'yes' ? 'vs' : '@'} ${u.home} · ours: ${u.score}${u.trank ? ` · Vegas: ${u.trank}` : ''}`); btn.type = 'button'; btn.onclick = () => openGame(u.away, u.home, u.score); b.appendChild(btn); }
    }
  });
}
document.addEventListener('click', e => {                       // tap a team in Rankings / Stats
  if (e.target.closest('input,button,select,a,.sheet')) return;
  const tr = e.target.closest('table[data-source="rankings"] tbody tr, table[data-source="stats"] tbody tr');
  if (tr && tr.dataset.key) openTeam(decodeURIComponent(tr.dataset.key));
});
dash.draw('picks-body', el => {
el.replaceChildren(); if (cbb.failed(el, 'picks')) return;
const ord = f => f === 'STRONG' ? 0 : f === 'Lean' || f === 'Under' ? 1 : f === 'Over' ? 1.6 : f === 'Big' ? 1.5 : 2;
const tipKey = p => { const m = String(p.tip || '').match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return 9999; let h = +m[1] % 12 + (/pm/i.test(m[3]) ? 12 : 0); if (h < 6) h += 24; return h * 60 + +m[2]; };
const rows = cbb.rows('picks').slice().sort((a, b) => tipKey(a) - tipKey(b) || ord(a.flag) - ord(b.flag) || b.edge - a.edge);   // Rex, 11/25: in tip-off order
const dayY = rows.length && rows[0].date ? rexpom.ymdOf(rows[0].date) : '';
const todayRes = new Map((dash.data('tracker').status === 'ok' ? cbb.rows('tracker') : []).filter(t => String(t.ymd) === dayY).map(t => [t.game + '|' + t.type, t]));
{ const bet = rows.filter(p => p.size > 0).map(p => ({ p, t: todayRes.get(p.game + '|' + p.type) })); const done = bet.filter(x => x.t && ['W', 'L', 'P'].includes(x.t.result));
  const w = done.filter(x => x.t.result === 'W').length, l = done.filter(x => x.t.result === 'L').length, pu = done.length - w - l;
  const u = done.reduce((t, x) => t + (x.t.result === 'W' ? x.p.size * 0.909 : x.t.result === 'L' ? -x.p.size : 0), 0), left = bet.length - done.length;
  document.querySelectorAll('.today-rec').forEach(e => { e.replaceChildren(); if (!bet.length) return;
    if (!done.length) { e.textContent = `Today: ${bet.length} picks · none finished yet`; return; }
    const b1 = document.createElement('b'); b1.textContent = `Today: ${w}-${l}${pu ? '-' + pu : ''}`; const b2 = document.createElement('b'); b2.className = u > 0 ? 'ok' : u < 0 ? 'bad' : 'muted'; b2.textContent = cbb.signed(Math.round(u * 100) / 100) + 'u';
    e.append(b1, ' · ', b2, left ? ` · ${left} still to play` : ' · all done'); }); }
for (const p of rows) { const tr = document.createElement('tr'); tr.dataset.key = cbb.key(p.game, p.type); const w = p.flag === 'Watch'; if (p.flag === 'STRONG' && p.tier === 'High') tr.className = 'hl'; else if (w) tr.className = 'watch';
const tk = todayRes.get(p.game + '|' + p.type); if (tk && ['W', 'L', 'P'].includes(tk.result)) tr.classList.add(tk.result === 'W' ? 'res-w' : tk.result === 'L' ? 'res-l' : 'res-p');
cbb.td(tr, p.tip); cbb.td(tr, p.game); const b = cbb.td(tr, p.type === 'Total' ? `${p.bet} · ${String(p.game).replace(' @ ', ' vs ')}` : p.bet); b.style.fontWeight = w ? '400' : '600';   /* totals name the teams (Rex, 11/25) */ { const bt = betTeam(p.bet, p.game); if (bt) b.prepend(teamBadge(bt)); }
{ const q = document.createElement('span'); q.className = 'quick'; const r0 = tk && ['W', 'L', 'P'].includes(tk.result) ? tk.result : '';
  q.textContent = r0 ? (r0 === 'W' ? '✅' : r0 === 'L' ? '❌' : '➖') : `${p.flag === 'STRONG' ? (p.tier === 'High' ? '⭐' : '🔥') : p.flag === 'Under' ? '📉' : p.flag === 'Over' ? '📈' : p.flag === 'Big' ? '🏀' : '👀'} ${p.tip || ''}`; if (r0) q.classList.add(r0 === 'W' ? 'ok' : r0 === 'L' ? 'bad' : 'muted'); b.appendChild(q); }
{ const v = p.clv === '' || p.clv == null || isNaN(+p.clv) ? 0 : +p.clv;   // Rex, 11/25: line move visible without opening the row
  if (v && p.close) { const m = document.createElement('span'); m.className = 'quick qmove ' + (v > 0 ? 'ok' : 'bad'); m.textContent = `${v > 0 ? '✅' : '⚠'} ${p.best_line || '?'}→${p.close}`; b.appendChild(m); } } { const [ga, gh] = String(p.game).split(' @ '); const side = String(p.bet); const opp = side.startsWith(ga) ? `at ${gh}` : side.startsWith(gh) ? `vs ${ga}` : p.game; const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = `${opp} · ${p.tip}`; b.appendChild(sub);
if (tk && (tk.final || ['W', 'L', 'P'].includes(tk.result))) { const fr = document.createElement('div'); fr.className = 'sub final ' + (tk.result === 'W' ? 'ok' : tk.result === 'L' ? 'bad' : 'muted');
  fr.textContent = (tk.result === 'W' ? '✅ Won' : tk.result === 'L' ? '❌ Lost' : tk.result === 'P' ? '➖ Push' : '') + (tk.final ? ' · Final: ' + tk.final : '') + (p.size && tk.result !== 'Pending' ? ` · ${cbb.signed(tk.result === 'W' ? Math.round(p.size * 0.909 * 100) / 100 : tk.result === 'L' ? -p.size : 0)}u` : ''); b.appendChild(fr); }
if (p.sig) { const sp = document.createElement('div'); sp.className = 'sub split ' + (p.sig === 'with' ? 'ok' : p.sig === 'against' ? 'bad' : 'muted'); sp.textContent = splitText(p); b.appendChild(sp); } }
{ const c = cbb.td(tr, p.price ? `${+p.price > 0 ? '+' : ''}${p.price}` : '—', 'num muted'); } { const v = p.clv === '' || p.clv == null || isNaN(+p.clv) ? null : +p.clv; const c = cbb.td(tr, v == null || !p.close ? '—' : (v === 0 ? `${p.close} (no move)` : (v < 0 ? '⚠ ' : '✅ ') + `${p.best_line || '?'} → ${p.close}`), 'num ' + (v < 0 ? 'bad' : v > 0 ? 'ok' : 'muted')); c.title = v == null ? '' : v < 0 ? `Moved ${-v} against us since posted. Skip it if you haven't bet it yet.` : v > 0 ? `Moved ${v} our way since posted (good sign).` : 'No move since posted'; } const z = cbb.td(tr, w ? 'Not counted' : (p.size >= 5 ? '🐋'.repeat(Math.floor(p.size / 5)) + ' ' : '') + d3.format('.1f')(p.size) + 'u', 'num'); z.style.fontWeight = w ? '400' : '600';
cbb.td(tr, p.flag === 'STRONG' ? '🔥 STRONG' : p.flag === 'Big' ? '🏀 Big Game' : p.flag === 'Under' ? '📉 Under' : p.flag === 'Over' ? '📈 Over' : w ? '👀 Watch' : '👍 Lean'); cbb.td(tr, p.tier, cbb.tierCls(p.tier)); cbb.td(tr, cbb.pct(p.chance), 'num'); cbb.td(tr, d3.format('.1f')(p.edge), 'num');
if (rexpom.isOwner) { const c = document.createElement('td'); c.className = 'mine'; c.appendChild(rexpomStakeBox(p)); tr.appendChild(c); }
['c-tip', 'c-game', 'c-bet', 'c-price', 'c-move', 'c-size', 'c-flag', 'c-tier', 'c-chance', 'c-edge'].forEach((k, i) => { const c = tr.children[i]; if (c) c.classList.add(k); });
const lab = { 'c-price': 'DK', 'c-move': 'Line move', 'c-chance': 'Win', 'c-edge': 'Edge', 'c-tier': 'Conf.' };
for (const c of tr.children) for (const k in lab) if (c.classList.contains(k)) c.dataset.label = lab[k];
el.appendChild(tr); { const [aw, hm] = String(p.game).split(' @ '); makeExpandable(tr, 'p|' + p.game + '|' + p.type, aw, hm, p.proj); } }
const nw = rows.filter(p => p.flag === 'Watch').length, btn = document.querySelector('.watch-toggle');
if (btn) { btn.hidden = !nw; btn.textContent = (document.querySelector('.cbb').classList.contains('show-watch') ? 'Hide' : 'Show') + ` 👀 Watch plays (${nw})`; }
});
document.querySelectorAll('.watch-toggle').forEach(b => b.addEventListener('click', () => { document.querySelector('.cbb').classList.toggle('show-watch'); dash.draw('picks-body'); }));
dash.draw('fut-body', el => {
el.replaceChildren(); if (cbb.failed(el, 'futures')) return;
for (const f of cbb.rows('futures')) { const tr = document.createElement('tr'); tr.dataset.key = cbb.key(f.market, f.team);
cbb.td(tr, f.call === 'VALUE' ? '💎 VALUE' : '🚫 AVOID', f.call === 'VALUE' ? 'ok' : 'bad'); cbb.td(tr, f.market); cbb.td(tr, f.team); const z = cbb.td(tr, f.size ? d3.format('.2f')(f.size) + 'u' : 'Pass', f.size ? 'num' : 'num muted'); if (f.size) z.style.fontWeight = '600'; cbb.td(tr, (+f.odds > 0 ? '+' : '') + f.odds, 'num');
cbb.td(tr, cbb.pct(f.vegas_pct), 'num'); cbb.td(tr, cbb.pct(f.our_pct), 'num'); cbb.td(tr, f.tier, cbb.tierCls(f.tier)); el.appendChild(tr); }
});

// ---- track record ----
const SERIES = ['STRONG + High', 'Rexpom picks', 'STRONG', '📉 Unders', '🏀 Big Games', "Rex's Bets", '📈 Overs (8+ edge)'];
const SLAB = { 'STRONG + High': '⭐ Best Bets', 'Rexpom picks': 'Rexpom picks', 'STRONG': 'STRONG', '📉 Unders': '📉 Unders', '📈 Overs (8+ edge)': '📈 Overs (8+)', '🏀 Big Games': '🏀 Big Games', "Rex's Bets": "Rex's Bets (yours)" };
/* series to draw: skip ones with no graded picks yet; when two lines are identical, draw one and label it for both */
function unitSeries() {
  const rows = cbb.rows('daily_units'), byS = s => rows.filter(r => r.group === s).map(r => r.ymd + ':' + r.units).join('|');
  const has = s => rows.some(r => r.group === s && r.n > 0) || rows.some(r => r.group === s && r.units !== 0);
  const out = [];
  SERIES.forEach((s, i) => { if (!has(s)) return; const k = byS(s), twin = out.find(o => o.key === k);
    if (twin) twin.names.push(s); else out.push({ s, i, key: k, names: [s] }); });
  return { out, empty: SERIES.filter(s => !has(s)) };
}
/* Rex, 11/24: tap a legend chip to show or hide a line; phones start with just the three main lines */
let U_HIDDEN = null;
const uHidden = () => { if (U_HIDDEN) return U_HIDDEN; let saved = null; try { saved = JSON.parse(localStorage.getItem('rexpomUnitsHidden') || 'null'); } catch (e) { }
  U_HIDDEN = new Set(saved || ((window.innerWidth || 800) < 560 ? ['STRONG', '📉 Unders', '🏀 Big Games', '📈 Overs (8+ edge)'] : [])); return U_HIDDEN; };
const uLast = s => { const r = cbb.rows('daily_units').filter(q => q.group === s).sort((p, q) => p.ymd < q.ymd ? -1 : 1); return r.length ? r[r.length - 1].units : 0; };
dash.draw('units-legend', el => { el.replaceChildren(); const { out, empty } = unitSeries(); const hid = uHidden();
  out.slice().sort((p, q) => uLast(q.s) - uLast(p.s)).forEach(o => { const sp = document.createElement('button'); sp.type = 'button'; sp.className = 'u-chip' + (hid.has(o.s) ? ' off' : '');
    const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = dash.colors[o.i];
    const v = document.createElement('b'); v.textContent = cbb.signed(uLast(o.s)) + 'u'; v.className = uLast(o.s) >= 0 ? 'ok' : 'bad';
    sp.append(sw, v, ' ' + o.names.map(n => SLAB[n]).join(' = '));
    sp.addEventListener('click', () => { hid.has(o.s) ? hid.delete(o.s) : hid.add(o.s); try { localStorage.setItem('rexpomUnitsHidden', JSON.stringify([...hid])); } catch (e) { } dash.draw('units-legend'); dash.draw('units-chart'); });
    el.appendChild(sp); });
  if (empty.length) { const sp = document.createElement('span'); sp.className = 'muted'; sp.textContent = empty.map(n => SLAB[n]).join(', ') + ': none graded yet'; el.appendChild(sp); } });
dash.draw('units-chart', el => {
el.replaceChildren(); const rows = cbb.rows('daily_units'); if (!rows.length) return;
const W = Math.max(el.clientWidth || 600, 300), narrow = W < 560, H = narrow ? 280 : 300, m = { t: 14, r: narrow ? 14 : 128, b: 30, l: 44 };   // phones: totals listed under the chart
const parse = d3.utcParse('%Y%m%d'), fmt = d3.utcFormat('%b %-d');
const keys = ['0', ...[...new Set(rows.map(r => r.ymd))].sort()];
const label = k => k === '0' ? 'Start' : fmt(parse(k));
const x = d3.scalePoint(keys, [m.l, W - m.r]).padding(0.1);
const val = (s, k) => { if (k === '0') return 0; const r = rows.find(q => q.group === s && q.ymd === k); return r ? r.units : null; };
const vis = unitSeries().out.filter(o => !uHidden().has(o.s)).map(o => o.s); const ext = d3.extent([0, ...rows.filter(r => vis.includes(r.group)).map(r => r.units)]); const y = d3.scaleLinear([Math.min(ext[0], -1), Math.max(ext[1], 1)], [H - m.b, m.t]).nice();
const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).style('overflow', 'visible');
const every = Math.ceil(keys.length / Math.max(2, Math.floor((W - m.l - m.r) / 70)));
svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(keys.filter((k, i) => i % every === 0 || i === keys.length - 1)).tickFormat(label).tickSizeOuter(0)).attr('font-size', null).attr('font-family', null).call(g => g.selectAll('text').attr('fill', 'var(--color-fg-muted)')).call(g => g.selectAll('line,path').attr('stroke', 'var(--cds-chart-axis)'));
svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(v => (v > 0 ? '+' : '') + v + 'u')).attr('font-size', null).attr('font-family', null).call(g => g.select('.domain').remove()).call(g => g.selectAll('text').attr('fill', 'var(--color-fg-muted)')).call(g => g.selectAll('line').attr('x2', W - m.l - m.r).attr('stroke', 'var(--cds-chart-grid)'));
svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
const ends = [];
unitSeries().out.filter(o => !uHidden().has(o.s)).forEach(({ s, i, names }) => { const pts = keys.map(k => [k, val(s, k)]).filter(p => p[1] != null); if (!pts.length) return;
const best = i === 0;
svg.append('path').attr('d', d3.line().x(p => x(p[0])).y(p => y(p[1])).curve(d3.curveLinear)(pts)).attr('fill', 'none').attr('stroke', dash.colors[i]).attr('stroke-dasharray', s === "Rex's Bets" ? '7 4' : null).attr('stroke-width', best || s === "Rex's Bets" ? 3 : 2).attr('stroke-opacity', best ? 1 : 0.85).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
if (!narrow) pts.forEach(p => { if (p[0] === '0') return; svg.append('circle').attr('cx', x(p[0])).attr('cy', y(p[1])).attr('r', 3).attr('fill', dash.colors[i]).append('title').text(`${s === 'STRONG + High' ? 'Best Bets' : s} · ${p[0].slice(4,6)}/${p[0].slice(6)} · ${cbb.signed(p[1])}u`); });
const last = pts[pts.length - 1]; svg.append('circle').attr('cx', x(last[0])).attr('cy', y(last[1])).attr('r', best ? 4 : 3).attr('fill', dash.colors[i]);
ends.push({ i, s, names, v: last[1], y: y(last[1]), x: x(last[0]) }); });
ends.sort((a, b) => a.y - b.y); for (let j = 1; j < ends.length; j++) if (ends[j].y - ends[j - 1].y < 20) ends[j].y = ends[j - 1].y + 20;
for (let j = ends.length - 2; j >= 0; j--) if (ends[j].y > ends[j + 1].y - 20) ends[j].y = ends[j + 1].y - 20;   // keep the stack inside the chart
if (!narrow) { ends.forEach(e => svg.append('text').attr('x', e.x + 8).attr('y', e.y).attr('dy', '0.32em').attr('fill', dash.colors[e.i]).attr('font-weight', e.i === 0 ? 600 : 400).text(`${cbb.signed(e.v)}u ` + e.names.map(n => n === 'STRONG + High' ? '⭐' : n === 'Rexpom picks' ? 'Rexpom' : n === "Rex's Bets" ? 'Rex' : n).join(' = '))); }
else if (false) { const box = document.createElement('div'); box.className = 'u-vals'; ends.slice().sort((p, q) => q.v - p.v).forEach(e => { const d = document.createElement('span'); const sw = document.createElement('i'); sw.style.background = dash.colors[e.i]; d.append(sw, `${cbb.signed(e.v)}u ${e.names.map(n => SLAB[n] || n).join(' = ')}`); box.appendChild(d); }); el.appendChild(box); }
const rule = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', 'var(--color-fg-muted)').attr('stroke-dasharray', '3 3').attr('visibility', 'hidden');
const dots = SERIES.map((s, i) => svg.append('circle').attr('r', 5).attr('fill', dash.colors[i]).attr('stroke', 'var(--color-panel)').attr('stroke-width', 2).attr('visibility', 'hidden'));
const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; el.appendChild(tip);
const hide = () => { tip.hidden = true; rule.attr('visibility', 'hidden'); dots.forEach(d => d.attr('visibility', 'hidden')); };
const show = (ev) => { const [mx] = d3.pointer(ev, svg.node()); const k = keys.reduce((a, b) => Math.abs(x(b) - mx) < Math.abs(x(a) - mx) ? b : a); const scale = el.clientWidth / W;
rule.attr('x1', x(k)).attr('x2', x(k)).attr('visibility', 'visible');
tip.replaceChildren(); const hd = document.createElement('div'); hd.className = 'th'; hd.textContent = k === '0' ? 'Season start' : 'Through ' + label(k); tip.appendChild(hd);
const g = document.createElement('div'); g.className = 'tg';
SERIES.forEach((s, i) => { const v = val(s, k); if (v == null) { dots[i].attr('visibility', 'hidden'); } else dots[i].attr('cx', x(k)).attr('cy', y(v)).attr('visibility', 'visible');
const n = document.createElement('div'); const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = dash.colors[i]; n.append(sw, SLAB[s]);
const t = document.createElement('div'); t.className = 'tv ' + (v > 0 ? 'ok' : v < 0 ? 'bad' : ''); t.textContent = v == null ? '—' : cbb.signed(v) + 'u'; g.append(n, t); });
tip.appendChild(g); tip.hidden = false;
const px = x(k) * scale; let left = px + 14; if (left + tip.offsetWidth > el.clientWidth) left = px - tip.offsetWidth - 14;
tip.style.left = Math.max(0, left) + 'px'; tip.style.top = '6px'; };
svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent').style('touch-action', 'pan-y')
.on('pointermove', show).on('pointerdown', show).on('pointerleave', hide);
});

/* click-to-sort for the Record by group and Every pick tables (click again to flip, third click resets) */
const TBL_SORT = { record: null, tracker: null };
const SORT_KEY = {
  record: { group: r => r.group, record: r => parseInt(r.record) || 0, win_pct: r => r.win_pct, units: r => r.units, expected: r => r.expected, clv: r => r.clv, beat: r => r.beat },
  tracker: { date: p => p.ymd, game: p => p.game, bet: p => p.bet, flag: p => ({ STRONG: 3, Lean: 2, Under: 2, Over: 1, Big: 1, Watch: 0 })[p.flag] ?? -1, tier: p => ({ High: 2, Medium: 1, Low: 0 })[p.tier] ?? -1,
    chance: p => p.chance, result: p => ({ W: 3, P: 2, L: 1 })[p.result] ?? 0, risk: p => p.risk, units: p => p.units, final: p => p.final, clv: p => p.clv }
};
function applySort(tbl, rows) {
  const st = TBL_SORT[tbl]; if (!st) return rows;
  const k = SORT_KEY[tbl][st.f]; if (!k) return rows;
  return rows.slice().sort((a, b) => { const x = k(a), y = k(b); const nx = x == null || (typeof x === 'number' && isNaN(x)), ny = y == null || (typeof y === 'number' && isNaN(y));
    if (nx || ny) return nx - ny; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * st.dir; });
}
document.querySelectorAll('table.sort-tbl').forEach(t => t.querySelectorAll('th.sortable').forEach(th => th.addEventListener('click', () => {
  const tbl = t.dataset.tbl, f = th.dataset.field, st = TBL_SORT[tbl];
  TBL_SORT[tbl] = !st || st.f !== f ? { f, dir: ['group', 'game', 'bet', 'final'].includes(f) ? 1 : -1 } : st.dir === (['group', 'game', 'bet', 'final'].includes(f) ? 1 : -1) ? { f, dir: -st.dir } : null;
  t.querySelectorAll('th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
  if (TBL_SORT[tbl]) th.classList.add(TBL_SORT[tbl].dir > 0 ? 'sorted-asc' : 'sorted-desc');
  dash.draw(tbl === 'record' ? 'record-body' : 'trk-body');
})));
dash.draw('record-body', el => {
el.replaceChildren(); if (cbb.failed(el, 'record')) return;
for (const r of applySort('record', cbb.rows('record').filter(r => r.n > 0 || r.group === 'STRONG + High'))) { const tr = document.createElement('tr'); tr.dataset.key = r.group; if (r.group === 'STRONG + High') tr.className = 'hl'; else if (r.group === 'Current rules (backtest)') tr.style.fontStyle = 'italic';
cbb.td(tr, r.group === 'STRONG + High' ? '⭐ Best Bets (Strong+High)' : r.group); cbb.td(tr, r.record); cbb.td(tr, cbb.pct(r.win_pct), 'num'); cbb.td(tr, cbb.signed(r.units), 'num ' + (r.units >= 0 ? 'ok' : 'bad')); cbb.td(tr, cbb.pct(r.expected), 'num muted');
cbb.td(tr, r.clv == null ? '—' : (r.clv > 0 ? '+' : '') + d3.format('.2f')(r.clv), 'num ' + (r.clv > 0 ? 'ok' : r.clv < 0 ? 'bad' : 'muted')); cbb.td(tr, r.beat == null ? '—' : cbb.pct(r.beat), 'num'); el.appendChild(tr); }
});
let trkFilter = '';
document.querySelectorAll('.trk-filter').forEach(s => s.addEventListener('change', () => { trkFilter = s.value; dash.draw('trk-body'); }));
dash.draw('trk-body', el => {
el.replaceChildren(); if (cbb.failed(el, 'tracker')) return;
let rows = cbb.rows('tracker').slice().sort((a, b) => String(b.ymd).localeCompare(String(a.ymd)) || b.edge - a.edge);
if (trkFilter.startsWith('g:')) { const g = (window.REC_GROUPS || []).find(x => x[0] === trkFilter.slice(2)); if (g) rows = rows.filter(g[1]); }
else if (trkFilter === 'sh') rows = rows.filter(p => p.flag === 'STRONG' && p.tier === 'High'); else if (trkFilter === 'Pending') rows = rows.filter(p => p.result === 'Pending'); else if (trkFilter) rows = rows.filter(p => p.flag === trkFilter);
rows = applySort('tracker', rows);
{ const cnt = trkFilter === '' ? rows.filter(p => p.flag !== 'Watch') : rows; const w = cnt.filter(p => p.result === 'W').length, l = cnt.filter(p => p.result === 'L').length, pu = cnt.filter(p => p.result === 'P').length, u = cnt.reduce((t, p) => t + (p.units || 0), 0), pend = cnt.filter(p => p.result === 'Pending').length;
  document.querySelectorAll('.trk-rec').forEach(e => { e.replaceChildren(); const b = document.createElement('b'); b.textContent = `${w}-${l}${pu ? '-' + pu : ''}`; const uu = document.createElement('b'); uu.className = u > 0 ? 'ok' : u < 0 ? 'bad' : 'muted'; uu.textContent = cbb.signed(Math.round(u * 100) / 100) + 'u';
    e.append(b, ' · ', uu, ` · ${w + l ? Math.round(1000 * w / (w + l)) / 10 : 0}% wins` + (pend ? ` · ${pend} pending` : '')); }); }   // Rex, 11/24: record for whatever's shown
document.querySelectorAll('.trk-filter').forEach(sel => { if (sel.dataset.groups) return; sel.dataset.groups = '1';
  const og = document.createElement('optgroup'); og.label = 'Record by group rows';
  for (const [n] of (window.REC_GROUPS || [])) { if (n === 'STRONG + High') continue; const o = document.createElement('option'); o.value = 'g:' + n; o.textContent = n; og.appendChild(o); }
  sel.appendChild(og); });
for (const p of rows) { const tr = document.createElement('tr'); tr.dataset.key = cbb.key(p.ymd, p.game, p.type); if (p.flag === 'STRONG' && p.tier === 'High') tr.className = 'hl'; else if (p.flag === 'Watch') tr.className = 'watch';
cbb.td(tr, p.date); cbb.td(tr, p.game); cbb.td(tr, p.bet); cbb.td(tr, p.flag === 'STRONG' ? '🔥 STRONG' : p.flag === 'Watch' ? '👀 Watch' : p.flag === 'Big' ? '🏀 Big Game' : p.flag === 'Under' ? '📉 Under' : p.flag === 'Over' ? '📈 Over' : '👍 Lean'); cbb.td(tr, p.tier, cbb.tierCls(p.tier));
cbb.td(tr, isNaN(p.chance) || !p.chance ? '—' : cbb.pct(p.chance), 'num'); cbb.td(tr, p.result === 'W' ? '✅ W' : p.result === 'L' ? '❌ L' : p.result === 'P' ? '➖ P' : '⏳ Pending', p.result === 'W' ? 'ok' : p.result === 'L' ? 'bad' : 'muted');
cbb.td(tr, d3.format('.1f')(p.risk), 'num muted'); cbb.td(tr, p.units == null ? '' : cbb.signed(p.units), 'num'); cbb.td(tr, p.final, 'muted');
{ const c = cbb.td(tr, p.clv == null ? '' : (p.clv > 0 ? '+' : '') + d3.format('.1f')(p.clv), 'num ' + (p.clv > 0 ? 'ok' : p.clv < 0 ? 'bad' : 'muted')); if (p.close) c.title = 'Closed at ' + p.close; }
el.appendChild(tr); }
});
dash.draw('bets-body', el => {
el.replaceChildren(); if (cbb.failed(el, 'bets')) return;
for (const b of cbb.rows('bets').slice().reverse()) { const tr = document.createElement('tr'); tr.dataset.key = cbb.key(b.date, b.bet);
cbb.td(tr, b.date); cbb.td(tr, b.bet); cbb.td(tr, b.source, 'muted'); cbb.td(tr, b.stake == null ? '' : d3.format('.2f')(b.stake) + 'u · ' + b.odds, 'num');
cbb.td(tr, b.result === 'W' ? '✅ W' : b.result === 'L' ? '❌ L' : b.result === 'P' ? '➖ P' : '⏳ Pending', b.result === 'W' ? 'ok' : b.result === 'L' ? 'bad' : 'muted'); cbb.td(tr, b.pl == null ? '' : cbb.signed(b.pl) + 'u', 'num ' + (b.pl > 0 ? 'ok' : b.pl < 0 ? 'bad' : ''));
if (rexpom.isOwner) tr.appendChild(rexpomBetControls(b, tr));
el.appendChild(tr); }
if (rexpom.isOwner) rexpomKeepGrades(cbb.rows('bets'));
});

// ---- rankings ----
let rkSort = { key: 'rank', dir: 1 }, rkQ = '', rkConf = '', rkAp = false;
document.querySelectorAll('.rk-ap').forEach(c => c.addEventListener('change', () => { rkAp = c.checked; if (rkAp && rkSort.key === 'rank') { rkSort = { key: 'ap', dir: 1 }; } else if (!rkAp && rkSort.key === 'ap') { rkSort = { key: 'rank', dir: 1 }; } dash.draw('rk-body'); }));
const LOWBEST = ['rank', 'ap', 'kenpom', 'torvik', 'def', 'oefg', 'to', 'team', 'conf'];
document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
const k = th.dataset.sort; rkSort = rkSort.key === k ? { key: k, dir: -rkSort.dir } : { key: k, dir: LOWBEST.includes(k) ? 1 : -1 };
document.querySelectorAll('th[data-sort]').forEach(h => h.setAttribute('aria-sort', h.dataset.sort === rkSort.key ? (rkSort.dir > 0 ? 'ascending' : 'descending') : 'none'));
dash.draw('rk-body');
}));
document.querySelectorAll('.rk-search').forEach(i => i.addEventListener('input', () => { rkQ = i.value.trim().toLowerCase(); dash.draw('rk-body'); }));
dash.draw('rk-conf', sel => {
const confs = [...new Set(cbb.rows('rankings').map(r => r.conf))].filter(Boolean).sort();
sel.replaceChildren(new Option('All conferences', ''), ...confs.map(c => new Option(c, c))); sel.value = rkConf;
sel.onchange = () => { rkConf = sel.value; dash.draw('rk-body'); };
});
dash.draw('rk-body', el => {
el.replaceChildren(); if (cbb.failed(el, 'rankings')) return;
let rows = cbb.rows('rankings').filter(r => (!rkQ || String(r.team).toLowerCase().includes(rkQ)) && (!rkConf || r.conf === rkConf) && (!rkAp || r.ap));
const k = rkSort.key, d = rkSort.dir; rows = rows.slice().sort((a, b) => { const va = a[k], vb = b[k]; if (va == null || va === '') return 1; if (vb == null || vb === '') return -1; return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * d; });
const f1 = v => v == null ? '—' : d3.format('.1f')(v);
for (const r of rows) { const tr = document.createElement('tr'); tr.dataset.key = r.team; if (r.ap) tr.className = 'ap';
{ const c = cbb.td(tr, String(r.rank), 'num');
  if (r.move) { const m = document.createElement('span'); m.className = 'mv ' + (r.move > 0 ? 'up' : 'down'); m.textContent = (r.move > 0 ? '▲' : '▼') + Math.abs(r.move); m.title = (r.move > 0 ? 'Up ' : 'Down ') + Math.abs(r.move) + ' since the previous day'; c.append(m); } }
const apc = cbb.td(tr, '', 'num'); if (r.ap) { apc.textContent = ''; const b = document.createElement('span'); b.className = 'apb'; b.textContent = r.ap; apc.appendChild(b); } cbb.td(tr, r.kenpom ?? '', 'num'); cbb.td(tr, r.torvik ?? '', 'num muted');
const t = cbb.td(tr, r.team); t.style.fontWeight = '600'; cbb.td(tr, r.conf, 'muted'); cbb.td(tr, r.record); cbb.td(tr, r.conf_record ?? '', 'muted');
cbb.td(tr, r.net == null ? '—' : (r.net > 0 ? '+' : '') + d3.format('.1f')(r.net), 'num ' + (r.net >= 0 ? 'ok' : 'bad')); cbb.td(tr, f1(r.off), 'num'); cbb.td(tr, f1(r.def), 'num'); cbb.td(tr, f1(r.pace), 'num');
cbb.td(tr, f1(r.efg), 'num'); cbb.td(tr, f1(r.oefg), 'num'); cbb.td(tr, f1(r.to), 'num'); cbb.td(tr, f1(r.orb), 'num'); cbb.td(tr, f1(r.p3), 'num');
cbb.td(tr, r.conf_tier, cbb.tierCls(r.conf_tier)); cbb.td(tr, r.champ == null ? '—' : cbb.pct(r.champ), 'num'); cbb.td(tr, r.vegas == null ? '—' : cbb.pct(r.vegas), 'num muted'); el.appendChild(tr); }
});

// ---- stats ----
let stSort = { key: 'rank', dir: 1 }, stQ = '', stConf = '';
const ST_LOW = ['efg_d', 'ftr_d', 'drb', 'to', 'p3_d', 'p2_d'], ST_NOSHADE = ['rank', 'sos', 'ncsos', 'p3rate', 'p3rate_d'];
const ST_OFF = ['efg', 'to', 'orb', 'ftr', 'p3', 'p2', 'ft', 'p3rate', 'arate'], ST_DEF = ['efg_d', 'to_d', 'drb', 'ftr_d', 'p3_d', 'p2_d', 'p3rate_d'], ST_SCH = ['sos', 'ncsos', 'wab'];
const ST_COLS = [...ST_OFF, ...ST_DEF, ...ST_SCH], ST_G = c => ST_OFF.includes(c) ? 'g-off' : ST_DEF.includes(c) ? 'g-def' : 'g-sch';
document.querySelectorAll('[data-stview]').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.st-table').forEach(t => { t.dataset.view = b.dataset.stview; }); document.querySelectorAll('[data-stview]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
document.querySelectorAll('th[data-ssort]').forEach(th => th.addEventListener('click', () => {
const k = th.dataset.ssort; stSort = stSort.key === k ? { key: k, dir: -stSort.dir } : { key: k, dir: ['rank', 'team', 'conf', ...ST_LOW].includes(k) ? 1 : -1 };
document.querySelectorAll('th[data-ssort]').forEach(h => h.setAttribute('aria-sort', h.dataset.ssort === stSort.key ? (stSort.dir > 0 ? 'ascending' : 'descending') : 'none'));
dash.draw('st-body');
}));
document.querySelectorAll('.st-search').forEach(i => i.addEventListener('input', () => { stQ = i.value.trim().toLowerCase(); dash.draw('st-body'); }));
dash.draw('st-conf', sel => {
const confs = [...new Set(cbb.rows('stats').map(r => r.conf))].filter(Boolean).sort();
sel.replaceChildren(new Option('All conferences', ''), ...confs.map(c => new Option(c, c))); sel.value = stConf;
sel.onchange = () => { stConf = sel.value; dash.draw('st-body'); };
});
const stFmt = (k, v) => v == null || isNaN(v) ? '—' : k === 'wab' ? (v > 0 ? '+' : '') + d3.format('.1f')(v) : Math.abs(v) < 2 ? d3.format('.3f')(v) : d3.format('.1f')(v);
dash.draw('st-body', el => {
el.replaceChildren(); if (cbb.failed(el, 'stats')) return;
const all = cbb.rows('stats');
if (!all.length) { const tr = document.createElement('tr'); const c = document.createElement('td'); c.colSpan = 23; c.className = 'muted'; c.textContent = dash.data('stats').status === 'ok' ? 'No stats in the feed yet: press ↻ Refresh, or wait for the next model run.' : 'Loading…'; tr.appendChild(c); el.appendChild(tr); return; }
const pctl = {}; for (const k of ST_COLS) { const vs = all.map(r => r[k]).filter(v => v != null && !isNaN(v)).sort((a, b) => a - b); pctl[k] = v => vs.length > 1 ? d3.bisectLeft(vs, v) / (vs.length - 1) : 0.5; }
let rows = all.filter(r => (!stQ || String(r.team).toLowerCase().includes(stQ)) && (!stConf || r.conf === stConf));
const k = stSort.key, d = stSort.dir; rows = rows.slice().sort((a, b) => { const va = a[k], vb = b[k]; if (va == null || va === '') return 1; if (vb == null || vb === '') return -1; return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * d; });
for (const r of rows) { const tr = document.createElement('tr'); tr.dataset.key = r.team;
cbb.td(tr, r.rank ?? '', 'num muted'); const t = cbb.td(tr, r.team); t.style.fontWeight = '600'; cbb.td(tr, r.conf, 'muted'); cbb.td(tr, r.record);
for (const c of ST_COLS) { const v = r[c]; const td = cbb.td(tr, stFmt(c, v), 'num ' + ST_G(c));
if (v != null && !isNaN(v) && !ST_NOSHADE.includes(c)) { let p = pctl[c](v); if (ST_LOW.includes(c)) p = 1 - p; const a = Math.round(Math.max(0, Math.abs(p - 0.5) * 2 - 0.2) * 40);
if (a > 0) td.style.background = `color-mix(in srgb, var(${p > 0.5 ? '--color-ok' : '--color-bad'}) ${a}%, transparent)`; } }
el.appendChild(tr); }
});

// ---- matchup predictor ----
let muA = '', muB = '', muSite = 'n';
const phi = z => { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2); const e = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2); return 0.5 * (1 + (z < 0 ? -e : e)); };
dash.draw('mu-pick', box => {
const rk = cbb.rows('rankings').filter(r => r.off != null && r.def != null).slice().sort((a, b) => a.team.localeCompare(b.team)); if (!rk.length) return;
const byRank = rk.slice().sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
if (!rk.some(r => r.team === muA)) muA = byRank[0].team; if (!rk.some(r => r.team === muB)) muB = byRank[1] ? byRank[1].team : byRank[0].team;
const opts = () => rk.map(r => new Option(`${r.team}${r.rank ? '  (#' + r.rank + ')' : ''}`, r.team));
const a = box.querySelector('.mu-a'), b = box.querySelector('.mu-b'), s = box.querySelector('.mu-site');
a.replaceChildren(...opts()); b.replaceChildren(...opts()); a.value = muA; b.value = muB; s.value = muSite;
a.onchange = () => { muA = a.value; dash.draw('mu-out'); }; b.onchange = () => { muB = b.value; dash.draw('mu-out'); }; s.onchange = () => { muSite = s.value; dash.draw('mu-out'); };
});
dash.draw('mu-out', el => {
el.replaceChildren(); if (dash.data('rankings').status === 'error') { el.textContent = 'Failed to load'; return; }
const rk = cbb.rows('rankings'), K = cbb.rows('model_constants')[0]; const A = rk.find(r => r.team === muA), B = rk.find(r => r.team === muB);
if (!A || !B || !K) { el.textContent = '—'; return; }
if (A.team === B.team) { el.textContent = 'Pick two different teams.'; return; }
const tA = A.tempo ?? A.pace ?? K.avg_tempo, tB = B.tempo ?? B.pace ?? K.avg_tempo;
const poss = tA * tB / K.avg_tempo; const hA = muSite === 'a' ? K.hca : muSite === 'b' ? -K.hca : 0;
const ptsA = poss * (A.off + B.def - K.mu + hA) / 100, ptsB = poss * (B.off + A.def - K.mu - hA) / 100;
const gsig = poss / 100 * Math.sqrt((A.sig || 0) ** 2 + (B.sig || 0) ** 2); const pA = phi((ptsA - ptsB) / Math.sqrt(K.game_sd ** 2 + gsig ** 2));
const f1 = d3.format('.1f'); const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const where = muSite === 'n' ? 'Neutral site' : `at ${muSite === 'a' ? A.team : B.team}`;
const sc = mk('div', 'mu-score');
const side = (T, pts, p) => { const d = mk('div'); d.append(mk('div', 'nm', T.team), mk('div', 'pts', Math.round(pts)), mk('div', 'win', `${Math.round(p * 100)}% to win`)); if (p > 0.5) d.querySelector('.pts').classList.add('ok'); return d; };
sc.append(side(A, ptsA, pA), mk('div', 'muted', where), side(B, ptsB, 1 - pA)); el.appendChild(sc);
const bar = mk('div', 'mu-bar'); const ba = mk('div'); ba.style.width = (pA * 100) + '%'; ba.style.background = dash.colors[0]; const bb = mk('div'); bb.style.flex = '1'; bb.style.background = dash.colors[1]; bar.append(ba, bb); el.appendChild(bar);
const fav = ptsA >= ptsB ? A : B, mar = Math.abs(ptsA - ptsB);
const facts = mk('div', 'mu-facts'); const fact = (big, lab) => { const d = mk('div'); d.append(mk('b', null, big), mk('span', null, lab)); facts.appendChild(d); };
fact(mar < 0.5 ? 'Pick’em' : `${fav.team} −${f1(mar)}`, 'Predicted spread'); fact(f1(ptsA + ptsB), 'Predicted total'); fact(`${Math.round(Math.max(pA, 1 - pA) * 100)}%`, `${fav.team} win chance`); fact(f1(poss), 'Possessions');
el.appendChild(facts);
const st = new Map(cbb.rows('stats').map(r => [r.team, r])); const sA = st.get(A.team) || {}, sB = st.get(B.team) || {};
const ROWS = [['Our rank', A.rank, B.rank, 'low', 0], ['AP', A.ap, B.ap, 'low', 0], ['KenPom', A.kenpom, B.kenpom, 'low', 0], ['Record', A.record, B.record, '', 0], ['Net rating', A.net, B.net, 'high', 1], ['Offense', A.off, B.off, 'high', 1], ['Defense', A.def, B.def, 'low', 1], ['Tempo', tA, tB, '', 1],
['eFG%', sA.efg, sB.efg, 'high', 1], ['Opp eFG%', sA.efg_d, sB.efg_d, 'low', 1], ['TO%', sA.to, sB.to, 'low', 1], ['Forced TO%', sA.to_d, sB.to_d, 'high', 1], ['Off Reb%', sA.orb, sB.orb, 'high', 1], ['Opp Off Reb%', sA.drb, sB.drb, 'low', 1], ['FT rate', sA.ftr, sB.ftr, 'high', 1], ['3P%', sA.p3, sB.p3, 'high', 1], ['Opp 3P%', sA.p3_d, sB.p3_d, 'low', 1], ['WAB', sA.wab, sB.wab, 'high', 1]];
const tbl = mk('table'); const th = mk('thead'); const hr = mk('tr'); hr.append(mk('th', 'num', A.team), mk('th', null, ''), mk('th', null, B.team)); th.appendChild(hr); tbl.appendChild(th); const tb = mk('tbody');
for (const [lab, va, vb, dir, dec] of ROWS) { const tr = mk('tr'); const show = v => v == null || v === '' ? '—' : typeof v === 'number' ? (dec ? f1(v) : v) : v;
const num = typeof va === 'number' && typeof vb === 'number' && va !== vb; const aBetter = num && (dir === 'high' ? va > vb : dir === 'low' ? va < vb : false), bBetter = num && dir && !aBetter;
tr.append(mk('td', 'num' + (aBetter ? ' better' : ''), show(va)), mk('td', 'muted', lab), mk('td', bBetter ? 'better' : '', show(vb))); tr.children[1].style.textAlign = 'center'; tb.appendChild(tr); }
tbl.appendChild(tb); el.appendChild(tbl);
el.appendChild(mk('p', 'note', 'Green marks the better number in each row. A prediction, not a guarantee: one game swings about 11 points either way.'));
});

// ---- stat descriptions on hover (Rankings and Stats headers) ----
const STAT_TIPS = {"rank": "Our rank, by Net Rating. ▲/▼ = places moved since the previous day.", "ap": "This week's AP poll rank (Top 25 only).", "kenpom": "KenPom's rank.", "torvik": "Bart Torvik's T-Rank.", "team": "Team name.", "conf": "Conference.", "record": "Wins–losses this season.", "conf_record": "Conference wins–losses.", "net": "Net Rating: points per 100 possessions better than an average D-I team (offense minus defense).", "off": "Adjusted offense: points scored per 100 possessions against an average defense. Higher is better.", "def": "Adjusted defense: points allowed per 100 possessions against an average offense. Lower is better.", "pace": "Possessions per 40 minutes. Higher means a faster team.", "efg": "Effective FG%: field-goal % with made threes counted as 1.5 baskets. Higher is better.", "oefg": "Opponents' effective FG%. Lower is better.", "efg_d": "Opponents' effective FG%. Lower is better.", "to": "Turnover %: share of possessions that end in a turnover. Lower is better.", "to_d": "Forced turnover %: share of opponents' possessions that end in a turnover. Higher is better.", "orb": "Offensive rebound %: share of our own missed shots we rebound. Higher is better.", "drb": "Opponents' offensive rebound %: share of their misses they get back. Lower is better.", "ftr": "Free-throw rate: free throws attempted per field-goal attempt. Higher is better.", "ftr_d": "Opponents' free-throw rate. Lower is better.", "p3": "3-point %. Higher is better.", "p3_d": "Opponents' 3-point %. Lower is better.", "p2": "2-point %. Higher is better.", "p2_d": "Opponents' 2-point %. Lower is better.", "ft": "Free-throw %. Higher is better.", "p3rate": "Share of shot attempts taken from three. A style stat, not good or bad.", "p3rate_d": "Share of opponents' shots taken from three. A style stat, not good or bad.", "arate": "Assist rate: share of made baskets that were assisted.", "sos": "Strength of schedule so far (Torvik). Higher means a tougher schedule.", "ncsos": "Non-conference strength of schedule. Higher means tougher.", "wab": "Wins above bubble: wins compared with what a bubble team would have against this schedule.", "conf_tier": "How much data backs our rating for this team: High, Medium or Low.", "champ": "Our chance to win the national title, from 10,000 simulated seasons.", "vegas": "Title chance implied by DraftKings odds."};
const htip = document.createElement('div'); htip.className = 'htip'; htip.hidden = true; document.querySelector('.cbb').appendChild(htip);
let htipTimer = null;
const showTip = th => { const t = STAT_TIPS[th.dataset.field]; if (!t) return; htip.textContent = t; htip.hidden = false; const r = th.getBoundingClientRect(); const w = htip.offsetWidth;
htip.style.left = Math.max(4, Math.min(r.left + r.width / 2 - w / 2, document.documentElement.clientWidth - w - 4)) + 'px'; htip.style.top = (r.bottom + 6) + 'px'; };
document.querySelectorAll('table[data-source="rankings"] th[data-field], table[data-source="stats"] th[data-field]').forEach(th => { if (!STAT_TIPS[th.dataset.field]) return; th.classList.add('has-tip');
th.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') showTip(th); }); th.addEventListener('pointerleave', () => { htip.hidden = true; });
th.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { showTip(th); clearTimeout(htipTimer); htipTimer = setTimeout(() => { htip.hidden = true; }, 2500); } }); });
document.querySelectorAll('.scroll').forEach(s => s.addEventListener('scroll', () => { htip.hidden = true; }, { passive: true }));

// ---- upcoming ----
let upDay = '';
dash.draw('up-day', sel => {
const days = [...new Set(cbb.rows('upcoming').map(r => r.date))];
if (!days.includes(upDay)) upDay = days[0] || '';
sel.replaceChildren(...days.map(d => new Option(d, d))); sel.value = upDay;
sel.onchange = () => { upDay = sel.value; dash.draw('up-body'); };
});
dash.draw('up-body', el => {
el.replaceChildren(); if (cbb.failed(el, 'upcoming')) return;
const all = cbb.rows('upcoming'); const day = upDay || (all[0] && all[0].date);
for (const g of all.filter(r => r.date === day)) { const tr = document.createElement('tr'); tr.dataset.key = cbb.key(g.date, g.away, g.home);
cbb.td(tr, `${g.away} ${g.neutral === 'yes' ? 'vs' : '@'} ${g.home}`); const close = g.fav_pct < 60; const p = cbb.td(tr, (close ? '🔥 ' : '') + g.pick); p.style.fontWeight = '600';
cbb.td(tr, g.score, 'muted'); cbb.td(tr, d3.format('.0f')(g.fav_pct) + '%', 'num'); cbb.td(tr, g.tier, cbb.tierCls(g.tier)); cbb.td(tr, g.trank, 'muted'); el.appendChild(tr);
makeExpandable(tr, 'u|' + g.date + '|' + g.away + '|' + g.home, g.away, g.home, g.score); }
});

/* ---- search box on every table + phone card layout (Rex, 11/17) ---- */
(function () {
  const CARD = new Set(['record', 'tracker', 'bets', 'futures', 'upcoming']);   // shown as cards on phones
  const words = s => s.toLowerCase().split(/\s+/).filter(Boolean);
  function labels(tbl) {
    const hs = [...(tbl.tHead ? tbl.tHead.rows[0].cells : [])].map(th => th.textContent.trim());
    for (const tr of tbl.tBodies[0] ? tbl.tBodies[0].rows : []) {
      if (tr.classList.contains('detail')) continue;
      [...tr.cells].forEach((td, i) => { if (!td.dataset.label && hs[i]) td.dataset.label = hs[i]; });
    }
  }
  function filter(tbl) {
    const q = words(tbl._q || ''); let show = true;
    for (const tr of tbl.tBodies[0] ? tbl.tBodies[0].rows : []) {
      if (tr.classList.contains('detail')) { tr.classList.toggle('srch-hide', !show); continue; }
      const t = tr.textContent.toLowerCase(); show = q.every(w => t.includes(w));
      tr.classList.toggle('srch-hide', !show);
    }
    if (tbl._count) { const n = [...tbl.tBodies[0].rows].filter(r => !r.classList.contains('detail') && !r.classList.contains('srch-hide')).length;
      tbl._count.textContent = q.length ? `${n} match${n === 1 ? '' : 'es'}` : ''; }
  }
  document.querySelectorAll('.cbb table[data-source]').forEach(tbl => {
    const src = tbl.dataset.source;
    if (CARD.has(src)) tbl.classList.add('m-card'); else if (src !== 'picks') tbl.classList.add('m-scroll');
    const hasOwn = src === 'rankings' || src === 'stats';                       // these already have a search box
    if (!hasOwn) {
      const bar = document.createElement('div'); bar.className = 'tbl-search';
      const inp = document.createElement('input'); inp.type = 'search'; inp.placeholder = '🔍 Search this table (team, bet, date…)'; inp.setAttribute('aria-label', 'Search this table');
      const cnt = document.createElement('span'); cnt.className = 'muted'; tbl._count = cnt;
      bar.append(inp, cnt);
      (tbl.closest('.scroll, .tbl-wrap') || tbl).before(bar);
      inp.addEventListener('input', () => { tbl._q = inp.value; filter(tbl); if (inp.value.trim()) tbl.classList.add('show-all'); tbl._more && tbl._more(); });
    }
    const tb = tbl.tBodies[0];
    if (tbl.classList.contains('m-card')) {
      const more = document.createElement('button'); more.type = 'button'; more.className = 'more-rows';
      (tbl.closest('.scroll, .tbl-wrap') || tbl).after(more);
      more.onclick = () => { tbl.classList.toggle('show-all'); tbl._more(); };
      tbl._more = () => { const n = tb ? [...tb.rows].filter(r => !r.classList.contains('srch-hide') && !r.classList.contains('detail')).length : 0;
        more.hidden = n <= 25 || (tbl._q || '').trim() !== ''; more.textContent = tbl.classList.contains('show-all') ? 'Show fewer' : `Show all ${n}`; };
    }
    const COMPACT = { record: [0, 1, 3], tracker: [0, 2, 6, 8], bets: [0, 1, 4, 5] }[src];   // Rex, 11/24: thin rows on phones, tap to expand
    if (COMPACT && tbl.classList.contains('m-card')) {
      tbl.classList.add('compact');
      tb && tb.addEventListener('click', ev => { if (ev.target.closest('button, input, select, a, textarea')) return; const tr = ev.target.closest('tr'); if (tr && !tr.classList.contains('detail')) tr.classList.toggle('open'); });
    }
    const mark = () => { if (!COMPACT || !tb) return; for (const tr of tb.rows) [...tr.cells].forEach((c, i) => c.classList.toggle('c-show', COMPACT.includes(i))); };
    const run = () => { mark(); labels(tbl); filter(tbl); if ((tbl._q || '').trim()) tbl.classList.add('show-all'); tbl._more && tbl._more(); };
    if (tb) new MutationObserver(run).observe(tb, { childList: true });
    run();
  });
})();

/* ---- parlay of the day (Rex, 11/18) ---- */
(function () {
  const sgn = v => (v > 0 ? '+' : '') + v;
  const pct = p => Math.round(100 * p) + '%';
  const amer = p => p <= 0 || p >= 1 ? '—' : p >= 0.5 ? String(Math.round(-100 * p / (1 - p))) : '+' + Math.round(100 * (1 - p) / p);
  const dec = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
  // ---- swaps: when a leg's line moves against us, offer the next-best big-game legs not already in the parlay ----
  const K = 0.22, SIG = 11.4;
  const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  const P = z => 0.5 * (1 + erf(z / Math.SQRT2));
  function candidates(used, o = {}) {
    const CUSH = o.cushion ?? 6, MINE = o.minEdge ?? 4, ML = o.ml ?? true;
    const best = new Map();
    for (const r of cbb.rows('parlay')) {
      const edge = r.margin + r.line; if (!(edge >= MINE) || !(edge > 0) || Math.abs(r.line) > 15 || used.has(r.game)) continue;
      const adj = -r.line + K * edge, win = P(adj / SIG);
      let leg;
      if (ML && r.ml != null && r.ml <= -150 && win * dec(r.ml) - 1 > 0.02) leg = { kind: 'ML', bet: `${r.team} ML (${sgn(r.ml)})`, price: r.ml, p: win };
      else { const L = r.line + CUSH; leg = { kind: 'Spread', bet: Math.abs(L) === 0.5 ? `${r.team} ML` : `${r.team} ${sgn(L)} (alt)`, price: null, p: P((adj + L) / SIG) }; }
      Object.assign(leg, { team: r.team, opp: r.opp, game: r.game, edge: Math.round(edge * 10) / 10, dk_line: r.line, now_line: r.line,
        now_ml: r.ml, total: r.total, proj: r.proj, tip: r.tip, fair: amer(leg.p), swapped: true });
      if (!best.has(r.game) || best.get(r.game).edge < leg.edge) best.set(r.game, leg);
    }
    return [...best.values()].sort((x, y) => y.edge - x.edge);
  }
  // swaps are saved per parlay per day: in the site's storage (survives reopening the app), else this browser, else this visit
  const swapGet = key => { const st = window._swapStore || {}; if (st[key]) return Object.assign({}, st[key]); try { return JSON.parse(localStorage.getItem('rexpom-' + key) || '{}'); } catch (e) { return (window._swapMem || {})[key] || {}; } };
  const swapSet = (key, s, card) => { window._swapMem = Object.assign(window._swapMem || {}, { [key]: s }); window._swapStore = Object.assign({}, window._swapStore || {}, { [key]: s });
    try { localStorage.setItem('rexpom-' + key, JSON.stringify(s)); } catch (e) { }
    if (rexpom.db && rexpom.isOwner) rexpom.db.doc('prefs/swaps').set(window._swapStore).catch(() => { });
    if (rexpom.syncFriends) rexpom.syncFriends();
    dash.draw(card); };
  const swapKey = () => 'potd-' + ((cbb.rows('potd_hist')[0] || {}).ymd || '');
  const getSwaps = () => swapGet(swapKey());
  const setSwaps = s => swapSet(swapKey(), s, 'potd-card');
  const movedAgainst = r => !r.res && r.now_line != null && (r.kind === 'ML'
    ? (r.now_ml != null && r.price != null && ((x => x < 0 ? -x / (-x + 100) : 100 / (x + 100))(r.now_ml) - (x => x < 0 ? -x / (-x + 100) : 100 / (x + 100))(r.price)) <= -0.02)
    : r.dk_line - r.now_line <= -1);

  // Rex, 11/27: any open leg can be swapped; legs that moved against us show the choices right away, others behind a small "⇄ Swap" button
  const swapBox = (alts, pick, open) => {
    const box = document.createElement('div'); box.className = 'pl-swaps owner-only';
    const list = document.createElement('div'); list.hidden = !open;
    for (const c of alts) { const sb = document.createElement('button'); sb.type = 'button'; sb.className = 'mini'; sb.textContent = `Swap → ${legName(c.bet)} (${pct(c.p)})`;
      sb.onclick = ev => { ev.stopPropagation(); pick(c); }; list.appendChild(sb); }
    if (!open) { const t = document.createElement('button'); t.type = 'button'; t.className = 'mini'; t.textContent = '⇄ Swap';
      t.onclick = ev => { ev.stopPropagation(); list.hidden = !list.hidden; t.textContent = list.hidden ? '⇄ Swap' : 'Cancel'; }; box.appendChild(t); }
    box.appendChild(list); return box; };
  dash.draw('potd-card', el => {
    el.replaceChildren(); if (cbb.failed(el, 'potd')) return;
    const orig = cbb.rows('potd');
    if (!orig.length) { el.textContent = "No parlay today: not enough big games with an edge on the board."; return; }
    const swaps = getSwaps();
    const pool = candidates(new Set());
    const legs = orig.map(r => { const g = swaps[r.game]; const rep = g && pool.find(c => c.game === g); return rep ? Object.assign({}, rep, { replaced: r }) : r; });
    const used = new Set([...legs, ...orig].flatMap(r => [r.game, String(r.game).split(' @ ').reverse().join(' @ ')]));
    let pAll = 1, dk = 1, priced = true;
    for (const r of legs) {
      pAll *= r.p; if (r.price != null) dk *= dec(r.price); else priced = false;
      const d = document.createElement('div'); d.className = 'pl-leg clickable' + (r.replaced ? ' leg-swap' : '');
      let mark = '';
      if (r.res) mark = r.res === 'W' ? '✅ ' : r.res === 'L' ? '❌ ' : '➖ ';
      else if (!r.replaced && r.now_line != null) {
        const mv = r.kind === 'ML' ? 0 : r.dk_line - r.now_line;
        mark = movedAgainst(r) ? '⚠ ' : mv >= 1 ? '✅ ' : '';
      }
      const top = document.createElement('div'); top.className = 'pl-top';
      const b = document.createElement('b'); b.textContent = mark + (r.replaced ? '🔁 ' : '') + legName(r.bet);
      const pr = document.createElement('span'); pr.className = 'pl-p'; pr.textContent = `${pct(r.p)}` + (r.kind === 'ML' ? '' : ` · fair ${r.fair}`);
      if (r.team) b.prepend(teamBadge(r.team)); top.append(b, pr);
      const sub = document.createElement('div'); sub.className = 'muted small';
      const nowTxt = (!r.res && r.now_line != null && r.kind !== 'ML' && r.now_line !== r.dk_line) ? ' · ' + lineMove(sgn(r.dk_line), sgn(r.now_line), r.dk_line - r.now_line) : '';
      sub.textContent = `vs ${r.opp}${r.tip ? ' · ' + r.tip : ''}${nowTxt}${r.replaced ? ` · swapped for ${r.replaced.bet}` : ''}`;
      d.append(top, sub);
      if (r.replaced) {
        const u = document.createElement('button'); u.type = 'button'; u.className = 'mini owner-only'; u.textContent = 'Undo swap';
        u.onclick = ev => { ev.stopPropagation(); const s = getSwaps(); delete s[r.replaced.game]; setSwaps(s); };
        d.appendChild(u);
      } else if (!r.res) {
        const alts = candidates(used).slice(0, 3);
        if (alts.length) d.appendChild(swapBox(alts, c => { const s = getSwaps(); s[r.game] = c.game; setSwaps(s); }, movedAgainst(r)));
      }
      if (r.res) d.classList.add(r.res === 'W' ? 'leg-w' : r.res === 'L' ? 'leg-l' : 'leg-p');
      const [aw, hm] = String(r.game).split(' @ ');
      d.addEventListener('click', ev => { if (ev.target.closest('button,input')) return; openGame(aw, hm, r.proj); });
      el.appendChild(d);
    }
    const nSwap = legs.filter(r => r.replaced).length;
    const sum = document.createElement('div'); sum.className = 'pl-sum';
    const nW = legs.filter(r => r.res === 'W').length, nL = legs.filter(r => r.res === 'L').length;
    const status = nSwap ? '' : nL ? `❌ Lost (${nW} of ${legs.length} legs hit)` : nW === legs.length ? '✅ Won' : nW ? `${nW} of ${legs.length} legs hit so far` : '';
    const warn = legs.filter(r => !r.replaced && movedAgainst(r)).length;
    let t = (status ? status + ' · ' : '') + `Hits ~${Math.round(100 * pAll)}% · worth it at ${amer(pAll)} or better · 0.25–0.5u`;
    if (priced) { const ev = pAll * dk - 1; t += ` · DK ${amer(1 / dk)} (${ev >= 0 ? '+' : ''}${Math.round(100 * ev)}% value)`; }
    if (warn) t = `⚠ ${warn} leg${warn > 1 ? 's' : ''} moved against us · ` + t;
    sum.textContent = t; el.appendChild(sum);
    if (rexpom.isOwner && window.rexpomStakeBox) {                 // log it as one of Rex's bets (shows on today's card)
      const today = cbb.rows('picks')[0], date = today ? today.date : one('meta', { key: 'date' }, 'value', v => v || '');
      const short = legs.map(r => r.bet.replace(/ \((?:[+-]\d+(?:\.\d+)?)\)$/, '')).join(' · ');
      const row = document.createElement('div'); row.className = 'pl-stake';
      const lab = document.createElement('b'); lab.textContent = 'My bet: ';
      row.append(lab, window.rexpomStakeBox({ date, game: short, type: nSwap ? 'Parlay (swapped)' : 'Parlay', bet: `🎰 ${legs.length}-leg parlay`, price: priced ? Math.round(dk >= 2 ? 100 * (dk - 1) : -100 / (dk - 1)) : Math.round(pAll >= 0.5 ? -100 * pAll / (1 - pAll) : 100 * (1 - pAll) / pAll), size: 0.25, flag: 'Parlay' }));
      const h = document.createElement('span'); h.className = 'note';
      h.textContent = nSwap ? ' (mark W/L yourself)' : '';
      row.appendChild(h); el.appendChild(row);
    }
  });
  dash.draw('potd2-card', el => {                       // longshot parlay (Rex, 11/24); swaps for legs that moved against us (11/25)
    el.replaceChildren(); if (cbb.failed(el, 'potd2')) return;
    const orig = cbb.rows('potd2');
    if (!orig.length) { el.textContent = 'No longshot today: fewer than 4 big games on the board.'; return; }
    const key2 = 'potd2-' + ((cbb.rows('potd2_hist')[0] || {}).ymd || '');
    const get2 = () => swapGet(key2);
    const set2 = s => swapSet(key2, s, 'potd2-card');
    const LS = { cushion: 3, minEdge: 0, ml: false };
    const pool = candidates(new Set(), LS);
    let swaps = get2();
    // Rex, 11/25: if he logged a longshot today, show the legs he actually took (rebuild the swaps from his bet)
    const stored = (window._swapStore || {})[key2] !== undefined || (() => { try { return localStorage.getItem('rexpom-' + key2) != null; } catch (e) { return false; } })();
    if (!stored && !Object.keys(swaps).length && rexpom.bets) {
      const ymdT = ((cbb.rows('potd2_hist')[0] || {}).ymd || '');
      const mine = rexpom.bets.filter(b => /^Longshot parlay/.test(b.type || '') && b.ymd === ymdT && b.stake > 0).pop();
      if (mine) { const taken = String(mine.game || '').split(' · '); const has = team => taken.some(t => t.startsWith(team + ' '));
        const origTeams = new Set(orig.map(r => r.team)), usedRep = new Set();
        for (const r of orig) { if (has(r.team)) continue; const c = pool.find(c => !origTeams.has(c.team) && !usedRep.has(c.game) && has(c.team)); if (c) { usedRep.add(c.game); swaps[r.game] = c.game; } } } }
    const legs = orig.map(r => { const g = swaps[r.game]; const rep = g && pool.find(c => c.game === g); return rep ? Object.assign({}, rep, { replaced: r }) : r; });
    const used = new Set([...legs, ...orig].flatMap(r => [r.game, String(r.game).split(' @ ').reverse().join(' @ ')]));   // never offer a game we swapped out
    let pAll = 1;
    for (const r of legs) {
      pAll *= r.p;
      const d = document.createElement('div'); d.className = 'pl-leg clickable' + (r.replaced ? ' leg-swap' : '');
      let mark = '';
      if (r.res) mark = r.res === 'W' ? '✅ ' : r.res === 'L' ? '❌ ' : '➖ ';
      else if (!r.replaced && r.now_line != null) { const mv = r.dk_line - r.now_line; mark = mv <= -1 ? '⚠ ' : mv >= 1 ? '✅ ' : ''; }
      const top = document.createElement('div'); top.className = 'pl-top';
      const b = document.createElement('b'); b.textContent = mark + (r.replaced ? '🔁 ' : '') + legName(r.bet);
      const pr = document.createElement('span'); pr.className = 'pl-p'; pr.textContent = `${pct(r.p)} · fair ${r.fair}`;
      if (r.team) b.prepend(teamBadge(r.team)); top.append(b, pr);
      const sub = document.createElement('div'); sub.className = 'muted small';
      const nowTxt = (!r.res && r.now_line != null && r.now_line !== r.dk_line) ? ' · ' + lineMove(sgn(r.dk_line), sgn(r.now_line), r.dk_line - r.now_line) : '';
      sub.textContent = `vs ${r.opp}${r.tip ? ' · ' + r.tip : ''}${nowTxt}${r.replaced ? ` · swapped for ${r.replaced.bet}` : ''}`;
      d.append(top, sub);
      if (r.replaced) {
        const u = document.createElement('button'); u.type = 'button'; u.className = 'mini owner-only'; u.textContent = 'Undo swap';
        u.onclick = ev => { ev.stopPropagation(); const s = get2(); delete s[r.replaced.game]; set2(s); };
        d.appendChild(u);
      } else if (!r.res) {
        const alts = candidates(used, LS).slice(0, 3);
        if (alts.length) d.appendChild(swapBox(alts, c => { const s = get2(); s[r.game] = c.game; set2(s); }, r.now_line != null && r.dk_line - r.now_line <= -1));
      }
      if (r.res) d.classList.add(r.res === 'W' ? 'leg-w' : r.res === 'L' ? 'leg-l' : 'leg-p');
      const [aw, hm] = String(r.game).split(' @ ');
      d.addEventListener('click', ev => { if (ev.target.closest('button,input')) return; openGame(aw, hm, r.proj); });
      el.appendChild(d);
    }
    const nW = legs.filter(r => r.res === 'W').length, nL = legs.filter(r => r.res === 'L').length;
    const status = nL ? `❌ Lost (${nW} of ${legs.length} legs hit)` : nW === legs.length ? '✅ Won' : nW ? `${nW} of ${legs.length} legs hit so far` : '';
    const warn = legs.filter(r => !r.replaced && !r.res && r.now_line != null && r.dk_line - r.now_line <= -1).length, nSw = legs.filter(r => r.replaced).length;
    let t = (status && !nSw ? status + ' · ' : '') + `Hits ~${Math.round(100 * pAll)}% · worth it at ${amer(pAll)} or better · 0.1–0.25u`;
    if (warn) t = `⚠ ${warn} leg${warn > 1 ? 's' : ''} moved against us · ` + t;
    const sum = document.createElement('div'); sum.className = 'pl-sum'; sum.textContent = t; el.appendChild(sum);
    if (rexpom.isOwner && window.rexpomStakeBox) {
      const today = cbb.rows('picks')[0], date = today ? today.date : one('meta', { key: 'date' }, 'value', v => v || '');
      const row = document.createElement('div'); row.className = 'pl-stake';
      const lab = document.createElement('b'); lab.textContent = 'My bet: ';
      row.append(lab, window.rexpomStakeBox({ date, game: legs.map(r => r.bet).join(' · '), type: nSw ? 'Longshot parlay (swapped)' : 'Longshot parlay', bet: `🚀 ${legs.length}-leg longshot${nSw ? ' (swapped)' : ''}`,
        price: Math.round(100 * (1 - pAll) / pAll), size: 0.1, flag: 'Parlay' }));
      el.appendChild(row);
    }
  });
  const parlayRec = src => { const h = dash.data(src).status === 'ok' ? cbb.rows(src) : []; const w = h.filter(x => x.result === 'W').length, l = h.filter(x => x.result === 'L').length; return { w, l }; };
dash.draw('t-parlays', el => { const a = parlayRec('potd_hist'), b = parlayRec('potd2_hist'); el.textContent = `${a.w + b.w}-${a.l + b.l}`; });   // Rex, 11/24: parlay tracker up top
dash.draw('t-parlays-sub', el => { const a = parlayRec('potd_hist'), b = parlayRec('potd2_hist'); el.textContent = `Parlay of the day ${a.w}-${a.l} · 🚀 Longshot ${b.w}-${b.l}`; });
dash.draw('potd2-rec', el => { const h = cbb.rows('potd2_hist'); const w = h.filter(x => x.result === 'W').length, l = h.filter(x => x.result === 'L').length; el.textContent = w + l ? `Record ${w}-${l}` : ''; });
  dash.draw('potd2-hist', el => {
    el.replaceChildren(); if (cbb.failed(el, 'potd2_hist')) return;
    for (const r of cbb.rows('potd2_hist')) { const tr = document.createElement('tr'); tr.dataset.key = r.ymd;
      cbb.td(tr, `${+r.ymd.slice(4, 6)}/${+r.ymd.slice(6)}`); cbb.td(tr, r.legs); cbb.td(tr, pct(r.p), 'num');
      cbb.td(tr, r.result === 'W' ? '✅ Won' : r.result === 'L' ? '❌ Lost' : r.result === 'P' ? 'Push' : '⏳ Pending', r.result === 'W' ? 'ok' : r.result === 'L' ? 'bad' : 'muted'); el.appendChild(tr); }
  });
  dash.draw('potd-rec', el => { const h = cbb.rows('potd_hist'); const w = h.filter(x => x.result === 'W').length, l = h.filter(x => x.result === 'L').length; el.textContent = w + l ? `Record ${w}-${l}` : ''; });
  dash.draw('potd-hist', el => {
    el.replaceChildren(); if (cbb.failed(el, 'potd_hist')) return;
    for (const r of cbb.rows('potd_hist')) { const tr = document.createElement('tr'); tr.dataset.key = r.ymd;
      cbb.td(tr, `${+r.ymd.slice(4, 6)}/${+r.ymd.slice(6)}`); cbb.td(tr, r.legs); cbb.td(tr, pct(r.p), 'num');
      cbb.td(tr, r.result === 'W' ? '✅ Won' : r.result === 'L' ? '❌ Lost' : r.result === 'P' ? 'Push' : '⏳ Pending', r.result === 'W' ? 'ok' : r.result === 'L' ? 'bad' : 'muted'); el.appendChild(tr); }
  });
})();

/* Rex, 11/25: how long ago the data was pulled ("12:17 PM ET · 8 min ago"), ticking every minute */
(function () {
  const age = () => { const v = dash.data('meta').status === 'ok' ? (cbb.rows('meta').find(r => r.key === 'updated') || {}).value : ''; const m = String(v || '').match(/(\d+)\/(\d+),\s*(\d+):(\d+)\s*(AM|PM)/i); if (!m) return '';
    const now = new Date(); let h = +m[3] % 12 + (/pm/i.test(m[5]) ? 12 : 0);
    // the time is Eastern; compare in Eastern time
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const then = new Date(et.getFullYear(), +m[1] - 1, +m[2], h, +m[4]); let mins = Math.round((et - then) / 60000); if (mins < 0) mins += 0;
    if (mins < 1) return '· just now'; if (mins < 60) return `· ${mins} min ago`; const hh = Math.floor(mins / 60); return `· ${hh} hr${hh > 1 ? 's' : ''}${mins % 60 ? ' ' + (mins % 60) + ' min' : ''} ago`; };
  dash.draw('pull-age', el => { el.textContent = age(); el.classList.toggle('bad', /hr/.test(el.textContent)); });
  setInterval(() => dash.draw('pull-age'), 60000);
})();

/* Rex, 11/25: friends (anyone who isn't Rex) land on Rex's card: today's bets, results and record, nothing to edit */
document.addEventListener('rexpom-friend', () => {
  document.querySelector('.cbb').classList.add('friend');
  document.querySelectorAll('.share-btn').forEach(b => { b.textContent = "📸 Rex's card"; });
  document.querySelectorAll('.share-panel').forEach(p => { p.hidden = false; });
  document.querySelectorAll('.share-show').forEach(sel => { sel.value = 'mine'; });
  dash.draw('share-card');
});
