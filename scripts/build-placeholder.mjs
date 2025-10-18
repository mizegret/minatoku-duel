#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync, cpSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist';
if (!existsSync(out)) mkdirSync(out, { recursive: true });

// Copy static assets if present
if (existsSync('public')) cpSync('public', out, { recursive: true });
// remove any env.* files copied under dist (do not ship local env)
for (const f of ['env.local.json', 'env.json']) {
  const p = join(out, f);
  if (existsSync(p))
    try {
      unlinkSync(p);
    } catch (_e) {
      /* ignore */
    }
}
// copy docs images for preview
if (existsSync('docs/ui/images')) {
  const target = join(out, 'docs/ui/images');
  mkdirSync(target, { recursive: true });
  cpSync('docs/ui/images', target, { recursive: true });
}

const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Minatoku Duel — Phase 1 UI Stub</title>
    <style>
      :root{--border:#ddd;--bg:#fff;--muted:#666;--accent:#0a7;
        --pane:#fafafa;--shadow:0 2px 12px rgba(0,0,0,.06)}
      *{box-sizing:border-box}
      html,body{height:100%}
      body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#111;background:#fff}
      header{display:flex;gap:.75rem;align-items:center;padding:.75rem 1rem;border-bottom:1px solid var(--border);position:sticky;top:0;background:#fff;z-index:10}
      header h1{font-size:1.1rem;margin:0 0.5rem 0 0}
      header .spacer{flex:1}
      header input, header button, header select{height:32px;padding:0 .6rem;border:1px solid var(--border);border-radius:8px;background:#fff}
      header button{background:var(--accent);border-color:var(--accent);color:#fff;cursor:pointer}
      .wrap{display:grid;grid-template-columns:300px 1fr 340px;gap:12px;height:calc(100vh - 57px);padding:12px}
      aside, main{border:1px solid var(--border);border-radius:10px;background:var(--pane);box-shadow:var(--shadow)}
      aside .section{padding:10px;border-bottom:1px dashed var(--border)}
      aside h3{margin:.4rem 0;font-size:.95rem}
      #scene{height:100%;display:grid;grid-template-rows:auto 1fr}
      #scene .toolbar{display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px dashed var(--border);background:#fff;border-radius:10px 10px 0 0}
      #scene .toolbar button{height:30px;padding:0 .6rem;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer}
      #scene .boardWrap{padding:8px}
      #board{width:100%;height:100%;background:#fefefe;border:1px solid var(--border);border-radius:8px}
      #log{height:100%;display:grid;grid-template-rows:auto auto 1fr}
      #log .toolbar{display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px dashed var(--border);background:#fff;border-radius:10px 10px 0 0}
      #log pre{margin:0;padding:8px;overflow:auto;background:#fff;border-top:1px dashed var(--border)}
      .muted{color:var(--muted)}
      .small{font-size:.85rem}
      .kbd{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;background:#f2f2f2;border:1px solid var(--border);border-bottom-width:2px;border-radius:6px;padding:.05rem .3rem}
      ul.reset{list-style:none;margin:.2rem 0;padding:0}
      ul.reset li{padding:.15rem 0}
      footer.note{position:fixed;right:12px;bottom:8px;font-size:.8rem;color:var(--muted)}
      a{color:#067}
    </style>
  </head>
  <body>
    <header>
      <h1>Minatoku Duel — UI Stub</h1>
      <label class="small">Room <input id="roomId" placeholder="lobby" value="lobby" /></label>
      <label class="small">Client <input id="clientId" placeholder="c-001" /></label>
      <button id="btnJoin">join</button>
      <button id="btnStart">start</button>
      <span class="spacer"></span>
      <span class="muted small">events: join • start • move • state</span>
    </header>
    <div class="wrap">
      <aside id="left">
        <div class="section">
          <h3>Room</h3>
          <div class="small">channel: <code id="chan">room:lobby</code></div>
        </div>
        <div class="section">
          <h3>Players</h3>
          <ul id="players" class="reset small"></ul>
        </div>
        <div class="section">
          <h3>Help</h3>
          <div class="small">Move with <span class="kbd">←</span> <span class="kbd">→</span> <span class="kbd">↑</span> <span class="kbd">↓</span></div>
          <div class="small">Throttle ≤ 10 move/sec</div>
        </div>
      </aside>
      <main id="scene">
        <div class="toolbar small">
          <button id="btnCenter">center</button>
          <button id="btnClearBoard">clear</button>
          <span class="muted">frame: <span id="frame">0</span></span>
        </div>
        <div class="boardWrap"><canvas id="board"></canvas></div>
      </main>
      <aside id="log">
        <div class="toolbar small">
          <button id="btnExport">export logs</button>
          <button id="btnClear">clear logs</button>
          <span class="muted">max 200 lines</span>
        </div>
        <div class="small" style="padding:0 8px">latest:</div>
        <pre id="latest" class="small muted">(no events)</pre>
        <pre id="logs"></pre>
      </aside>
    </div>
    <footer class="note">Phase 1 stub — no network. <a href="docs/ui/images/main-layout.png">layout</a> · <a href="docs/api/events.md">events</a></footer>

    <script>
      // --- minimal state ---
      const S = { version: '1.0', frame: 0, roomId: 'lobby', clientId: '', players: new Map(), logs: [] };
      const sel = (id) => document.getElementById(id);
      const chanEl = sel('chan');
      const roomEl = sel('roomId');
      const clientEl = sel('clientId');
      const playersEl = sel('players');
      const frameEl = sel('frame');
      const latestEl = sel('latest');
      const logsEl = sel('logs');
      const board = sel('board');
      let ctx; let pos = { x: 80, y: 80 };
      let lastMoveTs = 0; // throttle

      function initCanvas(){
        const wrap = board.parentElement.getBoundingClientRect();
        board.width = Math.floor(wrap.width - 8);
        board.height = Math.floor((document.body.clientHeight - 140));
        ctx = board.getContext('2d');
        draw();
      }

      function draw(){
        if(!ctx) return;
        ctx.clearRect(0,0,board.width,board.height);
        // grid
        ctx.strokeStyle = '#eee';
        for(let x=0; x<board.width; x+=40){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,board.height); ctx.stroke(); }
        for(let y=0; y<board.height; y+=40){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(board.width,y); ctx.stroke(); }
        // player
        ctx.fillStyle = '#0a7';
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 14, 0, Math.PI*2); ctx.fill();
      }

      function rid(){ return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6); }
      function now(){ return Date.now(); }
      function chan(){ return 'room:' + S.roomId; }

      function envelope(event, payload){
        return { version: S.version, event, ts: now(), clientId: S.clientId || 'anon', requestId: rid(), payload };
      }

      function logAction(category, message){ /* reserved hook: keep name */ console.debug('[logAction]', category, message); }

      function pushEvent(ev){
        const line = JSON.stringify(ev);
        S.logs.push(line); if(S.logs.length>200) S.logs.shift();
        latestEl.textContent = line;
        logsEl.textContent = S.logs.join('\n');
        logAction(ev.event, ev.requestId);
      }

      function renderPlayers(){
        playersEl.innerHTML = '';
        for (const [id, p] of S.players.entries()){
          const li = document.createElement('li');
          li.textContent = id + ' (seat ' + (p.seat ?? '?') + ')';
          playersEl.appendChild(li);
        }
      }

      function join(){
        if(!S.clientId){ S.clientId = clientEl.value.trim() || ('c-' + Math.random().toString(36).slice(2,6)); clientEl.value = S.clientId; }
        const payload = { displayName: S.clientId, seat: (S.players.size+1), client: { ua: navigator.userAgent, lang: navigator.language } };
        const ev = envelope('join', payload);
        S.players.set(S.clientId, { seat: payload.seat, alive: true });
        renderPlayers(); pushEvent(ev);
      }

      function start(){
        const ev = envelope('start', { seed: 's-' + new Date().toISOString(), players: Array.from(S.players.entries()).map(([id, p])=>({ id, seat: p.seat })) });
        pushEvent(ev);
      }

      function move(dx, dy){
        const nowTs = performance.now();
        if (nowTs - lastMoveTs < 100) return; // ≤10/s
        lastMoveTs = nowTs;
        pos.x = Math.max(20, Math.min(board.width-20, pos.x + dx*6));
        pos.y = Math.max(20, Math.min(board.height-20, pos.y + dy*6));
        draw();
        S.frame++; frameEl.textContent = String(S.frame);
        const ev = envelope('move', { type: 'pointer', dx, dy, frame: S.frame });
        pushEvent(ev);
      }

      function state(){
        const ev = envelope('state', { frame: S.frame, players: Object.fromEntries(Array.from(S.players.entries()).map(([id,p])=>[id,{ seat:p.seat, alive:true }])) });
        pushEvent(ev);
      }

      // wiring UI
      function updateChannel(){ S.roomId = roomEl.value.trim() || 'lobby'; chanEl.textContent = chan(); }
      sel('btnJoin').onclick = () => { updateChannel(); S.clientId = clientEl.value.trim(); join(); };
      sel('btnStart').onclick = () => { start(); };
      sel('btnCenter').onclick = () => { pos = { x: 80, y: 80 }; draw(); };
      sel('btnClearBoard').onclick = () => { draw(); };
      sel('btnClear').onclick = () => { S.logs = []; logsEl.textContent=''; latestEl.textContent='(no events)'; };
      sel('btnExport').onclick = () => {
        const blob = new Blob(['[\n' + S.logs.join(',\n') + '\n]'], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'events-'+Date.now()+'.json'; a.click(); URL.revokeObjectURL(a.href);
      };
      window.addEventListener('resize', initCanvas);
      window.addEventListener('keydown', (e)=>{
        if(e.key==='ArrowLeft') move(-1,0);
        else if(e.key==='ArrowRight') move(1,0);
        else if(e.key==='ArrowUp') move(0,-1);
        else if(e.key==='ArrowDown') move(0,1);
      });
      roomEl.addEventListener('input', updateChannel);
      // heartbeat (state)
      setInterval(()=> { if (S.players.size>0) state(); }, 30000);

      // boot
      initCanvas(); updateChannel();
    </script>
  </body>
  </html>`;

writeFileSync(join(out, 'index.html'), html, 'utf8');
console.log('Built placeholder to dist/');
