/* Rexpom custom-page runtime.
 *
 * A small stand-in for the dashboard runtime the page was first written for, so the same page code keeps working:
 * dash.loader / dash.calc / dash.data / dash.draw / dash.colors / dash.refresh / dash.setLink.
 *
 * Data:
 *   feed   - CSV of the "Rexpom Feed (GitHub)" Google Sheet. When the owner opens the page it is read through their
 *            Google Drive connection (mcp) and a copy is saved in the site's storage (db: feed/meta + feed/p0..pN)
 *            so everyone else the page is shared with sees it too.
 *   mybets - Rex's bets, one document per bet in the site's storage (db: bets/<id>). Only the owner can write.
 */
(function () {
  const FEED_FILE = '1UmRQJ79lKoAK8nGS2rGLpFhX0TT7pNFYsXIee_X-JCg';
  const SYNC_FOLDER = '1F5bkW_0P2PHHKl4iNRevXMm8MP8wNIyl';   // Drive folder shared with the GitHub bot
  const PART = 200000;                      // characters per stored feed part (store limit is 256 KiB per document)

  const S = { loaders: {}, calcDefs: {}, calcOrder: [], draws: {}, data: {} };
  const dash = {
    colors: ['#5b8def', '#e8743b', '#19a979', '#e4b32a', '#945ecf', '#13a4b4', '#d4527a', '#8e9aaf'],
    loader(id, def) { S.loaders[id] = def; },
    calc(id, def) { S.calcDefs[id] = def; if (!S.calcOrder.includes(id)) S.calcOrder.push(id); },
    data(id) { return S.data[id] || { status: 'loading', data: [] }; },
    draw(id, fn) {
      if (fn) S.draws[id] = fn;
      const f = S.draws[id]; if (!f) return;
      document.querySelectorAll(`[data-draw="${id}"]`).forEach(el => { try { f(el); } catch (e) { console.error('draw ' + id, e); } });
    },
    refresh() { rexpom.loadFeed(true); },
    setLink(name) { if (location.hash.slice(1) !== name) { try { history.replaceState(null, '', '#' + name); } catch (e) { location.hash = name; } } },
  };
  window.dash = dash;

  function recompute() {
    for (const id of S.calcOrder) {
      const def = S.calcDefs[id];
      const ins = def.inputs.map(i => dash.data(i));
      if (ins.some(d => d.status === 'error')) { S.data[id] = { status: 'error', data: [] }; continue; }
      if (ins.some(d => d.status !== 'ok')) { S.data[id] = { status: 'loading', data: [] }; continue; }
      try { S.data[id] = { status: 'ok', data: def.fn(...ins.map(d => d.data)) }; }
      catch (e) { console.error('calc ' + id, e); S.data[id] = { status: 'error', data: [] }; }
    }
    for (const id of Object.keys(S.draws)) dash.draw(id);
  }
  function setData(id, status, data) { S.data[id] = { status, data: data || [] }; recompute(); }

  // ------------------------------------------------------------------ helpers shared with the page code
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
  const ymdOf = d => { const m = String(d || '').match(/^(\d+)\/(\d+)\/(\d+)$/); if (!m) return String(d || ''); const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return `${y}${String(m[1]).padStart(2, '0')}${String(m[2]).padStart(2, '0')}`; };
  const rexpom = window.rexpom = {
    isOwner: false, canWrite: false, db: null, downloads: null, bets: [],
    pickKey: (ymd, game, type) => 'p-' + ymd + '-' + hash(String(game) + '|' + String(type)),
    ymdOf,
    profit(stake, odds, res) {
      const o = parseFloat(String(odds || '-110').replace('+', '')) || -110;
      if (res === 'W') return Math.round(stake * (o < 0 ? 100 / -o : o / 100) * 100) / 100;
      return res === 'L' ? -stake : 0;
    },
    toast(msg) {
      let t = document.querySelector('.cbb .toast');
      if (!t) { t = document.createElement('div'); t.className = 'toast'; document.querySelector('.cbb').appendChild(t); }
      t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 2200);
    },
    async saveBet(id, body, quiet) {
      if (!rexpom.db) return rexpom.toast('Saving is not available here');
      if (body) { body = Object.assign({}, body); delete body.id; }
      try {
        if (body) await rexpom.db.doc('bets/' + id).set(body); else await rexpom.db.doc('bets/' + id).delete();
        if (!quiet) rexpom.toast(body ? 'Saved' : 'Removed');
      } catch (e) { console.error(e); rexpom.toast(e && e.code === 'invalid_argument' ? 'Only the owner can save bets' : 'Could not save, try again'); }
    },
    loadFeed: () => {},
    // Rex, 11/25: copy his bets and parlay swaps to Google Drive for the friends site (the GitHub run picks it up)
    syncFriends() {
      clearTimeout(rexpom._syncT);
      rexpom._syncT = setTimeout(async () => {
        if (!rexpom._mcp || !rexpom.isOwner || !rexpom.db) return;
        const body = JSON.stringify({ savedAt: new Date().toISOString(), bets: rexpom.bets || [], swaps: window._swapStore || {} });
        if (body.replace(/"savedAt":"[^"]*"/, '') === rexpom._lastSync) return;
        try {
          const res = await rexpom._mcp.callTool('Google Drive', 'create_file', { title: 'rexpom-bets.json', parentId: SYNC_FOLDER, textContent: body,
            contentMimeType: 'application/json', disableConversionToGoogleType: true });
          const made = res && (res.payload || res); const id = made && (made.id || (made.structuredContent && made.structuredContent.id));
          rexpom._lastSync = body.replace(/"savedAt":"[^"]*"/, '');
          const prev = await rexpom.db.doc('prefs/sync').get().catch(() => null);
          const old = prev && prev.exists ? prev.data().fileId : null;
          if (id) await rexpom.db.doc('prefs/sync').set({ fileId: id, at: new Date().toISOString() });
          if (old && old !== id) rexpom._mcp.callTool('Google Drive', 'trash_file', { fileId: old }).catch(() => { });
        } catch (e) { console.warn('friends sync', e); }
      }, 15000);
    },
  };

  // ------------------------------------------------------------------ feed text <-> datasets
  let feedText = null;
  function useFeed(text, source) {
    if (!text || text === feedText) return;
    feedText = text;
    try { setData('feed', 'ok', S.loaders.feed.fn({ answer: text })); }
    catch (e) { console.error('feed', e); setData('feed', 'error'); }
    rexpom.feedSource = source;
  }

  function decodeDrive(payload) {
    let a = payload;
    if (Array.isArray(a)) a = (a.find(x => x && typeof x.text === 'string') || {}).text ?? a[0];
    if (a && typeof a === 'object' && Array.isArray(a.content)) a = (a.content.find(x => x && typeof x.text === 'string') || {}).text;
    if (typeof a === 'string') { const t = a.trim(); if (t.startsWith('{') || t.startsWith('[')) { try { a = JSON.parse(t); } catch (e) { return a; } } else return a; }
    if (a && a.content && typeof a.content === 'string') {
      const bin = atob(a.content); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    }
    if (a && typeof a.text === 'string') return a.text;
    throw new Error('Google Drive returned no file content');
  }

  async function storeFeed(db, text) {
    const parts = [];
    for (let i = 0; i < text.length; i += PART) parts.push(text.slice(i, i + PART));
    for (let i = 0; i < parts.length; i++) await db.doc('feed/p' + i).set({ text: parts[i] });
    await db.doc('feed/meta').set({ parts: parts.length, length: text.length, storedAt: new Date().toISOString() });
  }

  // ------------------------------------------------------------------ friends site (Rex, 11/25)
  // On the public GitHub Pages copy (window.REXPOM_PUBLIC) everything comes from static files the GitHub run writes:
  // data/feed.csv.gz, data/bets.json (Rex's bets + parlay swaps, synced from his site through Google Drive).
  if (window.REXPOM_PUBLIC) {
    setData('feed', 'loading'); setData('mybets', 'loading');
    rexpom.isOwner = false; rexpom.canWrite = false; rexpom.db = null; rexpom.bets = [];
    rexpom.loadFeed = async () => {
      try {
        const r = await fetch('data/feed.csv.gz?t=' + Date.now(), { cache: 'no-store' });
        const txt = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
        useFeed(txt, 'live');
      } catch (e) { console.error(e); if (!feedText) setData('feed', 'error'); }
      try {
        const b = await (await fetch('data/bets.json?t=' + Date.now(), { cache: 'no-store' })).json();
        rexpom.bets = b.bets || []; window._swapStore = b.swaps || {}; setData('mybets', 'ok', rexpom.bets);
      } catch (e) { setData('mybets', 'ok', []); }
    };
    document.addEventListener('DOMContentLoaded', () => { document.dispatchEvent(new Event('rexpom-friend')); rexpom.loadFeed(); });
    setInterval(() => rexpom.loadFeed(), 10 * 60 * 1000);    // pick up new runs while the page is open
    return;
  }

  // ------------------------------------------------------------------ start-up
  setData('feed', 'loading'); setData('mybets', 'loading');
  const start = async () => {
    const [user, db, mcp, downloads] = await Promise.all(['user', 'db', 'mcp', 'downloads'].map(n => window.claude ? claude.use(n).catch(() => null) : Promise.resolve(null)));
    rexpom.db = db; rexpom.downloads = downloads; rexpom._mcp = mcp;
    rexpom.isOwner = !!(user && user.isOwner && await user.isOwner());
    rexpom.canWrite = rexpom.isOwner;
    document.querySelector('.cbb').classList.toggle('is-owner', rexpom.isOwner);
    if (!rexpom.isOwner) setTimeout(() => document.dispatchEvent(new Event('rexpom-friend')), 0);

    // bets: live from storage
    if (db) {
      const t = setTimeout(() => { if (dash.data('mybets').status === 'loading') setData('mybets', 'ok', []); }, 10000);
      db.collection('bets').onSnapshot(snap => {
        clearTimeout(t);
        rexpom.bets = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        setData('mybets', 'ok', rexpom.bets);
        if (rexpom.isOwner) rexpom.syncFriends();
      }, () => { clearTimeout(t); setData('mybets', 'ok', []); });
    } else setData('mybets', 'ok', []);

    // parlay swaps (Rex, 11/25): kept in storage so they survive closing the app
    if (db) { try { db.doc('prefs/swaps').onSnapshot(d => { window._swapStore = (d && d.exists ? d.data() : {}) || {}; if (window.dash) { dash.draw('potd-card'); dash.draw('potd2-card'); } }); } catch (e) { } }

    // feed: the saved copy first (fast, works for everyone) ...
    let stored = null;
    if (db) {
      try {
        const meta = await db.doc('feed/meta').get();
        if (meta.exists) {
          const n = meta.data().parts || 0; const parts = [];
          for (let i = 0; i < n; i++) { const p = await db.doc('feed/p' + i).get(); parts.push(p.exists ? p.data().text : ''); }
          stored = parts.join('');
          if (meta.data().enc === 'gzip64') {           // copy pushed straight from the GitHub run (when Drive is down)
            const bin = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
            stored = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
          }
          useFeed(stored, 'saved');
        }
      } catch (e) { console.warn('stored feed', e); }
    }
    // ... then, for the owner, the live sheet through Google Drive, saved back for everyone else
    rexpom.loadFeed = async (manual) => {
      if (!mcp || !rexpom.isOwner) { if (manual) rexpom.toast('Fresh data loads when Rex opens the page'); if (!feedText) setData('feed', 'error'); return; }
      try {
        const res = await Promise.race([mcp.callTool('Google Drive', 'download_file_content', { fileId: FEED_FILE, exportMimeType: 'text/csv' }),
          new Promise((_, no) => setTimeout(() => no(new Error('Google Drive did not answer within 40 seconds')), 40000))]);
        const text = decodeDrive(res && res.payload !== undefined ? res.payload : res);
        if (!text || !text.startsWith('#meta')) throw new Error('unexpected feed content');
        useFeed(text, 'live');
        if (db && text !== stored) { await storeFeed(db, text); stored = text; }
        if (manual) rexpom.toast('Updated');
        warn('');
      } catch (e) {
        console.error('live feed', e);
        if (!feedText) setData('feed', 'error');
        if (manual) rexpom.toast('Could not reach Google Drive');
        warn("Couldn't load today's data from Google Drive just now" + (feedText ? ' — showing the last saved copy (see "Updated" time). ' : '. ') + 'It retries automatically; or tap Refresh. (' + String(e && e.message || e).slice(0, 80) + ')');
        if (!manual && !retried) { retried = true; setTimeout(() => rexpom.loadFeed(false), 15000); }
      }
    };
    let retried = false;
    function warn(msg) {
      let el = document.querySelector('.feed-warn');
      if (!el) { let host = document.querySelector('.cbb h1'); if (!host) return; host = host.nextElementSibling || host; el = document.createElement('div'); el.className = 'feed-warn'; host.after(el); }
      el.textContent = msg; el.hidden = !msg;
    }
    rexpom.loadFeed(false);
    // backup path: owner loads the feed file from the GitHub repo (data/out/feed.csv.gz) when Google Drive is down
    document.querySelectorAll('.load-file input').forEach(inp => inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        let text;
        if (/\.gz$/i.test(f.name)) text = await new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text();
        else text = await f.text();
        if (!text.startsWith('#meta')) throw new Error('not a Rexpom feed file');
        useFeed(text, 'file'); warn('');
        if (db && rexpom.isOwner) { await storeFeed(db, text); stored = text; }
        rexpom.toast('Loaded ' + f.name);
      } catch (e) { console.error(e); rexpom.toast('Could not load that file: ' + (e.message || e)); }
      inp.value = '';
    }));
    if (!db && !mcp && !feedText) setData('feed', 'error');
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
