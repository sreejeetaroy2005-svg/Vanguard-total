import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
 
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
 
function bfs(grid, startR, startC, isTarget, blockedSet) {
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
        if (blockedSet && blockedSet.has(`${nr},${nc}`)) continue; // DIJKSTRA SAFEST SURVIVABLE ROUTING
        visited[nr][nc] = true;
        queue.push([nr, nc, [...path, { r: nr, c: nc }]]);
      }
    }
  }
  return null;
}
 
function computeExitPlan(floors, roomLabel, blockedSets, isWheelchairActive) {
  let roomFloor = -1, roomR = -1, roomC = -1;
  outer: for (let f = 0; f < floors.length; f++)
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (floors[f][r][c].type === T.ROOM && floors[f][r][c].label === roomLabel) {
          [roomFloor, roomR, roomC] = [f, r, c]; break outer;
        }
  if (roomFloor === -1) return null;
  const isConnector = cell => {
    if (isWheelchairActive) return cell.type === T.ELEVATOR;
    return cell.type === T.STAIR || cell.type === T.ELEVATOR;
  };
  const isExit = cell => cell.type === T.EXIT;
  const segments = [];
  if (roomFloor === 0) {
    const path = bfs(floors[0], roomR, roomC, isExit, blockedSets[0]);
    if (path) segments.push({ floorIdx: 0, path });
  } else {
    const path1 = bfs(floors[roomFloor], roomR, roomC, isConnector, blockedSets[roomFloor]);
    if (!path1) return null;
    segments.push({ floorIdx: roomFloor, path: path1 });
    let last = path1[path1.length - 1];
    for (let f = roomFloor - 1; f >= 0; f--) {
      if (f === 0) {
        const p = bfs(floors[0], last.r, last.c, isExit, blockedSets[0]);
        if (p) segments.push({ floorIdx: 0, path: p });
        break;
      } else {
        const p = bfs(floors[f], last.r, last.c, isConnector, blockedSets[f]);
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
  wall:     { bg: "transparent", border: "rgba(255, 255, 255, 0.01)" },
  corridor: { bg: "rgba(24, 24, 27, 0.2)", border: "rgba(255, 255, 255, 0.03)" },
  room:     { bg: "rgba(14, 165, 233, 0.05)", border: "rgba(14, 165, 233, 0.15)", text: "#38bdf8" },
  exit:     { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.25)", text: "#f87171" },
  stair:    { bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.2)", text: "#fbbf24" },
  elevator: { bg: "rgba(139, 92, 246, 0.08)", border: "rgba(139, 92, 246, 0.2)", text: "#a78bfa" },
};
 
export default function HotelMapSystem({ onClose }) {
  const [floors, setFloors] = useState(() => Array.from({ length: NUM_FLOORS }, (_, i) => createFloor(i)));
  const [selFloor, setSelFloor] = useState(0);
  const [activePlan, setActivePlan] = useState(null);
  const [animStep, setAnimStep] = useState(0);
  const [alerts, setAlerts] = useState([]);
 
  useEffect(() => {
    const alertsRef = collection(db, "alerts");
    const q = query(alertsRef, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alertList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const active = alertList.filter(a => a.status !== "RESOLVED");
      setAlerts(active);
    }, (err) => {
      console.error("Failed to load alerts in map:", err);
    });
    return () => unsubscribe();
  }, []);
 
  const getBlockedCells = useCallback((floorIdx) => {
    const blocked = new Map();
    const floorNum = floorIdx + 1;
    
    // Only FIRE / HAZARD type alerts block map cells — not general guest SOS alerts
    const HAZARD_TYPES = new Set(['FIRE', 'HEAVY_SMOKE', 'LIGHT_SMOKE', 'GAS_LEAK', 'STRUCTURAL_DAMAGE', 'FLOODING', 'CONGESTION']);

    alerts.forEach(alert => {
      const hazardType = (alert.emergencyType || alert.contextType || '').toUpperCase();
      const isHazard = HAZARD_TYPES.has(hazardType);
      
      // Skip non-hazard SOS alerts (e.g. GENERAL, MEDICAL, THREAT) — they should NOT mark rooms as fire zones
      if (!isHazard) return;

      const loc = (alert.roomNumber || "").toUpperCase();
      const directSources = [];
      
      // 1. If it's a corridor alert:
      if (loc.includes("NORTH") || loc.includes("H_NORTH")) {
        for (let c = 0; c < COLS; c++) {
          directSources.push({ r: 2, c });
        }
      } else if (loc.includes("SOUTH") || loc.includes("H_SOUTH")) {
        for (let c = 0; c < COLS; c++) {
          directSources.push({ r: 4, c });
        }
      }
      
      // 2. If it's a room alert (e.g. R301 or 301):
      const match = loc.match(/\d+/);
      if (match) {
        const roomStr = match[0];
        const rFloor = parseInt(roomStr.charAt(0));
        if (rFloor === floorNum) {
          const roomIndex = parseInt(roomStr.substring(1));
          if (roomIndex <= 5) {
            const col = (roomIndex - 1) * 2 + 1;
            directSources.push({ r: 1, c: col });
          } else {
            const col = (roomIndex - 6) * 2 + 1;
            directSources.push({ r: 5, c: col });
          }
        }
      }

      // Propagate fire: Mark sources as "SOURCE", and adjacent cells as "BUFFER"
      directSources.forEach(({ r, c }) => {
        blocked.set(`${r},${c}`, "SOURCE");
        const neighbors = [
          { r: r - 1, c }, // Up
          { r: r + 1, c }, // Down
          { r, c: c - 1 }, // Left
          { r, c: c + 1 }  // Right
        ];
        neighbors.forEach(n => {
          if (n.r >= 0 && n.r < ROWS && n.c >= 0 && n.c < COLS) {
            const key = `${n.r},${n.c}`;
            // Avoid overwriting a direct source with a buffer zone
            if (blocked.get(key) !== "SOURCE") {
              blocked.set(key, "BUFFER");
            }
          }
        });
      });
    });
    
    return blocked;
  }, [alerts]);
 
  const blockedSets = [getBlockedCells(0), getBlockedCells(1), getBlockedCells(2)];
 
  useEffect(() => {
    if (!activePlan) return;
    const id = setInterval(() => setAnimStep(s => s + 1), 150);
    return () => clearInterval(id);
  }, [activePlan]);
 
  const handleCell = useCallback((r, c) => {
    const cell = floors[selFloor][r][c];
    if (cell.type === T.ROOM) {
      const isWheelchair = alerts.some(a => 
        a.vulnerabilityProfile === 'WHEELCHAIR' && (a.roomNumber === cell.label || a.roomNumber === `R${cell.label}`)
      );
      const plan = computeExitPlan(floors, cell.label, blockedSets, isWheelchair);
      if (plan) {
        plan.isWheelchairActive = isWheelchair;
      }
      setActivePlan(plan);
      if (plan) setSelFloor(plan.roomFloor);
      setAnimStep(0);
    }
  }, [floors, selFloor, blockedSets, alerts]);
 
  const curGrid = floors[selFloor];
  const curBlockedSet = blockedSets[selFloor];
  const curSegment = activePlan?.segments.find(s => s.floorIdx === selFloor);
  const pathArr = curSegment?.path || [];
  const pathSet = new Set(pathArr.map(p => `${p.r},${p.c}`));
  const totalSteps = activePlan?.segments.reduce((a, s) => a + Math.max(0, s.path.length - 1), 0) ?? 0;
 
  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 flex flex-col p-6 md:p-12 overflow-hidden relative">
      <div className="cyber-grid absolute inset-0"></div>
 
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8 tactical-glass p-6 rounded-3xl border border-white/5 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-sky-500/10 text-sky-400 rounded-2xl flex items-center justify-center text-2xl border border-sky-500/20 shadow-[0_0_15px_rgba(14,165,233,0.15)]">🧭</div>
          <div>
            <h2 className="font-display text-xl font-black text-white uppercase tracking-wider">EVACUATION MAP</h2>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.25em] mt-0.5">Facility Grid Routing Radar</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="px-8 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] rounded-xl tracking-widest uppercase transition-all shadow-[0_4px_25px_rgba(239,68,68,0.25)] cursor-pointer"
        >
          Exit Map View
        </button>
      </div>
 
      <div className="flex flex-col md:flex-row flex-1 gap-8 overflow-hidden relative z-10">
        {/* SIDEBAR */}
        <div className="w-full md:w-64 space-y-4 md:space-y-6 flex-shrink-0">
          <div className="tactical-glass p-6 rounded-3xl border border-white/5">
            <h3 className="text-[9px] font-black text-sky-400 tracking-widest uppercase mb-4">Calculated Route</h3>
            {activePlan ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Origin room</span>
                  <p className="text-xl font-black text-white mt-0.5">ROOM {activePlan.roomLabel}</p>
                </div>
                {activePlan.isWheelchairActive && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[8px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(59,130,246,0.15)] animate-pulse">
                    <span>♿</span> Accessible Route Active
                  </div>
                )}
                <div className="p-4 bg-zinc-950/60 rounded-2xl border border-white/5">
                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Evac Distance</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{totalSteps} STEPS</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 leading-relaxed font-medium italic">Click any highlighted ROOM on the map grid to compute a SafePath escape vector.</p>
            )}
          </div>
 
          <div className="tactical-glass p-6 rounded-3xl border border-white/5">
            <h3 className="text-[9px] font-black text-rose-500 tracking-widest uppercase mb-4">Tactical Legend</h3>
            <div className="space-y-3.5">
              <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400">
                <div className="w-3.5 h-3.5 bg-rose-500/20 border border-rose-500/40 rounded-md"></div>
                EMERGENCY EXIT
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400">
                <div className="w-3.5 h-3.5 bg-amber-500/20 border border-amber-500/40 rounded-md"></div>
                FIRE ESCAPE STAIRS
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400">
                <div className="w-3.5 h-3.5 bg-emerald-500/20 border border-emerald-500/60 rounded-md shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div>
                SAFE VECTOR
              </div>
            </div>
          </div>
        </div>
 
        {/* MAP GRID AREA */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <button 
                key={i} 
                onClick={() => setSelFloor(i)}
                className={`px-6 py-3 rounded-t-2xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  selFloor === i 
                    ? 'bg-sky-600 border-t border-x border-sky-500 text-white shadow-[0_-5px_15px_rgba(14,165,233,0.15)]' 
                    : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border-t border-x border-white/5'
                }`}
              >
                FLOOR {i+1}
              </button>
            ))}
          </div>
 
          <div className="tactical-glass p-8 rounded-b-3xl rounded-tr-3xl flex-1 flex items-center justify-center bg-zinc-950/20 border border-white/5 overflow-auto">
            <div className="grid gap-2 p-4 rounded-2xl bg-black/60 border border-white/5" style={{ gridTemplateColumns: `repeat(${COLS}, 54px)` }}>
              {curGrid.map((row, r) => row.map((cell, c) => {
                const key = `${r},${c}`;
                const isPath = pathSet.has(key);
                const pathIdx = pathArr.findIndex(p => p.r === r && p.c === c);
                const isLit = isPath && pathIdx <= (animStep % (pathArr.length + 5));
                const blockType = curBlockedSet.get(key);
                const isBlocked = !!blockType;
                const isWheelchair = activePlan && activePlan.isWheelchairActive;
                const isBlockedStair = isWheelchair && cell.type === T.STAIR;
                
                const cs = isBlockedStair 
                  ? { bg: "rgba(225, 29, 72, 0.05)", border: "rgba(225, 29, 72, 0.2)", text: "#f43f5e" }
                  : isBlocked 
                  ? { bg: "rgba(225, 29, 72, 0.15)", border: "rgba(225, 29, 72, 0.55)", text: "#f43f5e" }
                  : CSTY[cell.type];
 
                return (
                  <div 
                    key={key}
                    onClick={isBlocked ? undefined : () => handleCell(r, c)}
                    className={`w-[54px] h-[54px] rounded-xl border flex flex-col items-center justify-center transition-all duration-300 ${
                      cell.type === T.ROOM ? 'cursor-pointer' : ''
                    } ${
                      isBlocked
                        ? 'border-rose-500 bg-rose-950/20 text-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.45)] scale-100 animate-pulse cursor-not-allowed'
                        : isBlockedStair
                        ? 'border-rose-500/50 bg-rose-950/10 text-rose-500'
                        : isLit && isWheelchair
                          ? 'shadow-[0_0_15px_rgba(59,130,246,0.3)] border-blue-500 bg-blue-500/25 scale-105' 
                        : isLit 
                          ? 'shadow-[0_0_15px_rgba(16,185,129,0.3)] border-emerald-500 bg-emerald-500/25 scale-105' 
                          : 'hover:border-zinc-700 hover:bg-zinc-900/40'
                    }`}
                    style={{ 
                      background: (isLit || isBlocked || isBlockedStair) ? undefined : cs.bg, 
                      borderColor: (isLit || isBlocked || isBlockedStair) ? undefined : cs.border 
                    }}
                  >
                    {isBlocked ? (
                      <span className="text-lg animate-bounce">
                        {blockType === "SOURCE" ? "🔥" : "⚠️"}
                      </span>
                    ) : isBlockedStair ? (
                      <span className="text-lg font-black animate-pulse">❌</span>
                    ) : (
                      <>
                        {cell.type === T.ROOM && <span className="text-[10px] font-black text-white">{cell.label}</span>}
                        {cell.type === T.EXIT && <span className="text-lg">🚪</span>}
                        {cell.type === T.STAIR && <span className="text-lg">🪜</span>}
                        {cell.type === T.ELEVATOR && <span className="text-lg">🛗</span>}
                        {isPath && !isLit && <div className={`w-1.5 h-1.5 rounded-full ${isWheelchair ? 'bg-blue-950' : 'bg-emerald-950'}`}></div>}
                        {isLit && <div className={`w-2.5 h-2.5 rounded-full shadow-lg ${isWheelchair ? 'bg-blue-400 shadow-blue-500' : 'bg-emerald-400 shadow-emerald-500'}`}></div>}
                      </>
                    )}
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
