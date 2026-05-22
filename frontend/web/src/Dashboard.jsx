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
import { acknowledgeAlert, resolveAlert, sendSignal, baseURL, sendAlert } from './api'

const Dashboard = () => {
  const navigate = useNavigate();
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
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  
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
    const eventSource = new EventSource(`${baseURL}/alerts/stream`);
    
    eventSource.addEventListener('NEW_ALERT', (e) => {
      console.log("Tactical SOS Received via SSE:", e.data);
      const alert = JSON.parse(e.data);
      setIncomingSOS(alert);
      setShowSOSPopup(true);
      triggerAlertSound(alert.priority);
      speakAlert(alert);
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

  // Voice announcement using browser Web Speech API
  const speakAlert = (alert) => {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();

      const room = alert.roomNumber || 'unknown';
      const msg = alert.message || 'Emergency detected';
      const text = `VANGUARD ALERT. ${alert.priority === 'CRITICAL' ? 'Critical threat detected.' : 'Warning.'} Room ${room}. ${msg}. All personnel respond immediately.`;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.88;
      utterance.pitch = 0.75;
      utterance.volume = 1;

      const assignVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male'))
          || voices.find(v => v.lang.startsWith('en'));
        if (preferred) utterance.voice = preferred;
        window.speechSynthesis.speak(utterance);
      };

      // Voices already loaded (Firefox) — speak immediately
      if (window.speechSynthesis.getVoices().length > 0) {
        assignVoiceAndSpeak();
      } else {
        // Chrome/Edge: wait for voices to be ready
        window.speechSynthesis.addEventListener('voiceschanged', assignVoiceAndSpeak, { once: true });
        // Safety fallback: speak without a specific voice after 500ms if event never fires
        setTimeout(() => {
          if (!utterance.voice) {
            window.speechSynthesis.speak(utterance);
          }
        }, 500);
      }
    } catch (e) {
      console.warn('speakAlert failed safely:', e);
    }
  };

  const triggerAlertSound = (priority) => {
    try {
      if (priority === 'CRITICAL' && criticalSirenRef.current) {
        criticalSirenRef.current.loop = true;
        criticalSirenRef.current.play()
          .then(() => setIsAlarmPlaying(true))
          .catch(() => console.log('Autoplay blocked/Sound failed'));
      } else if (sirenRef.current) {
        sirenRef.current.play()
          .then(() => setIsAlarmPlaying(true))
          .catch(() => console.log('Autoplay blocked/Sound failed'));
      }
    } catch (e) {
      console.warn('Audio trigger failed safely:', e);
    }
  }

  const stopAlertSounds = () => {
    try {
      if (criticalSirenRef.current) {
        criticalSirenRef.current.pause();
        criticalSirenRef.current.currentTime = 0;
      }
      if (sirenRef.current) {
        sirenRef.current.pause();
        sirenRef.current.currentTime = 0;
      }
    } catch (e) {
      console.warn('stopAlertSounds failed safely:', e);
    }
    setIsAlarmPlaying(false);
    try { window.speechSynthesis?.cancel(); } catch(e) {}
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

  // Simulate a CCTV threat alert (for demo / testing)
  const simulateCCTVThreat = async () => {
    const threats = [
      { msg: 'AI THREAT: Weapon Detected (knife)', type: 'THREAT' },
      { msg: 'AI THREAT: Physical Altercation Detected', type: 'THREAT' },
      { msg: 'AI THREAT: Suspicious Crowd Surge Detected', type: 'THREAT' },
      { msg: 'AI THREAT: Unauthorized Person in Restricted Area', type: 'THREAT' },
    ];
    const pick = threats[Math.floor(Math.random() * threats.length)];
    try {
      await sendAlert({
        uniqueId: `SIM-CCTV-${Date.now()}`,
        timestamp: Date.now(),
        timeToLive: 120000,
        status: 'PENDING',
        priority: 'CRITICAL',
        userId: 'CCTV-NODE-01',
        hotelId: hotelId,
        message: pick.msg,
        contextType: pick.type,
        roomNumber: 'R301',
        floor: '3rd Floor',
      });
    } catch (e) {
      console.error('Simulate CCTV alert failed:', e);
    }
  };

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
    try { await acknowledgeAlert(alert.uniqueId || alert.id); } catch(e) {}
    stopAlertSounds();
    setShowSOSPopup(false);
    if (alert.id) {
      try {
        const alertRef = doc(db, 'alerts', alert.id);
        await updateDoc(alertRef, { status: 'ACKNOWLEDGED' });
      } catch(e) {}
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
    <div className={`min-h-screen bg-[#030303] text-zinc-100 flex flex-col overflow-hidden relative pb-16 ${showSOSPopup ? 'animate-pulse-red' : ''}`}>
      {/* Background Decorators */}
      <div className="cyber-grid absolute inset-0"></div>
      <div className="absolute top-[10%] left-[30%] w-[500px] h-[500px] bg-rose-500/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-emerald-500/5 blur-[100px] pointer-events-none"></div>

      <audio ref={audioRef} autoPlay />

      {/* Header Sticky Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#030303]/60 backdrop-blur-md px-6 md:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl shadow-[0_0_15px_rgba(239,68,68,0.3)]">🛡️</span>
          <div>
            <h1 className="font-display text-lg font-black tracking-widest text-white leading-none">VANGUARD GDC</h1>
            <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mt-1">Tactical Coordination Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline rounded-full bg-zinc-900 border border-white/5 px-3 py-1.5 font-mono text-[9px] font-extrabold tracking-widest text-zinc-400">
            SECURE LINK // {hotelId.toUpperCase()}
          </span>
          {/* DEMO: Simulate CCTV Threat Button */}
          <button
            onClick={simulateCCTVThreat}
            className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 font-display text-[9px] font-bold tracking-widest uppercase text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-[0_0_12px_rgba(239,68,68,0.15)] cursor-pointer"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping"></span>
            SIM CCTV THREAT
          </button>
          <button 
            onClick={() => {
              localStorage.clear();
              navigate('/');
            }}
            className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 font-display text-[9px] font-bold tracking-widest uppercase text-zinc-400 hover:text-white hover:bg-rose-600/10 hover:border-rose-500/30 transition-all cursor-pointer"
          >
            DISCONNECT
          </button>
        </div>
      </header>
      
      {/* 🚨 EMERGENCY SOS POPUP MODAL */}
      {showSOSPopup && incomingSOS && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl bg-zinc-950/95 border-2 border-rose-600/60 rounded-3xl p-8 shadow-[0_0_80px_rgba(239,68,68,0.3)] overflow-hidden relative">
            {/* Ambient Red glow inside card */}
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-rose-500 to-amber-500 animate-pulse"></div>
            <div className="scanline-container absolute inset-0 opacity-[0.03] pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[8px] font-black tracking-widest text-rose-400 uppercase mb-2 animate-bounce">
                  🚨 Priority Triage Needed
                </span>
                <h1 className="font-display text-3xl font-black text-white tracking-tight leading-none">CRITICAL EMERGENCY</h1>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  {new Date(incomingSOS.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 relative z-10">
              <div className="tactical-glass p-5 rounded-2xl border border-white/5">
                <p className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Sector / Room Location</p>
                <p className="font-display text-2xl font-black text-white">ROOM {incomingSOS.roomNumber}</p>
                <p className="font-mono text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-0.5">{incomingSOS.floor || '3rd Floor'}</p>
              </div>
              <div className="tactical-glass p-5 rounded-2xl border border-white/5">
                <p className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">AI Threat Assessment</p>
                <p className={`font-display text-2xl font-black uppercase tracking-tight ${incomingSOS.priority === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'}`}>
                  {incomingSOS.aiThreatSeverity || incomingSOS.priority}
                </p>
                <p className="font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Vulnerability: {incomingSOS.vulnerabilityProfile || 'STANDARD'}</p>
              </div>
            </div>

            <div className="bg-zinc-900/50 p-6 rounded-2xl mb-6 border border-white/5 relative z-10">
              <p className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Guest Telemetry Feed</p>
              <p className="text-base font-medium text-white italic">"{incomingSOS.message}"</p>
            </div>

            {/* LIVE VOICE CONSOLE */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-2xl mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5 items-end h-6">
                  {[1,2,3,4,5,6].map(i => (
                    <div 
                      key={i} 
                      className="w-[3px] bg-emerald-500 rounded-full animate-voice-bar" 
                      style={{ animationDelay: `${i*0.1}s`, height: '100%' }}
                    ></div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Voice Uplink Ready</p>
                  <p className="text-[9px] text-zinc-500 font-semibold tracking-wider mt-0.5">Dual-channel peer-to-peer</p>
                </div>
              </div>
              <button 
                onClick={toggleMic}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  isVoiceActive 
                    ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                }`}
              >
                {isVoiceActive ? 'Mute Voice Line' : 'Connect Microline'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 relative z-10">
              <button onClick={() => handleAcknowledge(incomingSOS)} className="py-4 bg-sky-600 hover:bg-sky-500 text-white font-black rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer">
                Acknowledge
              </button>
              <button onClick={() => handleResolve(incomingSOS)} className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer">
                Mark Resolved
              </button>
              {isAlarmPlaying && (
                <button onClick={stopAlertSounds} className="col-span-2 py-4 bg-zinc-900 border border-amber-500/20 text-amber-400 hover:bg-amber-600 hover:text-white hover:border-amber-600 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer">
                  🔇 Silence Alarm
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Body */}
      <main className="max-w-7xl mx-auto w-full px-6 md:px-12 mt-8 flex-1 flex flex-col gap-8 relative z-10">
        
        {/* TOP HUD BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-rose-500 relative overflow-hidden group">
            <div className="absolute top-[-10%] right-[-10%] w-[80px] h-[80px] rounded-full bg-rose-500/5 group-hover:bg-rose-500/10 transition-all blur-md"></div>
            <p className="font-mono text-[9px] font-black tracking-widest text-zinc-500 mb-1.5 uppercase">Active Threat Packets</p>
            <p className="font-display text-4xl font-black text-white leading-none">{activeThreats.length}</p>
          </div>
          <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-sky-500 relative overflow-hidden group">
            <div className="absolute top-[-10%] right-[-10%] w-[80px] h-[80px] rounded-full bg-sky-500/5 group-hover:bg-sky-500/10 transition-all blur-md"></div>
            <p className="font-mono text-[9px] font-black tracking-widest text-zinc-500 mb-1.5 uppercase">Encryption Uplink</p>
            <p className="font-display text-4xl font-black text-white leading-none">ACTIVE</p>
          </div>
          <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-amber-500 relative overflow-hidden group">
            <div className="absolute top-[-10%] right-[-10%] w-[80px] h-[80px] rounded-full bg-amber-500/5 group-hover:bg-amber-500/10 transition-all blur-md"></div>
            <p className="font-mono text-[9px] font-black tracking-widest text-zinc-500 mb-1.5 uppercase">Mesh Relay Nodes</p>
            <p className="font-display text-4xl font-black text-white leading-none">32</p>
          </div>
          <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-emerald-500 relative overflow-hidden group">
            <div className="absolute top-[-10%] right-[-10%] w-[80px] h-[80px] rounded-full bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-all blur-md"></div>
            <p className="font-mono text-[9px] font-black tracking-widest text-zinc-500 mb-1.5 uppercase">System Core Status</p>
            <p className="font-display text-xl font-black text-emerald-400 leading-none">OPTIMIZED</p>
          </div>
        </div>

        {/* Dashboard Panels Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: LIVE FEED & SAFEPATH RADAR */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Live Sensor Feed */}
            <div className="tactical-glass rounded-3xl overflow-hidden relative border border-white/5 group shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full border border-rose-500/30 bg-black/60 px-3 py-1 backdrop-blur-md">
                <span className="h-2 w-2 bg-rose-500 rounded-full animate-ping"></span>
                <span className="font-mono text-[8px] font-black tracking-widest text-white">AI VISION FEED</span>
              </div>
              <img 
                src={`${import.meta.env.VITE_ML_URL || 'http://localhost:5000'}/video_feed`} 
                alt="AI Sensor Stream" 
                className="w-full aspect-video object-cover grayscale brightness-40 hover:brightness-[0.6] hover:grayscale-[20%] transition-all duration-700"
                onError={(e) => e.target.src = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop"}
              />
            </div>

            {/* SafePath Vector Radar (AdaptFit Hero Graphic Style Compass) */}
            <div className="tactical-glass rounded-3xl p-6 border border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
              <h3 className="font-display text-xs font-black text-sky-400 mb-4 uppercase tracking-[0.25em]">SafePath Vector Radar</h3>
              
              <div className="aspect-square rounded-2xl bg-zinc-950/80 border border-white/5 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                {/* Radial glowing ring */}
                <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-sky-500 via-transparent to-transparent"></div>
                
                {/* Rotating needle */}
                <div 
                   className="w-full flex justify-center mb-6 transition-transform duration-1000 ease-out"
                   style={{ transform: `rotate(${heading || 0}deg)` }}
                >
                   <div className="relative w-[3px] h-20 bg-gradient-to-t from-transparent via-emerald-500 to-emerald-400 rounded-full shadow-[0_0_20px_#10b981]">
                     <div className="absolute top-0 left-[-4px] w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
                   </div>
                </div>
                
                <div className="relative z-10">
                   <p className="font-display text-base font-black text-emerald-400 tracking-widest uppercase mb-1">
                     {nextWaypoint ? `Proceed to ${nextWaypoint}` : 'ANALYZING HAZARDS...'}
                   </p>
                   <p className="font-mono text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                     Heading Vector: {heading?.toFixed(1)}° // Sector Safe
                   </p>
                </div>
              </div>
            </div>

            {/* Global Fleet Broadcast */}
            <div className="tactical-glass rounded-3xl p-6 border border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
              <h3 className="font-display text-xs font-black text-rose-400 mb-4 uppercase tracking-[0.25em]">Global Alert Override</h3>
              
              <textarea 
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="ENTER COMMAND TEXT..."
                className="w-full bg-zinc-950/60 border border-white/10 rounded-2xl p-4 text-xs text-white focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 outline-none h-24 mb-4 font-semibold placeholder:text-zinc-800 resize-none transition"
              />
              
              <button 
                onClick={handleBroadcast}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-[10px] font-black tracking-[0.3em] uppercase rounded-xl transition-all active:scale-95 shadow-[0_4px_20px_rgba(239,68,68,0.2)] cursor-pointer"
              >
                Transmit Broadcast
              </button>
            </div>

          </div>

          {/* RIGHT COLUMN: ALERT TRIAGE FEED */}
          <div className="lg:col-span-7 flex flex-col h-full space-y-6">
            
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-black tracking-tight uppercase">
                Active <span className="text-rose-500">Telemetry Feed</span>
              </h2>
              <span className="rounded-full border border-white/5 bg-zinc-900 px-3 py-1 font-mono text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                GDC LIVE // FEED:001
              </span>
            </div>

            {/* Feed List */}
            <div className="space-y-4 max-h-[850px] overflow-y-auto pr-2 custom-scrollbar pb-12">
              {activeThreats.length === 0 ? (
                <div className="py-24 text-center tactical-glass rounded-3xl border border-white/5 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-2 border-zinc-800 border-t-rose-500 rounded-full animate-spin mb-4"></div>
                  <p className="text-zinc-500 font-mono font-black uppercase tracking-[0.3em] text-[9px]">Scanning mesh spectra...</p>
                </div>
              ) : (
                activeThreats.map((alert) => {
                  const isCritical = alert.priority === 'FIRE' || alert.priority === 'CRITICAL';
                  
                  return (
                    <div 
                      key={alert.id} 
                      className={`tactical-glass p-6 rounded-3xl border transition-all hover:bg-white/5 group shadow-lg ${
                        isCritical ? 'border-rose-500/20 hover:border-rose-500/40' : 'border-amber-500/20 hover:border-amber-500/40'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex-1">
                          
                          {/* Alert Meta */}
                          <div className="flex items-center gap-3.5 mb-3.5">
                            <span className={`px-3 py-1 text-[8px] font-black rounded-full uppercase tracking-widest ${
                              isCritical ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}>
                              {alert.priority}
                            </span>
                            <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          {/* Message */}
                          <h4 className="text-lg font-bold mb-4 text-white leading-snug">{alert.message}</h4>

                          {/* Attributes Table */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-white/5 pt-4">
                            <div>
                              <p className="font-mono text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Location</p>
                              <p className="font-display text-xs font-black text-white">RM {alert.roomNumber}</p>
                            </div>
                            <div>
                              <p className="font-mono text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Floor</p>
                              <p className="font-display text-xs font-black text-white">{alert.floor || '3rd'}</p>
                            </div>
                            <div>
                              <p className="font-mono text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Node ID</p>
                              <p className="font-mono text-xs font-bold text-white">#{alert.userId?.slice(-4)}</p>
                            </div>
                            <div>
                              <p className="font-mono text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Status</p>
                              <p className="font-display text-xs font-black text-sky-400 uppercase tracking-wider">{alert.status}</p>
                            </div>
                          </div>

                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-row md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 flex-shrink-0">
                          <button 
                            onClick={() => handleAcknowledge(alert)}
                            className="flex-1 md:flex-initial px-5 py-3 bg-zinc-950/60 border border-white/10 text-zinc-400 text-[9px] font-black rounded-xl hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-all uppercase tracking-widest cursor-pointer"
                          >
                            ACK
                          </button>
                          <button 
                            onClick={() => handleResolve(alert)}
                            className="flex-1 md:flex-initial px-5 py-3 bg-zinc-950/60 border border-white/10 text-zinc-400 text-[9px] font-black rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all uppercase tracking-widest cursor-pointer"
                          >
                            RESOLVE
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}

export default Dashboard;