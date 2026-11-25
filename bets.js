
/* Match a typed bet ("Duke -7.5 vs Mich St") to a game on the slate, so own bets look and grade like model picks. */
const ABBR = { st: 'state', mich: 'michigan', unc: 'north carolina', uconn: 'connecticut', so: 'southern', no: 'northern', w: 'western', e: 'eastern', n: 'north', s: 'south', fla: 'florida', ga: 'georgia', ark: 'arkansas', tenn: 'tennessee', miss: 'mississippi', cal: 'california', ky: 'kentucky', okla: 'oklahoma', wash: 'washington', ill: 'illinois', ind: 'indiana', wisc: 'wisconsin', minn: 'minnesota' };
const toks = t => String(t || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const expand = text => toks(text).flatMap(w => (ABBR[w] || w).split(' '));
function teamAt(words, i, team) {             // does `team` start at words[i]? returns words used, or 0
  const tt = toks(team);
  for (let k = 0; k < tt.length; k++) { const w = words[i + k]; if (!w || !(w === tt[k] || (w.length >= 2 && tt[k].startsWith(w)))) return 0; }
  return tt.length;
}
function bestTeam(text, games) {
  const words = expand(text); let best = null;
  for (const g of games) for (const team of [g.away, g.home]) for (let i = 0; i < words.length; i++) {
    const n = teamAt(words, i, team);
    if (n && (!best || n > best.n || (n === best.n && i < best.i))) best = { n, i, team, g };
  }
  return best;
}
window.rexpomMatch = function (text, ymd) {
  const m = ymd ? `${+String(ymd).slice(4, 6)}/${+String(ymd).slice(6, 8)}` : null;
  const games = cbb.rows('upcoming').filter(g => !m || g.date === m);
  const sideHit = bestTeam(window.rexpomShortBet(text), games), any = sideHit || bestTeam(text, games);
  if (!any) return null;
  const g = any.g; return { game: `${g.away} @ ${g.home}`, tip: g.tip || '', away: g.away, home: g.home, side: sideHit ? sideHit.team : '' };
};
window.rexpomSide = function (text, game) {            // which team of a known game ("A @ H") the bet is on
  const [away, home] = String(game || '').split(' @ '); if (!home) return '';
  const hit = bestTeam(window.rexpomShortBet(text), [{ away, home }]); return hit ? hit.team : '';
};
window.rexpomShortBet = t => String(t || '').split(/\s+(?:at|vs\.?|v\.?|@)\s+/i)[0].trim();
/* Rex's bet entry: stake boxes on today's picks, his own bets, grading his own picks. Owner only. */
function rexpomStakeBox(p) {
  const ymd = rexpom.ymdOf(p.date), id = rexpom.pickKey(ymd, p.game, p.type);
  const cur = rexpom.bets.find(b => b.id === id);
  const wrap = document.createElement('span');
  const st = document.createElement('input'); st.type = 'number'; st.min = '0'; st.step = '0.25'; st.placeholder = p && p.size ? p.size + 'u' : 'u'; st.className = 'stake-in';
  st.title = 'Units you bet (blank = no bet)'; st.value = cur ? cur.stake : '';
  const od = document.createElement('input'); od.type = 'text'; od.className = 'stake-in odds-in'; od.title = 'Odds you got';
  const dk = p.price ? ((+p.price > 0 ? '+' : '') + (+p.price)) : '-110';      // DraftKings price for this side
  od.value = cur ? cur.odds : dk;
  // Rex, 11/25: the line he actually got (graded at that line), with the model's edge there
  const NUM = /([+-]?\d+(?:\.\d+)?)(?!.*\d)/;
  const base = String(p.bet || '').replace(/\s*\((DK|our)[^)]*\)\s*$/, '');
  const pickLine = +((base.match(NUM) || [])[1]);
  const isTot = p.type === 'Total', under = /^under/i.test(base);
  const fmt = v => isTot ? String(v) : (v > 0 ? '+' : '') + v;
  const ln = document.createElement('input'); ln.type = 'text'; ln.inputMode = 'decimal'; ln.className = 'stake-in line-in'; ln.title = 'The line you got';
  const curLine = cur ? +((String(cur.bet).match(NUM) || [])[1]) : NaN;
  ln.value = !isNaN(curLine) ? fmt(curLine) : (p.close || p.best_line || (isNaN(pickLine) ? '' : fmt(pickLine)));
  const note = document.createElement('span'); note.className = 'line-edge muted';
  const edgeAt = L => isNaN(pickLine) || isNaN(L) || p.edge == null || p.edge === '' ? null : Math.round(10 * (+p.edge + (isTot ? (under ? L - pickLine : pickLine - L) : L - pickLine))) / 10;
  const showEdge = () => { if (!(p.type === 'Spread' || p.type === 'Total')) return; const L = parseFloat(ln.value); const e = edgeAt(L); note.textContent = e == null || L === pickLine ? '' : `edge at ${fmt(L)}: ${e} pts${e < (isTot ? (under ? 5 : 8) : 5) ? ' ⚠ below our cutoff' : ''}`; note.className = 'line-edge ' + (e != null && e < (isTot ? (under ? 5 : 8) : 5) ? 'bad' : 'muted'); };
  const save = () => {
    showEdge();
    const stake = parseFloat(st.value);
    const odds = (od.value || dk).trim();
    const L = parseFloat(ln.value);
    const lined = p.type === 'Spread' || p.type === 'Total';
    const bet = !lined ? p.bet : isNaN(L) ? base : base.replace(NUM, fmt(L));
    if (!stake || stake <= 0) { if (cur) rexpom.saveBet(id, null); return; }
    if (cur && cur.stake === stake && cur.odds === odds && cur.bet === bet) return;
    rexpom.saveBet(id, { kind: 'pick', ymd, date: p.date, game: p.game, type: p.type, bet,
      rating: p.flag === 'STRONG' && p.tier === 'High' ? 'Best Bet' : p.flag, stake, odds, savedAt: new Date().toISOString() });
  };
  st.addEventListener('change', save); od.addEventListener('change', save); ln.addEventListener('change', save); ln.addEventListener('input', showEdge);
  if (p.type === 'Spread' || p.type === 'Total') wrap.append(st, ' @ ', od, ' on ', ln, note); else wrap.append(st, ' @ ', od);
  showEdge();
  return wrap;
}

function rexpomBetControls(b, tr) {
  const td = document.createElement('td'); td.className = 'ctl';
  const raw = () => rexpom.bets.find(x => x.id === b.id);
  for (const r of ['W', 'L', 'P']) {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'mini'; btn.textContent = r;
    btn.setAttribute('aria-pressed', String(b.result === r)); btn.title = 'Mark ' + ({ W: 'won', L: 'lost', P: 'push' })[r];
    btn.onclick = () => { const cur = raw(); if (cur) rexpom.saveBet(b.id, Object.assign({}, cur, { result: b.result === r ? '' : r })); };
    td.appendChild(btn);
  }
  const ed = document.createElement('button'); ed.type = 'button'; ed.className = 'mini'; ed.textContent = '✎'; ed.title = 'Edit the line, stake or odds you got';
  ed.onclick = () => rexpomEditRow(b, tr);
  td.appendChild(ed);
  const del = document.createElement('button'); del.type = 'button'; del.className = 'mini'; del.textContent = '✕'; del.title = 'Remove this bet';
  del.onclick = () => { if (del.dataset.armed) rexpom.saveBet(b.id, null); else { del.dataset.armed = '1'; del.textContent = 'Remove?'; setTimeout(() => { delete del.dataset.armed; del.textContent = '✕'; }, 3000); } };
  td.appendChild(del);
  return td;
}

function rexpomEditRow(b, tr) {
  const cur = rexpom.bets.find(x => x.id === b.id); if (!cur) return;
  const cells = tr.children;
  const mk = (val, cls, title) => { const i = document.createElement('input'); i.value = val ?? ''; i.className = cls; i.title = title; return i; };
  const bet = mk(cur.bet, 'bet-in', cur.kind === 'pick' ? 'Team and the line you got, e.g. Tulsa -13.5 or OVER 141' : 'Your bet');
  const st = mk(cur.stake, 'stake-in', 'Units'); st.type = 'number'; st.step = '0.25'; st.min = '0';
  const od = mk(cur.odds || '-110', 'stake-in odds-in', 'Odds');
  const dt = mk('', 'date-in', 'Game date'); dt.type = 'date';
  { const m = String(cur.ymd || '').match(/^(\d{4})(\d{2})(\d{2})$/); if (m) dt.value = `${m[1]}-${m[2]}-${m[3]}`; }
  if (cur.kind !== 'pick') cells[0].replaceChildren(dt);
  cells[1].replaceChildren(bet);
  cells[3].replaceChildren(st, ' @ ', od);
  const ctl = tr.querySelector('td.ctl'); ctl.replaceChildren();
  const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'mini'; ok.textContent = 'Save';
  const no = document.createElement('button'); no.type = 'button'; no.className = 'mini'; no.textContent = 'Cancel';
  ok.onclick = () => {
    const stake = parseFloat(st.value); if (!stake || stake <= 0 || !bet.value.trim()) return rexpom.toast('Enter the bet and a stake');
    const body = Object.assign({}, cur, { bet: bet.value.trim(), stake, odds: (od.value || '-110').trim() });
    const dm = dt.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (cur.kind !== 'pick' && dm) { body.ymd = dm[1] + dm[2] + dm[3]; body.date = `${+dm[2]}/${+dm[3]}/${dm[1].slice(2)}`; }
    if (cur.kind === 'pick' && body.bet !== cur.bet && (cur.result || '') === (cur.autoResult || '')) { body.result = ''; delete body.autoResult; }   // re-grade at the new line
    rexpom.saveBet(b.id, body);
  };
  no.onclick = () => dash.draw('bets-body');
  ctl.append(ok, no);
  bet.focus();
}

// keep automatic grades: once a model-pick bet is graded from the final score, store it so it survives after the score drops out of the feed
function rexpomKeepGrades(rows) {
  for (const cur of rexpom.bets || []) {                // own bets typed before games were linked: link them while the game is on the slate
    if (cur.kind !== 'own' || cur.game || cur.result || cur._tried) continue;
    cur._tried = true; const hit = window.rexpomMatch(cur.bet, cur.ymd);
    if (hit) rexpom.saveBet(cur.id, Object.assign({}, cur, { game: hit.game, _tried: undefined }), true);
  }
  for (const r of rows) {
    if (r.how !== 'score' && r.how !== 'tracker') continue;
    const cur = rexpom.bets.find(x => x.id === r.id);
    if (cur && !cur.result) rexpom.saveBet(r.id, Object.assign({}, cur, { result: r.result, autoResult: r.result }), true);
  }
}

(function () {
  // "Add my own bet" forms (Today tab and under Rex's Bets)
  const setToday = form => { const d = form.querySelector('[name=date]'); if (d) { const n = new Date(); d.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; } };
  document.querySelectorAll('.own-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form), stake = parseFloat(f.get('stake'));
      if (!String(f.get('bet') || '').trim() || !stake) return rexpom.toast('Enter the bet and a stake');
      const now = new Date(), dv = String(f.get('date') || ''), dm = dv.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const date = dm ? `${+dm[2]}/${+dm[3]}/${dm[1].slice(2)}` : `${now.getMonth() + 1}/${now.getDate()}/${String(now.getFullYear()).slice(2)}`;
      const ymd = rexpom.ymdOf(date), text = String(f.get('bet')).trim(), hit = window.rexpomMatch(text, ymd);
      rexpom.saveBet('own-' + now.getTime().toString(36), { kind: 'own', ymd, date, bet: text, game: hit ? hit.game : '',
        stake, odds: String(f.get('odds') || '-110').trim(), result: '', savedAt: now.toISOString() });
      if (hit) rexpom.toast('Saved: ' + hit.game + (hit.tip ? ' · ' + hit.tip : ''));
      form.reset(); setToday(form);
    });
    setToday(form);
  });

  // wording for the GitHub-run model
  document.querySelectorAll('.cbb .note').forEach(n => {
    if (n.textContent.startsWith('Only bets actually placed')) n.textContent = "Only bets actually placed, in units (1 unit = Rex's base bet). Enter a stake next to any pick on the Today tab. Use ✎ to change the line, stake or odds to what you actually got: model picks grade themselves from the final score at your line. Use W / L / P for your own picks (or to fix a grade).";
    n.textContent = n.textContent.replace('next to AP, KenPom and Torvik', 'next to AP and KenPom').replace('Season stats from Torvik for every team that has played', 'Season stats from box scores for every D-I team');
  });
  document.querySelectorAll('th[data-field="trank"]').forEach(th => { th.textContent = 'Vegas line'; });
  if (typeof STAT_TIPS !== 'undefined') Object.assign(STAT_TIPS, {
    sos: 'Strength of schedule so far: the average Net Rating of the opponents played. Higher means tougher.',
    ncsos: 'Non-conference strength of schedule: average Net Rating of non-conference opponents. Higher means tougher.',
    kenpom: "KenPom's rank, from kenpom.com's public rankings page.",
    conf_tier: 'How much data backs our rating for this team: High (8+ games), Medium (4-7) or Low (fewer).',
    champ: 'Our chance to win the national title, from 10,000 simulated tournaments.',
    stake: 'Units you bet on this pick, and the odds you got. Leave blank if you passed.',
  });
})();
