import { useState, useEffect, useCallback } from "react";
 
// ── Grid Constants ─────────────────────────────────────────
const ROWS = 7, COLS = 12, NUM_FLOORS = 3;
 
const T = {
  WALL: "wall", CORRIDOR: "corridor", ROOM: "room",
  EXIT: "exit", STAIR: "stair", ELEVATOR: "elevator",
};
 
const WALKABLE = new Set([T.CORRIDOR, T.ROOM, T.EXIT, T.STAIR, T.ELEVATOR]);
 
const SAMPLE_GUESTS = {
  "101": { name: "Guest 101",   checkin: "Apr 22", checkout: "Apr 26" },
  "102": { name: "Guest 102",    checkin: "Apr 23", checkout: "Apr 27" },
  "201": { name: "Guest 201",  checkin: "Apr 22", checkout: "Apr 28" },
  "301": { name: "Guest 301",     checkin: "Apr 20", checkout: "Apr 29" },
};
 
function makeCell(type, label = "") {
  return { type, label };
}
 
function createFloor(floorIdx) {
  const f = floorIdx + 1;
  const grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => makeCell(T.WALL))
  );
  for (let r = 2; r <= 4; r++)
    for (let c = 0; c <= 11; c++)
      grid[r][c] = makeCell(T.CORRIDOR);
  grid[2][0]  = makeCell(T.STAIR, "ST");
  grid[2][11] = makeCell(T.STAIR, "ST");
  grid[4][0]  = makeCell(T.STAIR, "ST");
  grid[4][11] = makeCell(T.STAIR, "ST");
  if (f === 1) {
    grid[3][0]  = makeCell(T.EXIT, "EXIT A");
    grid[3][11] = makeCell(T.EXIT, "EXIT B");
  } else {
    grid[3][0]  = makeCell(T.STAIR, "ST");
    grid[3][11] = makeCell(T.STAIR, "ST");
  }
  grid[3][6] = makeCell(T.ELEVATOR, "EL");
  const roomCols = [1, 3, 5, 7, 9];
  roomCols.forEach((c, i) => {
    grid[1][c] = makeCell(T.ROOM, `${f}0${i + 1}`);
    const botNum = i + 6;
    grid[5][c] = makeCell(T.ROOM, `${f}${botNum < 10 ? "0" : ""}${botNum}`);
  });
  return grid;
}
 
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
 
const CSTY = {
  wall:     { bg: "#050505", border: "#111" },
  corridor: { bg: "#0a0a0f", border: "#1a1a25" },
  room:     { bg: "#0f172a", border: "#1e293b", text: "#38bdf8" },
  exit:     { bg: "#450a0a", border: "#991b1b", text: "#f87171" },
  stair:    { bg: "#451a03", border: "#92400e", text: "#fbbf24" },
  elevator: { bg: "#2e1065", border: "#5b21b6", text: "#a78bfa" },
};
 
export default function HotelMapSystem({ onClose }) {
  const [floors, setFloors] = useState(() => Array.from({ length: NUM_FLOORS }, (_, i) => createFloor(i)));
  const [selFloor, setSelFloor] = useState(0);
  const [activePlan, setActivePlan] = useState(null);
  const [animStep, setAnimStep] = useState(0);
 
  useEffect(() => {
    if (!activePlan) return;
    const id = setInterval(() => setAnimStep(s => s + 1), 150);
    return () => clearInterval(id);
  }, [activePlan]);
 
  const handleCell = useCallback((r, c) => {
    const cell = floors[selFloor][r][c];
    if (cell.type === T.ROOM) {
      const plan = computeExitPlan(floors, cell.label);
      setActivePlan(plan);
      if (plan) setSelFloor(plan.roomFloor);
      setAnimStep(0);
    }
  }, [floors, selFloor]);
 
  const curGrid = floors[selFloor];
  const curSegment = activePlan?.segments.find(s => s.floorIdx === selFloor);
  const pathArr = curSegment?.path || [];
  const pathSet = new Set(pathArr.map(p => `${p.r},${p.c}`));
  const totalSteps = activePlan?.segments.reduce((a, s) => a + Math.max(0, s.path.length - 1), 0) ?? 0;
 
  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col hud-font p-6 md:p-12 overflow-hidden">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8 tactical-glass p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center text-2xl border border-sky-500/30">🧭</div>
          <div>
            <h2 className="hud-title text-xl font-black text-white">EVACUATION <span className="text-sky-500">RADAR</span></h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em]">Facility Grid Analysis</p>
          </div>
        </div>
        <button onClick={onClose} className="px-8 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] rounded-xl tracking-widest uppercase transition-all">EXIT MAP</button>
      </div>

      <div className="flex flex-1 gap-8 overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-64 space-y-6">
          <div className="tactical-glass p-6 rounded-3xl">
            <h3 className="text-[10px] font-black text-sky-500 tracking-widest uppercase mb-4">Current Route</h3>
            {activePlan ? (
              <div className="space-y-4">
                <p className="text-sm font-bold text-white">ROOM {activePlan.roomLabel}</p>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                   <p className="text-[9px] text-zinc-500 uppercase">Estimated Path</p>
                   <p className="text-lg font-black text-emerald-400">{totalSteps} STEPS</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-600 font-medium italic">Click any ROOM on the grid to calculate escape route.</p>
            )}
          </div>

          <div className="tactical-glass p-6 rounded-3xl">
             <h3 className="text-[10px] font-black text-rose-500 tracking-widest uppercase mb-4">Legend</h3>
             <div className="space-y-3">
                <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400"><div className="w-3 h-3 bg-[#f87171] rounded-sm"></div> EMERGENCY EXIT</div>
                <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400"><div className="w-3 h-3 bg-[#fbbf24] rounded-sm"></div> FIRE STAIRS</div>
                <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400"><div className="w-3 h-3 bg-[#0ebd66] rounded-sm shadow-[0_0_8px_#0ebd66]"></div> SAFE PATH</div>
             </div>
          </div>
        </div>

        {/* MAP GRID AREA */}
        <div className="flex-1 flex flex-col">
          <div className="flex gap-2 mb-2">
            {[0, 1, 2].map(i => (
              <button 
                key={i} 
                onClick={() => setSelFloor(i)}
                className={`px-6 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  selFloor === i ? 'bg-sky-600 text-white' : 'bg-zinc-900 text-zinc-600 hover:bg-zinc-800'
                }`}
              >
                FLOOR {i+1}
              </button>
            ))}
          </div>

          <div className="tactical-glass p-8 rounded-b-3xl rounded-tr-3xl flex-1 flex items-center justify-center bg-black/40">
             <div className="grid gap-2 overflow-auto" style={{ gridTemplateColumns: `repeat(${COLS}, 50px)` }}>
               {curGrid.map((row, r) => row.map((cell, c) => {
                 const key = `${r},${c}`;
                 const isPath = pathSet.has(key);
                 const pathIdx = pathArr.findIndex(p => p.r === r && p.c === c);
                 const isLit = isPath && pathIdx <= (animStep % (pathArr.length + 5));
                 const cs = CSTY[cell.type];

                 return (
                   <div 
                     key={key}
                     onClick={() => handleCell(r, c)}
                     className={`w-[50px] h-[50px] rounded-lg border transition-all flex flex-col items-center justify-center cursor-pointer hover:scale-105 active:scale-95 ${
                       isLit ? 'shadow-[0_0_15px_rgba(16,185,129,0.5)] border-emerald-500 bg-emerald-500/20' : ''
                     }`}
                     style={{ 
                       background: isLit ? undefined : cs.bg, 
                       borderColor: isLit ? undefined : cs.border 
                     }}
                   >
                     {cell.type === T.ROOM && <span className="text-[10px] font-black text-white">{cell.label}</span>}
                     {cell.type === T.EXIT && <span className="text-xl">🚪</span>}
                     {cell.type === T.STAIR && <span className="text-xl">🪜</span>}
                     {cell.type === T.ELEVATOR && <span className="text-xl">🛗</span>}
                     {isPath && !isLit && <div className="w-1.5 h-1.5 rounded-full bg-emerald-900"></div>}
                     {isLit && <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]"></div>}
                   </div>
                 );
               }))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
