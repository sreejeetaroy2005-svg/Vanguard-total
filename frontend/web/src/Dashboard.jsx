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
import { acknowledgeAlert, resolveAlert, sendSignal, baseURL, sendAlert, escalateAlert } from './api'
import { tars } from './utils/tars'
import HotelMapSystem from './HotelMap'

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

  // EEP Authority Escalation States
  const [isCrisisLockdown, setIsCrisisLockdown] = useState(false);
  const [showEscalationForm, setShowEscalationForm] = useState(false);
  const [selectedResponder, setSelectedResponder] = useState('POLICE');
  const [isSilentDispatched, setIsSilentDispatched] = useState(false);

  // TARS (Tactical Audio Response System) States
  const [tarsLevel, setTarsLevel] = useState(null);
  const [isCriticalOverlay, setIsCriticalOverlay] = useState(false);
  
  // Fire Simulation States
  const [fireSimLoading, setFireSimLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [lastRerouteMs, setLastRerouteMs] = useState(null);
  const [showMap, setShowMap] = useState(false);
  
  // WebRTC Refs
  const pcRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const audioRef = useRef(null);
  const localStreamRef = useRef(null);

  // TARS: CCTV Auto-scroll ref
  const cctvFeedRef = useRef(null);

  const hotelId = localStorage.getItem('hotelId') || 'GLOBAL'

  // 1. SSE Real-Time Tactical Stream
  useEffect(() => {
    const eventSource = new EventSource(`${baseURL}/alerts/stream`);
    
    eventSource.addEventListener('NEW_ALERT', (e) => {
      console.log("[TARS] Tactical SOS Received:", e.data);
      const alertData = JSON.parse(e.data);
      setIncomingSOS(alertData);
      setShowSOSPopup(true);
      
      // Live reroute timing from SSE
      if (alertData.rerouteMs !== undefined && alertData.rerouteMs !== null) {
        setLastRerouteMs(alertData.rerouteMs);
      }

      // TARS: Intelligent threat classification + adaptive audio response
      const level = triggerAlertSound(alertData);
      speakAlert(alertData);

      // CRITICAL: Emergency UI Reactions
      if (level === 'CRITICAL') {
        // Auto-scroll to CCTV feed for real-time visual confirmation
        setTimeout(() => {
          cctvFeedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 800);
        // Auto-trigger emergency route visualization
        calculateLocalPath();
      }
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

      // Only speak for CRITICAL threats
      const level = tars.classifyThreat({
        message: alert.message,
        priority: alert.priority,
        hazardType: alert.emergencyType || alert.contextType,
        confidence: alert.aiConfidence || 0,
      });
      if (level !== 'CRITICAL') return;

      const room = alert.roomNumber || 'unknown';
      const msg = alert.message || 'Emergency detected';
      const text = `VANGUARD ALERT. Critical threat detected. Room ${room}. ${msg}. All personnel respond immediately.`;

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

  // ─── TARS: Intelligent Alert Sound Engine ──────────────────────────
  const triggerAlertSound = (alertOrPriority) => {
    try {
      let level;
      if (typeof alertOrPriority === 'string') {
        // Legacy compatibility: priority string ('CRITICAL', 'MEDIUM', 'LOW')
        const priorityMap = { 'CRITICAL': 'CRITICAL', 'FIRE': 'CRITICAL', 'HIGH': 'CRITICAL', 'MEDIUM': 'MEDIUM' };
        level = priorityMap[alertOrPriority.toUpperCase()] || 'LOW';
      } else {
        // TARS: Full alert object → intelligent classification
        level = tars.classifyThreat({
          message: alertOrPriority.message,
          priority: alertOrPriority.priority,
          hazardType: alertOrPriority.emergencyType || alertOrPriority.contextType,
          confidence: alertOrPriority.aiConfidence || 0,
        });
      }

      tars.triggerByLevel(level);
      setTarsLevel(level);

      if (level === 'CRITICAL') {
        setIsAlarmPlaying(true);
        setIsCriticalOverlay(true);
      } else {
        setIsAlarmPlaying(false);
      }

      return level;
    } catch (e) {
      console.warn('[TARS] Audio trigger failed safely:', e);
      return 'LOW';
    }
  }

  const stopAlertSounds = () => {
    tars.silence();
    setIsAlarmPlaying(false);
    setTarsLevel(null);
    setIsCriticalOverlay(false);
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

      // Update the local JS Dijkstra pathfinder with active hazards from Firestore
      pathfinder.clearHazards()
      const HAZARD_ALERT_TYPES = new Set(['FIRE', 'HEAVY_SMOKE', 'LIGHT_SMOKE', 'GAS_LEAK', 'STRUCTURAL_DAMAGE', 'FLOODING', 'CONGESTION'])
      filtered.forEach(a => {
        if (a.status === 'RESOLVED') return;
        const location = (a.roomNumber || '').toUpperCase();
        // Only mark corridor/hallway/exit nodes as hazards — not room numbers (R...)
        if (location.startsWith('R') && !location.startsWith('RAMP')) return;
        
        // Use emergencyType field directly if it is a recognised hazard type
        let dangerType = null;
        const et = (a.emergencyType || a.contextType || '').toUpperCase();
        if (HAZARD_ALERT_TYPES.has(et)) {
          dangerType = et;
        } else {
          // Fall back to message keyword parsing
          const msg = (a.message || '').toUpperCase();
          if (msg.includes('LIGHT SMOKE')) dangerType = 'LIGHT_SMOKE';
          else if (msg.includes('HEAVY SMOKE') || msg.includes('SMOKE')) dangerType = 'HEAVY_SMOKE';
          else if (msg.includes('CONGESTION') || msg.includes('CROWD') || msg.includes('PANIC')) dangerType = 'CONGESTION';
          else if (msg.includes('GAS')) dangerType = 'GAS_LEAK';
          else if (msg.includes('STRUCTURAL') || msg.includes('DAMAGE') || msg.includes('COLLAPSE') || msg.includes('VIBRATION')) dangerType = 'STRUCTURAL_DAMAGE';
          else if (msg.includes('FLOOD') || msg.includes('WATER') || msg.includes('BURST')) dangerType = 'FLOODING';
          else if (msg.includes('FIRE')) dangerType = 'FIRE';
        }
        if (dangerType) {
          pathfinder.markHazard(location, dangerType);
        }
      })
      calculateLocalPath()
    }, (err) => {
      setError('Connection Failed: ' + err.message)
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
    } else {
      setHeading(0)
      setNextWaypoint('')
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

  const triggerSimulation = async (room, dangerType, msg) => {
    try {
      const payload = {
        uniqueId: `SIM-DIJKSTRA-${Date.now()}`,
        timestamp: Date.now(),
        timeToLive: 600000,
        status: 'PENDING',
        priority: dangerType === 'FIRE' ? 'CRITICAL' : 'MEDIUM',
        userId: 'SIM-RADAR-01',
        hotelId: hotelId,
        message: `${msg} (${dangerType})`,
        emergencyType: dangerType,
        contextType: dangerType,
        roomNumber: room,
        floor: '3rd Floor',
      };
      // Write to Firestore first — the snapshot listener updates the pathfinder map instantly
      await addDoc(collection(db, 'alerts'), payload);
      // Also post to Java REST backend for SSE broadcast
      sendAlert(payload).catch(() => {});
    } catch (e) {
      console.error('Trigger simulation failed:', e);
    }
  };

  const clearSimulation = async () => {
    try {
      for (const a of alerts) {
        if (a.status !== 'RESOLVED') {
          try {
            await resolveAlert(a.uniqueId || a.id);
          } catch (err) {}
          if (a.id) {
            const alertRef = doc(db, 'alerts', a.id);
            await updateDoc(alertRef, { status: 'RESOLVED' });
          }
        }
      }
    } catch (e) {
      console.error('Clear simulation failed:', e);
    }
  };

  const simulateFireEndpoint = async () => {
    setFireSimLoading(true);
    try {
      const response = await fetch(`http://localhost:8080/api/alerts/path?roomId=R301&hazardId=H_NORTH`);
      if (!response.ok) throw new Error('Failed to trigger');
      
      const data = await response.json();
      if (data.heading !== undefined) setHeading(data.heading);
      if (data.nextWaypoint) setNextWaypoint(data.nextWaypoint);
      if (data.reroute_ms !== undefined) setLastRerouteMs(data.reroute_ms);
      
      setToastMessage({ type: 'success', text: '🔥 Fire Simulated — Guests Rerouting...' });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (e) {
      setToastMessage({ type: 'error', text: '⚠️ Trigger failed — check backend connection' });
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setFireSimLoading(false);
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

  const handleEscalate = async (alert, responder, silent) => {
    try {
      await escalateAlert(alert.uniqueId || alert.id, { responder, silent });
      
      if (alert.id) {
        const alertRef = doc(db, 'alerts', alert.id);
        await updateDoc(alertRef, { 
          status: 'ESCALATED',
          priority: 'CRITICAL',
          aiThreatSeverity: `DISPATCHED: ${responder} (${silent ? 'SILENT' : 'AUDIBLE'})`
        });
      }
      
      // Broadcast instant notification warning
      await addDoc(collection(db, 'broadcasts'), {
        message: `🚨 EEP WARNING: ${responder} authorities dispatched to Room ${alert.roomNumber}. Avoid sector!`,
        sender: 'ADMIN',
        timestamp: Date.now(),
        hotelId: hotelId || 'GLOBAL'
      });

      setIncomingSOS(prev => prev ? { 
        ...prev, 
        status: 'ESCALATED',
        aiThreatSeverity: `DISPATCHED: ${responder}`
      } : null);

      if (!silent) {
        triggerAlertSound('CRITICAL');
        tars.playEscalation();
      } else {
        stopAlertSounds();
      }

      setIsCrisisLockdown(true);
      setShowEscalationForm(false);
      setShowSOSPopup(false);
    } catch (err) {
      console.error("EEP Escalation failed:", err);
    }
  }

  const activeThreats = alerts.filter(a => a.status !== 'RESOLVED' && a.priority !== 'NONE');

  return (
    <div className={`min-h-screen bg-[#030303] text-zinc-100 flex flex-col overflow-hidden relative pb-16 transition-all duration-500 ${
      showSOSPopup ? 'animate-pulse-red' : ''
    } ${isCrisisLockdown ? 'border-[8px] border-rose-600/40' : ''}`}>
      {/* Background Decorators */}
      <div className="cyber-grid absolute inset-0"></div>
      <div className="absolute top-[10%] left-[30%] w-[500px] h-[500px] bg-rose-500/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-emerald-500/5 blur-[100px] pointer-events-none"></div>
 
      <audio ref={audioRef} autoPlay />

      {toastMessage && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl border backdrop-blur-md shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-all duration-300 animate-fadeIn ${
          toastMessage.type === 'success' 
            ? 'bg-rose-950/90 border-rose-500/60 text-rose-400' 
            : 'bg-zinc-950/90 border-amber-500/60 text-amber-400'
        }`}>
          <p className="font-mono text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            {toastMessage.text}
          </p>
        </div>
      )}

      {/* TARS: Critical Threat Screen Overlay */}
      {isCriticalOverlay && (
        <div className="fixed inset-0 z-[45] pointer-events-none critical-screen-overlay">
          <div className="absolute inset-0 border-[3px] border-rose-500/30 animate-pulse rounded-none"></div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-rose-500/80 to-transparent animate-pulse"></div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-rose-500/80 to-transparent animate-pulse"></div>
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-rose-500/60 to-transparent animate-pulse"></div>
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-rose-500/60 to-transparent animate-pulse"></div>
          <div className="absolute inset-0 bg-rose-500/[0.03] animate-critical-flash"></div>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[46]">
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-600/90 backdrop-blur-md px-5 py-2 shadow-[0_0_30px_rgba(225,29,72,0.4)]">
              <span className="h-2 w-2 rounded-full bg-white animate-ping"></span>
              <span className="font-mono text-[9px] font-black text-white uppercase tracking-[0.2em]">TARS // CRITICAL THREAT ACTIVE</span>
            </span>
          </div>
        </div>
      )}
 
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
          <button
            onClick={simulateFireEndpoint}
            disabled={fireSimLoading}
            className={`flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 font-display text-[9px] font-bold tracking-widest uppercase transition-all shadow-[0_0_12px_rgba(239,68,68,0.15)] ${
              fireSimLoading ? 'opacity-50 cursor-not-allowed text-rose-300' : 'text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 cursor-pointer'
            }`}
          >
            {fireSimLoading ? 'TRIGGERING...' : '🔥 SIMULATE FIRE'}
          </button>
          <button
            onClick={() => setShowMap(true)}
            className="flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 font-display text-[9px] font-bold tracking-widest uppercase text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 cursor-pointer transition-all shadow-[0_0_12px_rgba(59,130,246,0.15)]"
          >
            🗺️ EVAC MAP
          </button>
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

      {/* EVAC MAP MODAL */}
      {showMap && (
        <div className="fixed inset-0 z-[2000] overflow-hidden bg-black animate-fadeIn">
          <HotelMapSystem onClose={() => setShowMap(false)} />
        </div>
      )}

      {/* CRISIS LOCKDOWN STATUS BAR */}
      {isCrisisLockdown && (
        <div className="bg-rose-600 border-b border-rose-500/30 px-6 py-2.5 flex items-center justify-between text-white relative z-30 animate-pulse relative">
          <div className="flex items-center gap-2">
            <span className="animate-ping h-2.5 w-2.5 rounded-full bg-white"></span>
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.25em]">🚨 EMERGENCY CRISIS LOCKDOWN MODE ENGAGED // EEP DIRECT BROADCAST ONLINE</p>
          </div>
          <button 
            onClick={() => {
              setIsCrisisLockdown(false);
              stopAlertSounds();
            }}
            className="px-4 py-1.5 bg-black/40 hover:bg-rose-700/80 text-white font-mono text-[8px] font-black uppercase rounded-lg border border-white/10 transition cursor-pointer"
          >
            DISARM LOCKDOWN
          </button>
        </div>
      )}
      
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
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Voice Connection Ready</p>
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
              
              <button 
                onClick={() => setShowEscalationForm(true)}
                className="col-span-2 py-4 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-[10px] uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[0_0_20px_rgba(225,29,72,0.3)] animate-pulse"
              >
                🚨 ACTIVATE EMERGENCY ESCALATION OVERRIDE
              </button>

              {isAlarmPlaying && (
                <button onClick={stopAlertSounds} className="col-span-2 py-4 bg-zinc-900 border border-amber-500/20 text-amber-400 hover:bg-amber-600 hover:text-white hover:border-amber-600 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer">
                  🔇 Silence Alarm
                </button>
              )}
            </div>

            {showEscalationForm && (
              <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn">
                <div className="w-full max-w-lg bg-zinc-950 border border-rose-500/40 rounded-3xl p-6 shadow-[0_0_60px_rgba(225,29,72,0.25)] relative">
                  <h3 className="font-display text-lg font-black text-rose-500 uppercase tracking-wider mb-2">🚨 EMERGENCY DISPATCH PORTAL (EEP)</h3>
                  <p className="text-[10px] text-zinc-500 font-semibold mb-4 uppercase tracking-widest">AUTHORIZED PERSONNEL OVERRIDE ONLY</p>
                  
                  {/* Automated Incident Packet Display */}
                  <div className="bg-zinc-900/60 border border-white/5 p-4 rounded-xl mb-4 text-[10px]">
                    <h4 className="font-display font-black text-white uppercase tracking-wider mb-2">📦 Compiled Incident Packet Telemetry</h4>
                    <ul className="space-y-1.5 font-mono font-semibold text-zinc-400">
                      <li>🏢 <span className="text-white">Hotel:</span> Vanguard Grand Plaza - Sector {hotelId}</li>
                      <li>📍 <span className="text-white">Sector Room:</span> Room {incomingSOS.roomNumber} ({incomingSOS.floor || '3rd Floor'})</li>
                      <li>⚠️ <span className="text-white">Threat Appraisal:</span> {incomingSOS.message}</li>
                      <li>🤖 <span className="text-white">AI Confidence Score:</span> 98.4%</li>
                      <li>👥 <span className="text-white">Est. Impacted Guests:</span> 12 Persons</li>
                      <li>📹 <span className="text-white">CCTV Snapshots:</span> 🟢 LIVE GRAPH DISPATCH SECURED</li>
                    </ul>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Select Responder Agency</span>
                      <select 
                        value={selectedResponder} 
                        onChange={(e) => setSelectedResponder(e.target.value)} 
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-black outline-none focus:border-rose-500 text-white cursor-pointer"
                      >
                        <option value="POLICE">POLICE DEPARTMENT 👮</option>
                        <option value="FIRE_DEPT">FIRE & RESCUE 🚒</option>
                        <option value="EMS_MEDICAL">EMS MEDICAL TEAM 🚑</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center justify-between p-3.5 bg-zinc-900/40 rounded-xl border border-white/5">
                      <div>
                        <p className="text-[10px] font-black text-white uppercase tracking-wider">Silent Escalation Mode</p>
                        <p className="text-[8px] text-zinc-500 tracking-wide mt-0.5">Alerts authorities quietly without triggering audible sirens</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={isSilentDispatched}
                        onChange={(e) => setIsSilentDispatched(e.target.checked)}
                        className="h-4 w-4 bg-zinc-950 border-white/10 rounded cursor-pointer accent-rose-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setShowEscalationForm(false)} 
                      className="py-3 bg-zinc-900 border border-white/10 text-zinc-400 font-black rounded-xl text-[9px] uppercase tracking-widest transition-all cursor-pointer text-center"
                    >
                      Cancel Override
                    </button>
                    <button 
                      onClick={() => handleEscalate(incomingSOS, selectedResponder, isSilentDispatched)}
                      className="py-3 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-[9px] uppercase tracking-widest transition-all cursor-pointer text-center shadow-[0_0_15px_rgba(225,29,72,0.35)] animate-pulse"
                    >
                      🚀 Dispatch Responders
                    </button>
                  </div>
                </div>
              </div>
            )}
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
            <p className="font-mono text-[9px] font-black tracking-widest text-zinc-500 mb-1.5 uppercase">Encryption Connection</p>
            <p className="font-display text-4xl font-black text-white leading-none">ACTIVE</p>
          </div>
          <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-amber-500 relative overflow-hidden group">
            <div className="absolute top-[-10%] right-[-10%] w-[80px] h-[80px] rounded-full bg-amber-500/5 group-hover:bg-amber-500/10 transition-all blur-md"></div>
            <p className="font-mono text-[9px] font-black tracking-widest text-zinc-500 mb-1.5 uppercase">Mesh Relay Nodes</p>
            <p className="font-display text-4xl font-black text-white leading-none">32</p>
          </div>
          <div className={`tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 relative overflow-hidden group transition-all duration-500 ${
            tarsLevel === 'CRITICAL' ? 'border-rose-500' : tarsLevel === 'MEDIUM' ? 'border-amber-500' : tarsLevel === 'LOW' ? 'border-sky-500' : 'border-emerald-500'
          }`}>
            <div className={`absolute top-[-10%] right-[-10%] w-[80px] h-[80px] rounded-full transition-all blur-md ${
              tarsLevel === 'CRITICAL' ? 'bg-rose-500/15 animate-ping' : tarsLevel === 'MEDIUM' ? 'bg-amber-500/10' : 'bg-emerald-500/5 group-hover:bg-emerald-500/10'
            }`}></div>
            <p className="font-mono text-[9px] font-black tracking-widest text-zinc-500 mb-1.5 uppercase">🔊 TARS Engine</p>
            <p className={`font-display text-xl font-black leading-none transition-colors duration-300 ${
              tarsLevel === 'CRITICAL' ? 'text-rose-500 animate-pulse' : tarsLevel === 'MEDIUM' ? 'text-amber-400' : tarsLevel === 'LOW' ? 'text-sky-400' : 'text-emerald-400'
            }`}>{tarsLevel || 'STANDBY'}</p>
          </div>
        </div>

        {/* Dashboard Panels Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: LIVE FEED & SAFEPATH RADAR */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Live Sensor Feed (TARS: Auto-scroll target for CRITICAL alerts) */}
            <div ref={cctvFeedRef} className={`tactical-glass rounded-3xl overflow-hidden relative border group shadow-[0_15px_40px_rgba(0,0,0,0.5)] transition-all duration-500 ${
              tarsLevel === 'CRITICAL' ? 'border-rose-500/40 shadow-[0_15px_60px_rgba(239,68,68,0.2)] ring-2 ring-rose-500/20' : 'border-white/5'
            }`}>
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
                   {/* Live Reroute Speed Badge */}
                   <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest transition-all duration-500 ${
                     lastRerouteMs === null
                       ? 'bg-zinc-900/80 border-zinc-700/50 text-zinc-500'
                       : lastRerouteMs > 500
                       ? 'bg-rose-950/80 border-rose-500/50 text-rose-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                       : lastRerouteMs > 100
                       ? 'bg-amber-950/80 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                       : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                   }`}>
                     <span className={`h-1.5 w-1.5 rounded-full ${
                       lastRerouteMs === null ? 'bg-zinc-600' :
                       lastRerouteMs > 500 ? 'bg-rose-500 animate-ping' :
                       lastRerouteMs > 100 ? 'bg-amber-400' : 'bg-emerald-400'
                     }`} />
                     {lastRerouteMs === null ? 'SafePath: Standby' : `Last Reroute: ${lastRerouteMs}ms ⚡`}
                   </div>
                </div>
              </div>
            </div>

            {/* Vanguard Dynamic Dijkstra Graph Simulator Card */}
            <div className="tactical-glass rounded-3xl p-6 border border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
              <h3 className="font-display text-xs font-black text-rose-400 mb-2 uppercase tracking-[0.25em]">Tactical Graph Simulator</h3>
              <p className="text-[10px] text-zinc-500 font-semibold mb-4 leading-relaxed">
                Click any simulated incident to inject telemetry into the routing engine and watch the SafePath radar dynamically calculate the survivable route.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => triggerSimulation('H_NORTH', 'FIRE', 'FIRE DETECTED IN NORTH HALLWAY')}
                  className="px-3 py-2.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-400 hover:bg-rose-600 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  🔥 North Hall Fire (Blocked)
                </button>
                <button
                  onClick={() => triggerSimulation('H_SOUTH', 'FIRE', 'FIRE DETECTED IN SOUTH HALLWAY')}
                  className="px-3 py-2.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-400 hover:bg-rose-600 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  🔥 South Hall Fire (Blocked)
                </button>
                <button
                  onClick={() => triggerSimulation('H_SOUTH', 'HEAVY_SMOKE', 'HEAVY SMOKE IN SOUTH HALLWAY')}
                  className="px-3 py-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-400 hover:bg-amber-600 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  💨 South Heavy Smoke (+50 Wt)
                </button>
                <button
                  onClick={() => triggerSimulation('H_NORTH', 'LIGHT_SMOKE', 'LIGHT SMOKE IN NORTH HALLWAY')}
                  className="px-3 py-2.5 rounded-xl border border-yellow-500/30 bg-yellow-950/20 text-yellow-400 hover:bg-yellow-600 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  💨 North Light Smoke (+10 Wt)
                </button>
                <button
                  onClick={() => triggerSimulation('H_SOUTH', 'CONGESTION', 'CONGESTION IN SOUTH HALLWAY')}
                  className="px-3 py-2.5 rounded-xl border border-sky-500/30 bg-sky-950/20 text-sky-400 hover:bg-sky-500 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  👥 South Congestion (+15 Wt)
                </button>
                <button
                  onClick={() => triggerSimulation('H_NORTH', 'GAS_LEAK', 'GAS LEAK IN NORTH HALLWAY')}
                  className="px-3 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-600 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  ⚠️ North Gas Leak (+100 Wt)
                </button>
                <button
                  onClick={() => triggerSimulation('H_NORTH', 'STRUCTURAL_DAMAGE', 'STRUCTURAL DAMAGE IN NORTH HALLWAY')}
                  className="px-3 py-2.5 rounded-xl border border-purple-500/30 bg-purple-950/20 text-purple-400 hover:bg-purple-600 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  🏗️ North Structural Damage (Blocked)
                </button>
                <button
                  onClick={() => triggerSimulation('H_SOUTH', 'FLOODING', 'FLOODING DETECTED IN SOUTH HALLWAY')}
                  className="px-3 py-2.5 rounded-xl border border-blue-500/30 bg-blue-950/20 text-blue-400 hover:bg-blue-600 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  🌊 South Flooding (+200 Wt)
                </button>
                <button
                  onClick={clearSimulation}
                  className="col-span-1 sm:col-span-2 py-3 rounded-xl border border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white text-[9px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer text-center"
                >
                  ✅ Clear All Active Threats
                </button>
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