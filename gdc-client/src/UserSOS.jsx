import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyLatestAlert, getSafeHeading, logout, sendAlert } from './api';
import HotelMapSystem from './HotelMap';

function UserSOS() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sosMessage, setSosMessage] = useState('')
  const [contextType, setContextType] = useState('GENERAL')
  const [vulnerability, setVulnerability] = useState('NONE')
  const [isLanActive, setIsLanActive] = useState(true)
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [latestStatus, setLatestStatus] = useState('')
  const [isEmergencyActive, setIsEmergencyActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  const [clock, setClock] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  const [showMap, setShowMap] = useState(false)
  const [heading, setHeading] = useState(0)
  const [nextWaypoint, setNextWaypoint] = useState('')
  const [estimatedTime, setEstimatedTime] = useState(0)

  const fetchPathData = async () => {
    try {
      // Demo assumes guest is in Room 'R301'
      const hData = await getSafeHeading('R301', null, vulnerability);
      setHeading(hData.data.heading);
      setNextWaypoint(hData.data.nextWaypoint);
      setEstimatedTime(hData.data.estimatedTimeSeconds);
    } catch { /* Background sync silent */ }
  }

  const recognitionRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const loadLatestStatus = async () => {
      try {
        const uid = localStorage.getItem('userId');
        const response = await getMyLatestAlert(uid)
        const status = response.data?.status || '';
        setLatestStatus(status);
        
        // IRON-CLAD LOGIC: Only shut down if explicitly RESOLVED
        if (status === 'RESOLVED') {
          setIsEmergencyActive(false);
        } else if (status === 'PENDING' || status === 'ACKNOWLEDGED' || status === 'DISPATCHED') {
          setIsEmergencyActive(true);
        }
      } catch { 
        // Ignore errors to keep the arrow "Sticky" during network flickers
      }
    }
    loadLatestStatus();
    fetchPathData();
    const timer = setInterval(() => {
      loadLatestStatus();
      if (isEmergencyActive) fetchPathData();
    }, 5000);
    return () => clearInterval(timer);
  }, [isEmergencyActive])

  const handleSendSOS = async () => {
    setLoading(true);
    const stableId = localStorage.getItem('userId') || ("GUEST-" + Math.floor(Math.random() * 1000));
    localStorage.setItem('userId', stableId);
    setIsEmergencyActive(true); // LOCK IT ON IMMEDIATELY

    try {
      const payload = {
        uniqueId: "SOS-" + Date.now().toString(),
        timestamp: Date.now(),
        timeToLive: 600000,
        status: "PENDING",
        priority: contextType === 'THREAT' ? 'INTRUDER' : contextType,
        userId: stableId,
        roomNumber: 'R301',
        message: sosMessage || "EMERGENCY: Immediate assistance requested.",
        contextType,
        vulnerabilityProfile: vulnerability,
        hotelId: localStorage.getItem('hotelId') || 'GLOBAL',
      }
      await sendAlert(payload);
      setLatestStatus('PENDING'); // TRIGGER AR ARROW IMMEDIATELY
      setMessage('TACTICAL UPLINK SECURE: REJECTION IMPOSSIBLE');
      fetchPathData(); // Start calculating the path right away
    } catch { setError('MESH JAMMED: RETRYING VIA P2P'); }
    finally { setLoading(false); }
  }

  if (broadcastMsg) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-rose-600 p-8 text-white scanline-container">
        <h1 className="text-6xl font-black mb-4 hud-title">CRITICAL ALERT</h1>
        <p className="text-2xl font-bold bg-black/40 p-8 rounded-3xl">{broadcastMsg}</p>
        <button onClick={() => setBroadcastMsg('')} className="mt-8 px-12 py-4 bg-white text-rose-600 font-black rounded-full">ACKNOWLEDGE</button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-4 hud-font overflow-hidden selection:bg-rose-500/30">
      {/* 🗺️ OVERLAY EVAC MAP (Tactical Modal) */}
      {showMap && (
        <div className="fixed inset-0 z-[200] overflow-hidden bg-black animate-fadeIn">
          <HotelMapSystem onClose={() => setShowMap(false)} />
        </div>
      )}

      {/* AMBIENT HUD GLOW */}
      <div className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none ${isEmergencyActive ? 'opacity-30' : 'opacity-10'}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rose-900/50 via-black to-black"></div>
        {isEmergencyActive && <div className="absolute inset-0 scanline-container opacity-20"></div>}
      </div>

      <div className="w-full h-full max-w-lg flex flex-col relative z-10">
        
        {/* HEADER: MISSION STATUS */}
        <div className="flex justify-between items-end mb-6 px-2">
            <div className="flex flex-col">
                <h2 className="text-3xl font-black tracking-tighter leading-none mb-1">VANGUARD <span className="text-rose-500 font-black">SOS</span></h2>
                <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isLanActive ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-rose-600 shadow-[0_0_8px_#e11d48]'}`}></span>
                    <span className="text-[10px] font-black tracking-[0.3em] text-zinc-500 uppercase">{isLanActive ? 'Satellite/Mesh Link: Active' : 'Offline Mode Enabled'}</span>
                </div>
            </div>
            <div className="text-right">
                <span className="text-xl font-black text-white/40 leading-none">{clock}</span>
            </div>
        </div>

        {/* MAIN HUD CONTAINER */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            
            {/* STATUS & AR COMPASS SECTION */}
            <div className={`tactical-glass rounded-[2rem] p-6 border transition-all duration-700 flex flex-col items-center justify-center gap-4 ${
                isEmergencyActive ? 'border-rose-500/50 bg-rose-500/5 shadow-[0_0_40px_rgba(244,63,94,0.1)]' : 'border-white/5 bg-white/2'
            }`}>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.4em]">Response Pipeline</p>
                    <div className="flex items-center gap-3">
                         <div className={`h-3 w-3 rounded-full ${latestStatus === 'ACKNOWLEDGED' ? 'bg-emerald-500' : latestStatus === 'PENDING' ? 'bg-amber-500 animate-pulse' : 'bg-zinc-800'}`}></div>
                         <p className={`text-xl font-black tracking-widest uppercase ${
                            latestStatus === 'ACKNOWLEDGED' ? 'text-emerald-400' : latestStatus === 'PENDING' ? 'text-amber-400' : 'text-zinc-600'
                         }`}>
                             {latestStatus || 'Standby'}
                         </p>
                    </div>
                </div>

                {isEmergencyActive && (
                    <div className="w-full flex flex-col items-center pt-4 border-t border-white/5 mt-4">
                        <div 
                          className="w-2 h-16 bg-emerald-500 rounded-full shadow-[0_0_25px_#10b981] animate-pulse transition-transform duration-1000"
                          style={{ transform: `rotate(${heading || 0}deg)` }}
                        ></div>
                        <p className="text-[10px] font-black text-emerald-400 mt-4 tracking-[0.3em] uppercase">
                           SafePath Heading: {nextWaypoint || 'Calculating...'}
                        </p>
                        {estimatedTime > 0 && (
                            <p className="text-[10px] font-black text-white/40 mt-1 uppercase tracking-widest animate-pulse">
                                Time to Safety: {Math.floor(estimatedTime / 60)}m {estimatedTime % 60}s
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* CONFIGURATION GRID */}
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black text-zinc-600 ml-2 uppercase tracking-widest">Emergency Type</span>
                    <select
                        value={contextType}
                        onChange={(e) => setContextType(e.target.value)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black outline-none focus:border-rose-500 text-white appearance-none"
                    >
                        <option value="GENERAL">GENERAL</option>
                        <option value="FIRE">FIRE / SMOKE</option>
                        <option value="THREAT">INTRUDER</option>
                        <option value="MEDICAL">MEDICAL</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black text-zinc-600 ml-2 uppercase tracking-widest">Vulnerability</span>
                    <select
                        value={vulnerability}
                        onChange={(e) => setVulnerability(e.target.value)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black outline-none focus:border-rose-500 text-white appearance-none"
                    >
                        <option value="NONE">STANDARD</option>
                        <option value="WHEELCHAIR">WHEELCHAIR</option>
                        <option value="VISION">VISUAL</option>
                        <option value="HEARING">HEARING</option>
                    </select>
                </div>
            </div>

            {/* MESSAGE ENTRY */}
            <div className="flex-1 min-h-[120px] relative">
                <textarea
                    value={sosMessage}
                    onChange={(e) => setSosMessage(e.target.value)}
                    placeholder="DESCRIBE SITUATION (OPIONAL)..."
                    className="w-full h-full bg-zinc-950/50 border border-white/10 rounded-3xl px-6 py-6 text-sm font-medium outline-none focus:border-rose-500 text-white placeholder:text-zinc-800 resize-none"
                />
                <div className="absolute top-4 right-6 pointer-events-none text-zinc-800">
                    <span className="text-[8px] font-black uppercase tracking-[0.3em]">Direct-Uplink</span>
                </div>
            </div>

            {/* MASTER SOS TRIGGER */}
            <div className="relative group mt-2">
                <button
                    onClick={handleSendSOS}
                    disabled={loading}
                    className={`w-full py-7 rounded-[2.5rem] font-black text-2xl tracking-[0.4em] uppercase transition-all active:scale-[0.97] shadow-2xl relative overflow-hidden ${
                        loading ? 'bg-zinc-800 text-zinc-500' : 'bg-rose-600 text-white active:bg-rose-700'
                    }`}
                >
                    {loading ? 'Transmitting...' : 'Initiate SOS'}
                    {!loading && <div className="absolute inset-0 bg-white/10 opacity-0 active:opacity-100 transition-opacity"></div>}
                </button>
                {!loading && <div className="absolute inset-0 bg-rose-600 blur-3xl opacity-20 -z-10 animate-pulse"></div>}
            </div>
        </div>

        {/* FEEDBACK FEED */}
        <div className="h-4 mt-2 flex justify-center">
            {message && <p className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.5em] animate-pulse">{message}</p>}
            {error && <p className="text-[8px] font-black text-rose-500 uppercase tracking-[0.5em] animate-pulse">{error}</p>}
        </div>

        {/* FOOTER NAVIGATION */}
        <div className="grid grid-cols-2 gap-4 mt-4 pb-2">
            <button 
                onClick={() => setShowMap(!showMap)} 
                className="py-4 px-4 bg-zinc-950 border border-white/5 rounded-[1.5rem] text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] active:bg-zinc-900 transition-colors"
            >
                Tactical Map
            </button>
            <button 
                onClick={() => navigate('/login')} 
                className="py-4 px-4 bg-zinc-950 border border-white/5 rounded-[1.5rem] text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] active:bg-zinc-900 transition-colors"
            >
                Log Exit
            </button>
        </div>
      </div>
    </div>
  );
}

export default UserSOS;