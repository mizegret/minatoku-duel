import React, { useEffect, useMemo, useRef, useState } from 'react';

function rid() {
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}
function now() {
  return Date.now();
}

export default function App() {
  const [roomId, setRoom] = useState('lobby');
  const [clientId, setClient] = useState('');
  const [players, setPlayers] = useState(new Map());
  const [frame, setFrame] = useState(0);
  const logsRef = useRef([]);
  const latestRef = useRef('');
  const canvasRef = useRef(null);
  const pos = useRef({ x: 80, y: 80 });
  const lastMove = useRef(0);

  const chan = useMemo(() => `room:${roomId}`, [roomId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.floor(rect.width - 8);
      canvas.height = Math.floor(window.innerHeight * 0.6);
      draw();
    };
    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#eee';
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.fillStyle = '#0a7';
      ctx.beginPath();
      ctx.arc(pos.current.x, pos.current.y, 14, 0, Math.PI * 2);
      ctx.fill();
    };
    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    resize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function envelope(event, payload) {
    return { version: '1.0', event, ts: now(), clientId: clientId || 'anon', requestId: rid(), payload };
  }
  function pushEvent(ev) {
    const line = JSON.stringify(ev);
    logsRef.current.push(line);
    if (logsRef.current.length > 200) logsRef.current.shift();
    latestRef.current = line;
  }
  function renderPlayersList() {
    return Array.from(players.entries()).map(([id, p]) => (
      <li key={id} className="small">
        {id} (seat {p.seat ?? '?'})
      </li>
    ));
  }

  function doJoin() {
    const id = clientId || `c-${Math.random().toString(36).slice(2, 6)}`;
    setClient(id);
    const seat = players.size + 1;
    const next = new Map(players);
    next.set(id, { seat, alive: true });
    setPlayers(next);
    pushEvent(
      envelope('join', { displayName: id, seat, client: { ua: navigator.userAgent, lang: navigator.language } })
    );
  }
  function doStart() {
    pushEvent(
      envelope('start', {
        seed: 's-' + new Date().toISOString(),
        players: Array.from(players.entries()).map(([id, p]) => ({ id, seat: p.seat })),
      })
    );
  }
  function doMove(dx, dy) {
    const nowTs = performance.now();
    if (nowTs - lastMove.current < 100) return; // throttle 10/s
    lastMove.current = nowTs;
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;
    pos.current.x = Math.max(20, Math.min(width - 20, pos.current.x + dx * 6));
    pos.current.y = Math.max(20, Math.min(height - 20, pos.current.y + dy * 6));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = '#eee';
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.fillStyle = '#0a7';
      ctx.beginPath();
      ctx.arc(pos.current.x, pos.current.y, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    setFrame((f) => f + 1);
    pushEvent(envelope('move', { type: 'pointer', dx, dy, frame: frame + 1 }));
  }
  function doState() {
    pushEvent(
      envelope('state', {
        frame,
        players: Object.fromEntries(Array.from(players.entries()).map(([id, p]) => [id, { seat: p.seat, alive: true }])),
      })
    );
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') doMove(-1, 0);
      else if (e.key === 'ArrowRight') doMove(1, 0);
      else if (e.key === 'ArrowUp') doMove(0, -1);
      else if (e.key === 'ArrowDown') doMove(0, 1);
    };
    window.addEventListener('keydown', onKey);
    const hb = setInterval(() => {
      if (players.size > 0) doState();
    }, 30000);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(hb);
    };
  }, [players, frame]);

  return (
    <div>
      <header style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #ddd' }}>
        <h1 style={{ fontSize: 16, margin: 0 }}>Minatoku Duel — Web (SWITCH)</h1>
        <label className="small">
          Room <input value={roomId} onChange={(e) => setRoom(e.target.value)} style={{ height: 28 }} />
        </label>
        <label className="small">
          Client <input value={clientId} onChange={(e) => setClient(e.target.value)} style={{ height: 28 }} />
        </label>
        <button onClick={doJoin} style={{ height: 30 }}>join</button>
        <button onClick={doStart} style={{ height: 30 }}>start</button>
        <span style={{ marginLeft: 'auto', color: '#666', fontSize: 12 }}>events: join • start • move • state</span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 340px', gap: 12, padding: 12 }}>
        <aside style={{ border: '1px solid #ddd', borderRadius: 10, padding: 10 }}>
          <h3 style={{ marginTop: 0 }}>Room</h3>
          <div className="small">channel: <code>{chan}</code></div>
          <h3>Players</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{renderPlayersList()}</ul>
        </aside>
        <main style={{ border: '1px solid #ddd', borderRadius: 10, padding: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 8, borderBottom: '1px dashed #ddd' }}>
            <button onClick={() => { pos.current = { x: 80, y: 80 }; const c = canvasRef.current; if (c) { const ctx = c.getContext('2d'); if (ctx) ctx.clearRect(0,0,c.width,c.height); } }}>
              center
            </button>
            <span style={{ color: '#666', fontSize: 12 }}>frame: {frame}</span>
          </div>
          <div style={{ padding: 8 }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: 420, background: '#fff', border: '1px solid #ddd', borderRadius: 8 }} />
          </div>
        </main>
        <aside style={{ border: '1px solid #ddd', borderRadius: 10, padding: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => { const blob = new Blob(['[\n' + logsRef.current.join(',\n') + '\n]'], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'events-'+Date.now()+'.json'; a.click(); URL.revokeObjectURL(a.href); }}>export logs</button>
            <button onClick={() => { logsRef.current = []; }}>clear logs</button>
          </div>
          <div style={{ fontSize: 12, color: '#666', paddingTop: 6 }}>latest:</div>
          <pre style={{ fontSize: 12, color: '#666', maxHeight: 280, overflow: 'auto' }}>{latestRef.current || '(no events)'}</pre>
        </aside>
      </div>
    </div>
  );
}

