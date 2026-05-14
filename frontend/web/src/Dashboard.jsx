import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from './firebase'
import { 
  collection, 
  onSnapshot, 
  query, 
  updateDoc, 
  doc, 
  orderBy,
  addDoc
} from 'firebase/firestore'
import { pathfinder } from './utils/pathfinder'
import { acknowledgeAlert, resolveAlert, sendSignal } from './api'

const Dashboard = () => {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [broadcastText, setBroadcastText] = useState('')
  const [heading, setHeading] = useState(0)
  const [nextWaypoint, setNextWaypoint] = useState('')
  
  // Tactical SOS States
  const [incomingSOS, setIncomingSOS] = useState(null);
  const [showSOSPopup, setShowSOSPopup] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  
  // WebRTC Refs
  const pcRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const audioRef = useRef(null);
  const localStreamRef = useRef(null);

  // Audio Alerts (Wrapped in try/catch to prevent crash if URLs are blocked)
  const sirenRef = useRef(null);
  const criticalSirenRef = useRef(null);

  useEffect(() => {
    sirenRef.current = new Audio('https://www.soundjay.com/buttons/sounds/beep-01a.mp3');
    criticalSirenRef.current = new Audio('https://www.soundjay.com/mechanical/sounds/claxon-1.mp3');
    
    // Silence errors from resource loading
    const silenceError = (e) => { console.warn("Media resource failed to load, silencing error."); };
    sirenRef.current.addEventListener('error', silenceError);
    criticalSirenRef.current.addEventListener('error', silenceError);
  }, []);

  const hotelId = localStorage.getItem('hotelId') || 'GLOBAL'

  // 1. SSE Real-Time Tactical Stream
  useEffect(() => {
    const eventSource = new EventSource(`http://${window.location.hostname}:8080/api/alerts/stream`);
    
    eventSource.addEventListener('NEW_ALERT', (e) => {
      console.log("Tactical SOS Received via SSE:", e.data);
      const alert = JSON.parse(e.data);
      // Demo Override: Show popup for ANY new emergency packet
      setIncomingSOS(alert);
      setShowSOSPopup(true);
      triggerAlertSound(alert.priority);
    });

    eventSource.addEventListener('WEBRTC_SIGNAL', async (e) => {
      const data = JSON.parse(e.data);
      if (data.targetId === 'ADMIN') {
        const { signal } = data;
        if (signal.type === 'offer') {
          await startVoiceResponse(signal);
        } else if (signal.candidate) {
          if (pcRef.current) await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      }
    });

    return () => eventSource.close();
  }, []);

  const triggerAlertSound = (priority) => {
    try {
      if (priority === 'CRITICAL' && criticalSirenRef.current) {
        criticalSirenRef.current.loop = true;
        criticalSirenRef.current.play().catch(() => console.log("Autoplay blocked/Sound failed"));
      } else if (sirenRef.current) {
        sirenRef.current.play().catch(() => console.log("Autoplay blocked/Sound failed"));
      }
    } catch (e) {
      console.warn("Audio trigger failed safely");
    }
  }

  const stopAlertSounds = () => {
    criticalSirenRef.current.pause();
    criticalSirenRef.current.currentTime = 0;
    sirenRef.current.pause();
  }

  // 2. WebRTC Logic (Admin)
  const startVoiceResponse = async (offer) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;

    // Automatically prepare microphone so Push-to-Talk is ready
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => {
        track.enabled = false; // Start muted
        pc.addTrack(track, stream);
      });
    } catch (err) {
      console.warn("Admin mic access denied, PTT will be disabled");
    }

    pc.ontrack = (event) => {
      if (audioRef.current) audioRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && incomingSOS) {
        sendSignal(incomingSOS.userId, { candidate: event.candidate });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    if (incomingSOS) {
      sendSignal(incomingSOS.userId, answer);
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const newState = !isVoiceActive;
      localStreamRef.current.getTracks().forEach(track => track.enabled = newState);
      setIsVoiceActive(newState);
    }
  };

  // 3. FIRESTORE SUBSCRIPTION (Persistence)
  useEffect(() => {
    const alertsRef = collection(db, 'alerts')
    const q = query(alertsRef, orderBy('timestamp', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alertList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      const filtered = alertList.filter(a => a.hotelId === hotelId || a.hotelId === 'GLOBAL')
      setAlerts(filtered)
      setLoading(false)
      pathfinder.clearHazards()
      filtered.forEach(a => {
        if (a.status !== 'RESOLVED') pathfinder.markHazard(a.roomNumber)
      })
      calculateLocalPath()
    }, (err) => {
      setError('Uplink Failed: ' + err.message)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [hotelId])

  const calculateLocalPath = () => {
    const path = pathfinder.findSafePath('R301')
    if (path.length >= 2) {
      const to = path[1]
      const angle = Math.atan2(to.x - path[0].x, to.y - path[0].y) * (180 / Math.PI)
      setHeading(angle)
      setNextWaypoint(to.label)
    }
  }

  const handleBroadcast = async () => {
    if (!broadcastText.trim()) return;
    try {
      await addDoc(collection(db, 'broadcasts'), {
        message: broadcastText,
        sender: 'ADMIN',
        timestamp: Date.now(),
        hotelId: hotelId || 'GLOBAL'
      });
      setBroadcastText('');
      alert("TACTICAL BROADCAST SENT TO FLEET");
    } catch (err) {
      console.error("Broadcast failed:", err);
    }
  }

  const handleAcknowledge = async (alert) => {
    await acknowledgeAlert(alert.uniqueId || alert.id);
    stopAlertSounds();
    if (alert.id) {
       const alertRef = doc(db, 'alerts', alert.id);
       await updateDoc(alertRef, { status: 'ACKNOWLEDGED' });
    }
    setIncomingSOS(prev => prev ? { ...prev, status: 'ACKNOWLEDGED' } : null);
  }

  const handleResolve = async (alert) => {
    await resolveAlert(alert.uniqueId || alert.id);
    stopAlertSounds();
    setShowSOSPopup(false);
    if (alert.id) {
       const alertRef = doc(db, 'alerts', alert.id);
       await updateDoc(alertRef, { status: 'RESOLVED' });
    }
  }

  const activeThreats = alerts.filter(a => a.status !== 'RESOLVED' && a.priority !== 'NONE')

  return (
    <div className={`min-h-screen bg-black text-white p-4 lg:p-8 hud-font selection:bg-rose-500/30 ${showSOSPopup ? 'animate-pulse-red' : ''}`}>
      <audio ref={audioRef} autoPlay />
      
      {/* 🚨 EMERGENCY SOS POPUP MODAL */}
      {showSOSPopup && incomingSOS && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl bg-zinc-950 border-4 border-rose-600 rounded-[3rem] p-8 shadow-[0_0_100px_rgba(225,29,72,0.4)] overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-600 animate-pulse"></div>
            <div className="scanline-container absolute inset-0 opacity-10 pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-4xl font-black text-rose-500 tracking-tighter mb-2 animate-bounce">CRITICAL SOS</h1>
                <p className="text-[10px] font-black tracking-[0.5em] text-zinc-500 uppercase">Incoming Tactical Uplink</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-white/50">{new Date(incomingSOS.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="tactical-glass p-6 rounded-3xl border border-white/5">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Location Context</p>
                <p className="text-2xl font-black text-white">ROOM {incomingSOS.roomNumber}</p>
                <p className="text-sm font-bold text-rose-400 uppercase tracking-widest">{incomingSOS.floor || 'N/A'}</p>
              </div>
              <div className="tactical-glass p-6 rounded-3xl border border-white/5">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">AI Threat Severity</p>
                <p className={`text-xl font-black uppercase ${incomingSOS.priority === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'}`}>
                  {incomingSOS.aiThreatSeverity || incomingSOS.priority}
                </p>
              </div>
            </div>

            <div className="bg-white/5 p-6 rounded-3xl mb-8 border border-white/10">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Guest Message</p>
              <p className="text-xl font-medium text-white italic">"{incomingSOS.message}"</p>
            </div>

            {/* LIVE VOICE CONSOLE */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-3xl mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex gap-1 items-end h-8">
                  {[1,2,3,4,5].map(i => <div key={i} className="w-1 bg-emerald-500 animate-voice-bar" style={{ animationDelay: `${i*0.1}s` }}></div>)}
                </div>
                <p className="text-xs font-black text-emerald-400 uppercase tracking-[0.3em]">Live Audio Channel Open</p>
              </div>
              <button 
                onClick={toggleMic}
                className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                  isVoiceActive ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white shadow-[0_0_15px_#10b981]'
                }`}
              >
                {isVoiceActive ? 'MUTE (LIVE)' : 'PUSH-TO-TALK'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <button onClick={() => handleAcknowledge(incomingSOS)} className="py-5 bg-sky-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-sky-500 transition-all">
                Acknowledge
              </button>
              <button onClick={() => handleResolve(incomingSOS)} className="py-5 bg-emerald-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-emerald-500 transition-all">
                Mark Resolved
              </button>
              <button className="py-5 bg-rose-700 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-rose-600 transition-all col-span-2 md:col-span-1 shadow-[0_0_20px_rgba(225,29,72,0.3)]">
                Dispatch 112
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP HUD BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-l-rose-500 scanline-container shadow-[0_0_20px_rgba(244,63,94,0.1)]">
          <p className="text-[10px] font-black tracking-[0.2em] text-rose-500 mb-1 uppercase">Active Threats</p>
          <p className="text-4xl font-black">{activeThreats.length}</p>
        </div>
        <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-l-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.1)]">
          <p className="text-[10px] font-black tracking-[0.2em] text-sky-500 mb-1 uppercase">Cloud Link</p>
          <p className="text-4xl font-black">ACTIVE</p>
        </div>
        <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-l-amber-500">
          <p className="text-[10px] font-black tracking-[0.2em] text-amber-500 mb-1 uppercase">Mesh Nodes</p>
          <p className="text-4xl font-black">32</p>
        </div>
        <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-l-zinc-500">
          <p className="text-[10px] font-black tracking-[0.2em] text-zinc-400 mb-1 uppercase">System Core</p>
          <p className="text-xl font-bold text-emerald-400">OPTIMIZED</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: LIVE FEED & TACTICAL MAP */}
        <div className="lg:col-span-4 space-y-8">
          <div className="tactical-glass rounded-3xl overflow-hidden relative group border border-white/5">
             <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <span className="h-2 w-2 bg-rose-500 rounded-full animate-ping"></span>
                <span className="text-[10px] font-black tracking-widest text-white drop-shadow-md">LOCAL SENSOR HUB</span>
             </div>
             <img 
               src={`${process.env.REACT_APP_ML_URL || 'http://localhost:5000'}/video_feed`} 
               alt="AI Stream" 
               className="w-full aspect-video object-cover grayscale brightness-50 hover:grayscale-0 transition-all duration-700"
               onError={(e) => e.target.src = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop"}
             />
          </div>

          <div className="tactical-glass rounded-3xl p-6 relative border border-white/5">
             <h3 className="text-xs font-black text-sky-400 mb-4 uppercase tracking-[0.3em]">SafePath Real-Time</h3>
             <div className="aspect-square rounded-2xl bg-zinc-900 border border-white/5 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-sky-500 via-transparent to-transparent"></div>
                <div 
                   className="w-full flex justify-center mb-4 transition-transform duration-1000"
                   style={{ transform: `rotate(${heading || 0}deg)` }}
                >
                   <div className="w-2 h-20 bg-emerald-500 rounded-full shadow-[0_0_30px_#10b981] animate-pulse"></div>
                </div>
                <div className="relative z-10">
                   <p className="text-xs font-black text-emerald-400 mb-1 uppercase tracking-[0.2em]">
                     {nextWaypoint || 'SEARCHING...'}
                   </p>
                   <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Vector Heading: {heading?.toFixed(1)}°</p>
                </div>
             </div>
          </div>

          <div className="tactical-glass rounded-3xl p-6 border border-white/5">
             <h3 className="text-xs font-black text-rose-400 mb-4 uppercase tracking-[0.3em]">Global Broadcast</h3>
             <textarea 
               value={broadcastText}
               onChange={(e) => setBroadcastText(e.target.value)}
               placeholder="ENTER TACTICAL COMMAND..."
               className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-xs text-white focus:border-rose-500 outline-none h-24 mb-4 font-medium"
             />
             <button 
               onClick={handleBroadcast}
               className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-[10px] font-black tracking-[0.4em] uppercase rounded-2xl transition-all active:scale-95 shadow-lg"
             >
                Transmit to Fleet
             </button>
          </div>
        </div>

        {/* RIGHT COLUMN: ALERT TRIAGE FEED */}
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
             <h2 className="text-2xl font-black tracking-tighter uppercase">
                Tactical <span className="text-rose-500">Alert</span> Feed
             </h2>
             <div className="flex gap-2">
                <span className="px-3 py-1 bg-zinc-900 border border-white/5 rounded-full text-[8px] font-black text-zinc-500 uppercase tracking-widest">Live Node: 001</span>
             </div>
          </div>

          <div className="space-y-4 overflow-y-auto max-h-[850px] pr-2 custom-scrollbar pb-10">
            {activeThreats.length === 0 ? (
              <div className="py-24 text-center tactical-glass rounded-[2rem] border border-white/5">
                <div className="w-12 h-12 border-2 border-zinc-800 border-t-rose-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-zinc-600 font-black uppercase tracking-[0.4em] text-[10px]">Scanning Mesh Spectrum...</p>
              </div>
            ) : (
              activeThreats.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`tactical-glass p-6 rounded-[2rem] border transition-all hover:bg-white/5 group ${
                    alert.priority === 'FIRE' || alert.priority === 'CRITICAL' ? 'border-rose-500/30' : 'border-amber-500/30'
                  }`}
                >
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex-1">
                       <div className="flex items-center gap-3 mb-3">
                          <span className={`px-3 py-1 text-[8px] font-black rounded-full uppercase tracking-widest ${
                            alert.priority === 'FIRE' || alert.priority === 'CRITICAL' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black'
                          }`}>
                            {alert.priority}
                          </span>
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                       </div>
                       <h4 className="text-xl font-bold mb-3 text-zinc-100 leading-tight">{alert.message}</h4>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                          <div>
                            <p className="text-zinc-600 mb-0.5">Location</p>
                            <p className="text-white">RM {alert.roomNumber}</p>
                          </div>
                          <div>
                            <p className="text-zinc-600 mb-0.5">Floor</p>
                            <p className="text-white">{alert.floor || '3'}</p>
                          </div>
                          <div>
                            <p className="text-zinc-600 mb-0.5">ID</p>
                            <p className="text-white">#{alert.userId?.slice(-4)}</p>
                          </div>
                          <div>
                            <p className="text-zinc-600 mb-0.5">Status</p>
                            <p className="text-sky-400">{alert.status}</p>
                          </div>
                       </div>
                    </div>
                    <div className="flex flex-row md:flex-col gap-2 justify-center">
                       <button 
                         onClick={() => handleAcknowledge(alert)}
                         className="px-6 py-3 bg-zinc-900 border border-white/5 text-zinc-400 text-[9px] font-black rounded-xl hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-all uppercase tracking-[0.2em]"
                       >
                         Acknowledge
                       </button>
                       <button 
                         onClick={() => handleResolve(alert)}
                         className="px-6 py-3 bg-zinc-900 border border-white/5 text-zinc-400 text-[9px] font-black rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all uppercase tracking-[0.2em]"
                       >
                         Resolve
                       </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard