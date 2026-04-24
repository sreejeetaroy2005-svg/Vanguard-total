import { useState, useEffect, useCallback } from "react";
 
// ── Grid Constants ─────────────────────────────────────────
const ROWS = 7, COLS = 12, NUM_FLOORS = 3;
 
const T = {
  WALL: "wall", CORRIDOR: "corridor", ROOM: "room",
  EXIT: "exit", STAIR: "stair", ELEVATOR: "elevator",
};
 
const WALKABLE = new Set([T.CORRIDOR, T.ROOM, T.EXIT, T.STAIR, T.ELEVATOR]);
 
// ── Sample Guests ──────────────────────────────────────────
const SAMPLE_GUESTS = {
  "101": { name: "Alice Johnson",   checkin: "Apr 22", checkout: "Apr 26" },
  "102": { name: "Bob Martinez",    checkin: "Apr 23", checkout: "Apr 27" },
  "103": { name: "Carol Chen",      checkin: "Apr 20", checkout: "Apr 28" },
  "104": { name: "David Kim",       checkin: "Apr 21", checkout: "Apr 25" },
  "106": { name: "Frank O'Brien",   checkin: "Apr 24", checkout: "Apr 30" },
  "107": { name: "Grace Patel",     checkin: "Apr 23", checkout: "Apr 27" },
  "201": { name: "Henry Nakamura",  checkin: "Apr 22", checkout: "Apr 28" },
  "202": { name: "Isla Rodriguez",  checkin: "Apr 21", checkout: "Apr 29" },
  "204": { name: "Jack Thompson",   checkin: "Apr 24", checkout: "Apr 26" },
  "205": { name: "Karen Lee",       checkin: "Apr 23", checkout: "Apr 27" },
  "207": { name: "Mike Brown",      checkin: "Apr 22", checkout: "Apr 30" },
  "301": { name: "Nancy Davis",     checkin: "Apr 20", checkout: "Apr 29" },
  "303": { name: "Oscar Silva",     checkin: "Apr 23", checkout: "Apr 28" },
  "305": { name: "Paula Zhang",     checkin: "Apr 24", checkout: "Apr 30" },
  "309": { name: "Quinn Murphy",    checkin: "Apr 22", checkout: "Apr 27" },
};
 
// ── Floor Builder ──────────────────────────────────────────
function makeCell(type, label = "") {
  return { type, label };
}
 
function createFloor(floorIdx) {
  const f = floorIdx + 1;
  const grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => makeCell(T.WALL))
  );
 
  // Corridor band: rows 2, 3, 4
  for (let r = 2; r <= 4; r++)
    for (let c = 0; c <= 11; c++)
      grid[r][c] = makeCell(T.CORRIDOR);
 
  // Stairs at corners of corridors
  grid[2][0]  = makeCell(T.STAIR, "ST");
  grid[2][11] = makeCell(T.STAIR, "ST");
  grid[4][0]  = makeCell(T.STAIR, "ST");
  grid[4][11] = makeCell(T.STAIR, "ST");
 
  // Row 3 ends: EXIT (floor 1) or STAIR (upper floors)
  if (f === 1) {
    grid[3][0]  = makeCell(T.EXIT, "EXIT A");
    grid[3][11] = makeCell(T.EXIT, "EXIT B");
  } else {
    grid[3][0]  = makeCell(T.STAIR, "ST");
    grid[3][11] = makeCell(T.STAIR, "ST");
  }
 
  // Elevator in center
  grid[3][6] = makeCell(T.ELEVATOR, "EL");
 
  // Rooms: 5 on top (row 1), 5 on bottom (row 5) at odd cols
  const roomCols = [1, 3, 5, 7, 9];
  roomCols.forEach((c, i) => {
    grid[1][c] = makeCell(T.ROOM, `${f}0${i + 1}`);
    const botNum = i + 6;
    grid[5][c] = makeCell(T.ROOM, `${f}${botNum < 10 ? "0" : ""}${botNum}`);
  });
 
  return grid;
}
 
// ── BFS Pathfinding ────────────────────────────────────────
function bfs(grid, startR, startC, isTarget) {
  const rows = grid.length, cols = grid[0].length;
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const queue = [[startR, startC, [{ r: startR, c: startC }]]];
  visited[startR][startC] = true;
 
  while (queue.length) {
    const [r, c, path] = queue.shift();
    if (isTarget(grid[r][c])) return path;
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
          !visited[nr][nc] && WALKABLE.has(grid[nr][nc].type)) {
        visited[nr][nc] = true;
        queue.push([nr, nc, [...path, { r: nr, c: nc }]]);
      }
    }
  }
  return null;
}
 
function computeExitPlan(floors, roomLabel) {
  let roomFloor = -1, roomR = -1, roomC = -1;
  outer: for (let f = 0; f < floors.length; f++)
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (floors[f][r][c].type === T.ROOM && floors[f][r][c].label === roomLabel) {
          [roomFloor, roomR, roomC] = [f, r, c]; break outer;
        }
  if (roomFloor === -1) return null;
 
  const isConnector = cell => cell.type === T.STAIR || cell.type === T.ELEVATOR;
  const isExit = cell => cell.type === T.EXIT;
  const segments = [];
 
  if (roomFloor === 0) {
    const path = bfs(floors[0], roomR, roomC, isExit);
    if (path) segments.push({ floorIdx: 0, path });
  } else {
    const path1 = bfs(floors[roomFloor], roomR, roomC, isConnector);
    if (!path1) return null;
    segments.push({ floorIdx: roomFloor, path: path1 });
    let last = path1[path1.length - 1];
 
    for (let f = roomFloor - 1; f >= 0; f--) {
      if (f === 0) {
        const p = bfs(floors[0], last.r, last.c, isExit);
        if (p) segments.push({ floorIdx: 0, path: p });
        break;
      } else {
        const p = bfs(floors[f], last.r, last.c, isConnector);
        if (p && p.length > 0) {
          segments.push({ floorIdx: f, path: p });
          last = p[p.length - 1];
        }
      }
    }
  }
  return { roomFloor, roomR, roomC, roomLabel, segments };
}
 
// ── Cell Visual Config ─────────────────────────────────────
const CSTY = {
  wall:     { bg: "#060d1c", border: "#0a1828" },
  corridor: { bg: "#0c1e38", border: "#142a4e" },
  room:     { bg: "#0a2d5c", border: "#1a4a80", text: "#4a9eff" },
  exit:     { bg: "#3d0e0e", border: "#831a1a", text: "#ff4444" },
  stair:    { bg: "#3a2100", border: "#7a4800", text: "#ffaa00" },
  elevator: { bg: "#2a0f4a", border: "#5b21b6", text: "#a855f7" },
};
 
const TOOL_ICONS = {
  [T.CORRIDOR]: "▪", [T.WALL]: "█", [T.ROOM]: "⬜",
  [T.EXIT]: "🚪", [T.STAIR]: "🪜", [T.ELEVATOR]: "🛗",
};
 
// ── Main App ───────────────────────────────────────────────
export default function HotelMapSystem({ onClose }) {
  const [floors, setFloors] = useState(() =>
    Array.from({ length: NUM_FLOORS }, (_, i) => createFloor(i))
  );
  const [selFloor, setSelFloor] = useState(0);
  const [mode, setMode] = useState("guest");
  const [editTool, setEditTool] = useState(T.CORRIDOR);
  const [activePlan, setActivePlan] = useState(null);
  const [search, setSearch] = useState("");
  const [animStep, setAnimStep] = useState(0);
 
  useEffect(() => {
    if (!activePlan) return;
    const id = setInterval(() => setAnimStep(s => s + 1), 110);
    return () => clearInterval(id);
  }, [activePlan]);
 
  const handleCell = useCallback((r, c) => {
    const cell = floors[selFloor][r][c];
    if (mode === "admin") {
      setFloors(prev => prev.map((fl, fi) =>
        fi !== selFloor ? fl :
        fl.map((row, ri) => ri !== r ? row :
          row.map((cel, ci) => ci !== c ? cel :
            makeCell(editTool,
              editTool === T.ROOM ? `${selFloor+1}XX` :
              editTool === T.EXIT ? "EXIT" :
              editTool === T.STAIR ? "ST" :
              editTool === T.ELEVATOR ? "EL" : ""
            )
          )
        )
      ));
    } else if (cell.type === T.ROOM) {
      const plan = computeExitPlan(floors, cell.label);
      setActivePlan(plan);
      if (plan) setSelFloor(plan.roomFloor);
      setAnimStep(0);
    }
  }, [mode, editTool, floors, selFloor]);
 
  const curGrid = floors[selFloor];
  const curSegment = activePlan?.segments.find(s => s.floorIdx === selFloor);
  const pathArr = curSegment?.path || [];
  const pathSet = new Set(pathArr.map(p => `${p.r},${p.c}`));
 
  const allGuests = Object.entries(SAMPLE_GUESTS).filter(([room, d]) =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    room.includes(search)
  );
 
  const totalSteps = activePlan?.segments.reduce((a, s) => a + Math.max(0, s.path.length - 1), 0) ?? 0;
  const CELL_SZ = 44;
 
  return (
    <div style={{ fontFamily: "'Rajdhani','Segoe UI',sans-serif", background: "#030a16", minHeight: "100vh", color: "#c8d8e8", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a1628; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
        @keyframes exit-pulse { 0%,100%{box-shadow:0 0 6px #ff3b3b66}50%{box-shadow:0 0 18px #ff3b3bcc} }
        @keyframes path-glow  { 0%,100%{opacity:.5;box-shadow:0 0 4px #00e07044}50%{opacity:1;box-shadow:0 0 12px #00e070cc} }
        @keyframes blink      { 0%,100%{opacity:1}50%{opacity:.3} }
        @keyframes fadeIn     { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none} }
        @keyframes room-sel   { 0%,100%{box-shadow:0 0 8px #0088ffaa}50%{box-shadow:0 0 20px #0088ffee} }
        .cell { transition: filter .1s, transform .1s; }
        .cell:hover { filter: brightness(1.4); transform: scale(1.05); cursor: pointer; z-index:2; position:relative; }
        .wall-cell { cursor: default; }
        .wall-cell:hover { filter: none; transform: none; }
        .guest-row { padding:8px 10px; border-radius:4px; cursor:pointer; border:1px solid #1e3a5f22; margin-bottom:4px; transition:all .15s; }
        .guest-row:hover { background:#0d1f38; border-color:#1e4080; }
        .tool-btn { padding:8px 12px; border-radius:3px; cursor:pointer; font-family:'IBM Plex Mono',monospace; font-size:11px; transition:all .15s; width:100%; display:flex; align-items:center; gap:8px; margin-bottom:4px; border:1px solid; letter-spacing:.5px; }
        .floor-tab { padding:6px 18px; border:1px solid; border-bottom:none; cursor:pointer; font-weight:600; font-size:13px; letter-spacing:1px; transition:all .15s; border-radius:4px 4px 0 0; }
        .floor-tab:hover { filter:brightness(1.3); }
        .mode-btn { padding:6px 16px; border-radius:3px; border:1px solid; cursor:pointer; font-family:'Rajdhani',sans-serif; font-size:13px; font-weight:600; letter-spacing:1px; transition:all .2s; }
      `}</style>
 
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={{ padding: "10px 20px", background: "#040c1a", borderBottom: "1px solid #0f2a4a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: "linear-gradient(135deg,#003fa3,#0077e6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 0 14px #0044bb66" }}>🏨</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 4, color: "#ddeeff", lineHeight: 1 }}>NEXUS GRAND</div>
            <div style={{ fontSize: 10, color: "#3a6a9a", letterSpacing: 2.5, fontFamily: "'IBM Plex Mono',monospace" }}>EMERGENCY EVACUATION SYSTEM</div>
          </div>
          {activePlan && (
            <div style={{ marginLeft: 20, padding: "4px 12px", borderRadius: 3, background: "#3d0e0e", border: "1px solid #831a1a", fontSize: 12, color: "#ff4444", letterSpacing: 1.5, animation: "blink 1.5s infinite", fontFamily: "'IBM Plex Mono',monospace" }}>
              🚨 EVACUATION ACTIVE — ROOM {activePlan.roomLabel}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {onClose && (
            <button className="mode-btn" onClick={onClose} style={{background: '#ff4444', color: '#fff', borderColor: '#831a1a'}}>
              X CLOSE MAP
            </button>
          )}
          {["guest", "admin"].map(m => (
            <button key={m} className="mode-btn"
              onClick={() => { setMode(m); setActivePlan(null); setSearch(""); }}
              style={{ background: mode === m ? (m === "admin" ? "#7f1d1d" : "#0a2d5c") : "transparent", color: mode === m ? "#fff" : "#3a6a9a", borderColor: mode === m ? "transparent" : "#1e3a5f" }}>
              {m === "guest" ? "👤 GUEST" : "⚙ ADMIN"}
            </button>
          ))}
        </div>
      </div>
 
      {/* ── BODY ───────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
 
        {/* LEFT SIDEBAR */}
        <div style={{ width: 250, background: "#040c1a", borderRight: "1px solid #0f2a4a", display: "flex", flexDirection: "column", padding: 14, gap: 14, overflowY: "auto" }}>
 
          {mode === "guest" ? (<>
            {/* Search */}
            <div>
              <div style={{ fontSize: 10, color: "#3a6a9a", letterSpacing: 2.5, marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace" }}>GUEST LOOKUP</div>
              <input placeholder="Name or room #…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 4, background: "#09162a", border: "1px solid #1e3a5f", color: "#c8d8e8", fontSize: 13, fontFamily: "'Rajdhani',sans-serif", outline: "none" }} />
            </div>
 
            {/* Guest list */}
            <div>
              <div style={{ fontSize: 10, color: "#3a6a9a", letterSpacing: 2.5, marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace" }}>CHECKED IN ({allGuests.length})</div>
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {allGuests.map(([room, d]) => (
                  <div key={room} className="guest-row"
                    style={{ background: activePlan?.roomLabel === room ? "#0d2545" : "transparent", borderColor: activePlan?.roomLabel === room ? "#0047ab" : "#1e3a5f22" }}
                    onClick={() => {
                      const plan = computeExitPlan(floors, room);
                      setActivePlan(plan);
                      if (plan) setSelFloor(plan.roomFloor);
                      setAnimStep(0);
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#ddeeff" }}>{d.name}</span>
                      <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: "#4a9eff", background: "#0a2d5c", padding: "1px 6px", borderRadius: 3 }}>{room}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#3a6a9a", marginTop: 2 }}>{d.checkin} → {d.checkout}</div>
                  </div>
                ))}
              </div>
            </div>
 
            {/* Active plan */}
            {activePlan && (
              <div style={{ background: "#07182e", border: "1px solid #1e4080", borderRadius: 6, padding: 12, animation: "fadeIn .3s ease" }}>
                <div style={{ fontSize: 10, color: "#ff4444", letterSpacing: 2.5, marginBottom: 10, fontFamily: "'IBM Plex Mono',monospace", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ animation: "blink 1s infinite" }}>🚨</span> EXIT PLAN
                </div>
                {SAMPLE_GUESTS[activePlan.roomLabel] && (
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#c8d8e8", paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid #1e3a5f" }}>
                    {SAMPLE_GUESTS[activePlan.roomLabel].name}
                    <div style={{ fontSize: 11, color: "#3a6a9a", fontWeight: 400 }}>Room {activePlan.roomLabel} · Floor {activePlan.roomFloor + 1}</div>
                  </div>
                )}
                {activePlan.segments.map((seg, i) => {
                  const last = seg.path[seg.path.length - 1];
                  const endCell = floors[seg.floorIdx][last.r][last.c];
                  const steps = Math.max(0, seg.path.length - 1);
                  const icon = endCell.type === T.EXIT ? "🚪" : endCell.type === T.STAIR ? "🪜" : "🛗";
                  const color = endCell.type === T.EXIT ? "#ff4444" : endCell.type === T.STAIR ? "#ffaa00" : "#a855f7";
                  return (
                    <div key={i} onClick={() => setSelFloor(seg.floorIdx)}
                      style={{ padding: "6px 8px", borderRadius: 4, marginBottom: 4, cursor: "pointer", background: selFloor === seg.floorIdx ? "#0d2545" : "transparent", border: `1px solid ${selFloor === seg.floorIdx ? "#1e4080" : "transparent"}`, transition: "all .15s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#4a9eff" }}>Floor {seg.floorIdx + 1}</span>
                        <span style={{ fontSize: 11, color: "#3a6a9a", fontFamily: "'IBM Plex Mono',monospace" }}>{steps} steps</span>
                      </div>
                      <div style={{ fontSize: 12, color, marginTop: 2 }}>{icon} {endCell.label || endCell.type}</div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e3a5f", fontSize: 11, color: "#3a6a9a", fontFamily: "'IBM Plex Mono',monospace" }}>
                  ↳ {totalSteps} total steps · {activePlan.segments.length} floor{activePlan.segments.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </>) : (<>
            {/* Admin tools */}
            <div style={{ fontSize: 10, color: "#ff8888", letterSpacing: 2.5, fontFamily: "'IBM Plex Mono',monospace" }}>⚠ ADMIN MODE</div>
            <div>
              <div style={{ fontSize: 10, color: "#3a6a9a", letterSpacing: 2.5, marginBottom: 8, fontFamily: "'IBM Plex Mono',monospace" }}>PAINT TOOL</div>
              {Object.entries({ [T.CORRIDOR]:"CORRIDOR",[T.WALL]:"WALL",[T.ROOM]:"ROOM",[T.EXIT]:"EXIT",[T.STAIR]:"STAIR",[T.ELEVATOR]:"ELEVATOR" }).map(([type, label]) => {
                const cs = CSTY[type];
                const active = editTool === type;
                return (
                  <button key={type} className="tool-btn" onClick={() => setEditTool(type)}
                    style={{ background: active ? cs.bg : "transparent", borderColor: active ? cs.border : "#1e3a5f44", color: active ? (cs.text || "#c8d8e8") : "#3a6a9a" }}>
                    <span>{TOOL_ICONS[type]}</span>{label}
                  </button>
                );
              })}
            </div>
            <div style={{ padding: 10, background: "#09162a", borderRadius: 4, border: "1px solid #1e3a5f33", fontSize: 12, color: "#3a6a9a" }}>
              Click any cell to paint. Room labels auto-assigned by floor.
            </div>
          </>)}
        </div>
 
        {/* MAP AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 24px", overflowX: "auto" }}>
 
          {/* Floor tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: NUM_FLOORS }, (_, i) => {
              const hasPlan = activePlan?.segments.some(s => s.floorIdx === i);
              return (
                <button key={i} className="floor-tab"
                  onClick={() => setSelFloor(i)}
                  style={{ background: selFloor === i ? "#0c1e38" : "#040c1a", color: selFloor === i ? "#ddeeff" : "#3a6a9a", borderColor: selFloor === i ? "#1e4080" : "#0f2a4a" }}>
                  FLOOR {i + 1}
                  {hasPlan && <span style={{ marginLeft: 5, color: "#ff4444", animation: "blink 1s infinite", fontSize: 10 }}>●</span>}
                </button>
              );
            })}
          </div>
 
          {/* Grid */}
          <div style={{ background: "#0c1e38", border: "1px solid #1e4080", borderRadius: "0 8px 8px 8px", padding: 16, display: "inline-block" }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, ${CELL_SZ}px)`, gridTemplateRows: `repeat(${ROWS}, ${CELL_SZ}px)`, gap: 2 }}>
              {curGrid.map((row, r) => row.map((cell, c) => {
                const key = `${r},${c}`;
                const isPath = pathSet.has(key);
                const pathIdx = pathArr.findIndex(p => p.r === r && p.c === c);
                const cycle = pathArr.length + 6;
                const isLit = isPath && pathIdx <= (animStep % cycle);
                const isActiveRoom = activePlan && selFloor === activePlan.roomFloor && r === activePlan.roomR && c === activePlan.roomC;
                const hasGuest = cell.type === T.ROOM && !!SAMPLE_GUESTS[cell.label];
                const cs = CSTY[cell.type];
 
                let bg = cs.bg, border = cs.border;
                let anim = "";
                if (cell.type === T.EXIT) anim = "exit-pulse 1.5s infinite";
                if (isActiveRoom) { bg = "#003d8f"; border = "#0088ff"; anim = "room-sel 1.5s infinite"; }
                else if (isLit && !isActiveRoom) { bg = "#01301a"; border = "#00dd66"; anim = "path-glow 1s infinite"; }
 
                return (
                  <div key={key}
                    className={cell.type !== T.WALL ? "cell" : "wall-cell"}
                    onClick={() => handleCell(r, c)}
                    title={cell.label + (hasGuest ? ` — ${SAMPLE_GUESTS[cell.label].name}` : "")}
                    style={{ width: CELL_SZ, height: CELL_SZ, background: bg, border: `1px solid ${border}`, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", animation: anim }}>
 
                    {cell.type === T.ROOM && (<>
                      <div style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: isActiveRoom ? "#66aaff" : cs.text, lineHeight: 1 }}>{cell.label}</div>
                      {hasGuest && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#00dd66", marginTop: 3, boxShadow: "0 0 4px #00dd66" }} />}
                    </>)}
 
                    {cell.type === T.EXIT && (<>
                      <div style={{ fontSize: 15 }}>🚪</div>
                      <div style={{ fontSize: 7.5, fontWeight: 700, color: "#ff4444", letterSpacing: .5, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.2, textAlign: "center" }}>{cell.label}</div>
                    </>)}
 
                    {cell.type === T.STAIR    && <div style={{ fontSize: 18 }}>🪜</div>}
                    {cell.type === T.ELEVATOR && <div style={{ fontSize: 18 }}>🛗</div>}
 
                    {/* Path dot on corridor */}
                    {isPath && cell.type === T.CORRIDOR && (
                      <div style={{ position: "absolute", width: isLit ? 10 : 5, height: isLit ? 10 : 5, borderRadius: "50%", background: isLit ? "#00ff88" : "#00441a", boxShadow: isLit ? "0 0 8px #00ff88" : "none", transition: "all .1s" }} />
                    )}
                  </div>
                );
              }))}
            </div>
 
            {/* Legend */}
            <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
              {[
                { color: "#1a4a80", label: "ROOM" },
                { color: "#ff3b3b", label: "EXIT" },
                { color: "#ffaa00", label: "STAIR" },
                { color: "#a855f7", label: "ELEVATOR" },
                { color: "#00ff88", label: "ESCAPE PATH" },
                { color: "#00dd66", label: "GUEST", dot: true },
              ].map(it => (
                <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#3a6a9a", fontFamily: "'IBM Plex Mono',monospace" }}>
                  <div style={{ width: it.dot ? 6 : 12, height: it.dot ? 6 : 8, borderRadius: it.dot ? "50%" : 2, background: it.color, boxShadow: `0 0 4px ${it.color}66` }} />
                  {it.label}
                </div>
              ))}
            </div>
          </div>
 
          {/* Hint */}
          {mode === "guest" && !activePlan && (
            <div style={{ marginTop: 16, color: "#2a5a8a", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }}>
              ← Select a guest from the sidebar, or click a room on the map to generate their exit plan
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
