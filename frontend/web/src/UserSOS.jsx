import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyLatestAlert, getSafeHeading, logout, sendAlert, sendSignal, baseURL } from './api';
import HotelMapSystem from './HotelMap';
import { db, auth } from './firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, limit, getDoc } from 'firebase/firestore';

function UserSOS() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sosMessage, setSosMessage] = useState('')
  const [contextType, setContextType] = useState('GENERAL')
  const [isMobilityImpaired, setIsMobilityImpaired] = useState(false)
  const [roomNumber, setRoomNumber] = useState(localStorage.getItem('roomNumber') || '')
  const [editingRoom, setEditingRoom] = useState(false)
  const [isLanActive, setIsLanActive] = useState(true)
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [latestStatus, setLatestStatus] = useState('')
  const [isEmergencyActive, setIsEmergencyActive] = useState(false)
  const [isStealth, setIsStealth] = useState(localStorage.getItem('vanguard_stealth') === 'true')
  
  // New SOS states
  const [isHolding, setIsHolding] = useState(false);
  const [sosStatus, setSosStatus] = useState('idle'); // idle, sending, success, error
  const holdTimerRef = useRef(null);

  // WebRTC States
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('standby'); // standby, connecting, connected
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  // Speech Recognition States
  const [isListeningForKeyword, setIsListeningForKeyword] = useState(false);
  const [keywordDetected, setKeywordDetected] = useState(false);
  const recognitionRef = useRef(null);
  const handleSendSOSRef = useRef(null);

  const [clock, setClock] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  const [showMap, setShowMap] = useState(false)
  const [heading, setHeading] = useState(0)
  const [nextWaypoint, setNextWaypoint] = useState('')
  const [estimatedTime, setEstimatedTime] = useState(0)
  const [rerouteMs, setRerouteMs] = useState(42)
  const [aiSeverity, setAiSeverity] = useState('');

  const fetchPathData = async () => {
    try {
      const storedRoom = roomNumber || localStorage.getItem('roomNumber') || '301';
      const formattedRoom = storedRoom.startsWith('R') ? storedRoom : `R${storedRoom}`;
      const response = await fetch(`${baseURL}/alerts/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: localStorage.getItem('userId') || 'GUEST',
          currentNode: formattedRoom,
          mobilityImpaired: isMobilityImpaired
        })
      });
      const data = await response.json();
      
      if (data.status === 'no_accessible_route') {
        setError('⚠️ No accessible path found — Staff assistance dispatched');
        const payload = {
          uniqueId: "SOS-" + Date.now().toString(),
          timestamp: Date.now(),
          timeToLive: 600000,
          status: "PENDING",
          priority: "CRITICAL",
          userId: localStorage.getItem('userId') || 'GUEST',
          roomNumber: (roomNumber || '301').startsWith('R') ? (roomNumber || '301') : `R${roomNumber || '301'}`,
          emergencyType: 'MEDICAL',
          message: '⚠️ WHEELCHAIR GUEST TRAPPED - NO ACCESSIBLE ROUTE',
          vulnerabilityProfile: 'WHEELCHAIR',
        };
        sendAlert(payload);
        return;
      }

      setHeading(data.heading);
      setNextWaypoint(data.nextWaypoint);
      setEstimatedTime(data.estimatedTimeSeconds);
      if (data.reroute_ms !== undefined) setRerouteMs(data.reroute_ms);
      
      if (isMobilityImpaired && data.nextWaypoint) {
        speakInstruction(`Warning. Proceed towards ${data.nextWaypoint}. Time to safety is ${Math.floor(data.estimatedTimeSeconds / 60)} minutes.`);
      }
    } catch { }
  }

  const speakInstruction = (text) => {
    if (isStealth) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  const toggleStealth = () => {
    const newState = !isStealth;
    setIsStealth(newState);
    localStorage.setItem('vanguard_stealth', newState.toString());
    if (newState) window.speechSynthesis.cancel();
  }

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const eventSource = new EventSource(`http://${window.location.hostname}:8080/api/alerts/stream`);
    eventSource.addEventListener('WEBRTC_SIGNAL', async (e) => {
      const data = JSON.parse(e.data);
      if (data.targetId === localStorage.getItem('userId')) {
        const { signal } = data;
        if (signal.type === 'answer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          setVoiceStatus('connected');
        } else if (signal.candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      }
    });
    return () => eventSource.close();
  }, []);

  useEffect(() => {
    const loadRoomFromFirestore = async () => {
      const email = auth.currentUser?.email || localStorage.getItem('userId');
      if (!email) return;
      if (localStorage.getItem('roomNumber')) return;
      try {
        const snap = await getDoc(doc(db, 'customers', email));
        if (snap.exists()) {
          const data = snap.data();
          const room = data.roomNumber || '301';
          localStorage.setItem('roomNumber', room);
          setRoomNumber(room);
        }
      } catch { }
    };
    loadRoomFromFirestore();
  }, []);

  useEffect(() => {
    const loadLatestStatus = async () => {
      try {
        const uid = localStorage.getItem('userId');
        const response = await getMyLatestAlert(uid)
        const status = response.data?.status || '';
        const severity = response.data?.aiThreatSeverity || '';
        setLatestStatus(status);
        setAiSeverity(severity);
        
        if (status === 'RESOLVED') {
          setIsEmergencyActive(false);
          setSosStatus('idle');
          setIsVoiceActive(false);
          setVoiceStatus('standby');
          if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        } else if (status === 'PENDING' || status === 'ACKNOWLEDGED' || status === 'DISPATCHED') {
          setIsEmergencyActive(true);
          setSosStatus('success');
        }
      } catch { }
    }
    loadLatestStatus();
    fetchPathData();
    const timer = setInterval(() => {
      loadLatestStatus();
      if (isEmergencyActive) fetchPathData();
    }, 5000);
  return () => clearInterval(timer);
  }, [isEmergencyActive, isMobilityImpaired])

  const startVoiceComms = async () => {
    try {
      setVoiceStatus('connecting');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      pc.onicecandidate = (event) => {
        if (event.candidate) sendSignal('ADMIN', { candidate: event.candidate });
      };
      pc.ontrack = (event) => {
        const remoteAudio = document.getElementById('remote-audio');
        if (remoteAudio) remoteAudio.srcObject = event.streams[0];
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal('ADMIN', offer);
      setIsVoiceActive(true);
      setMessage('LIVE VOICE CHANNEL SECURED');
    } catch (err) {
      setError('VOICE CONNECTION FAILED: ' + err.message);
      setVoiceStatus('standby');
    }
  }

  const startHold = () => {
    if (sosStatus === 'success' || sosStatus === 'sending') return;
    setIsHolding(true);
    setSosStatus('idle');
    holdTimerRef.current = setTimeout(() => {
      setIsHolding(false);
      handleSendSOS();
    }, 2000);
  };

  const endHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    setIsHolding(false);
  };

  const handleSendSOS = async () => {
    setLoading(true);
    setSosStatus('sending');
    const stableId = localStorage.getItem('userId') || ("GUEST-" + Math.floor(Math.random() * 1000));
    localStorage.setItem('userId', stableId);
    setIsEmergencyActive(true);

    try {
      const payload = {
        uniqueId: "SOS-" + Date.now().toString(),
        timestamp: Date.now(),
        timeToLive: 600000,
        status: "PENDING",
        priority: contextType === 'THREAT' ? 'CRITICAL' : 'MEDIUM',
        userId: stableId,
        roomNumber: (roomNumber || '301').startsWith('R') ? (roomNumber || '301') : `R${roomNumber || '301'}`,
        floor: '3rd Floor',
        emergencyType: contextType,
        message: sosMessage || `EMERGENCY: ${contextType} situation at Room ${roomNumber || '301'}.`,
        vulnerabilityProfile: isMobilityImpaired ? 'WHEELCHAIR' : 'NONE',
        hotelId: localStorage.getItem('hotelId') || 'GLOBAL',
      }
      
      const alertDoc = await addDoc(collection(db, 'alerts'), {
        ...payload,
        aiThreatSeverity: "ANALYZING...",
        timestamp: Date.now()
      });

      setLatestStatus('PENDING');
      setMessage('TACTICAL SOS BROADCASTED');
      setSosStatus('success');
      
      sendAlert(payload).then(resp => {
        const aiSeverity = resp.data.aiThreatSeverity;
        setAiSeverity(aiSeverity);
        updateDoc(doc(db, 'alerts', alertDoc.id), { aiThreatSeverity: aiSeverity });
      }).catch(err => {
        console.warn("AI Connection Failed");
        setAiSeverity("MANUAL TRIAGE REQUIRED");
      });

      if (payload.priority === 'CRITICAL') startVoiceComms();
      fetchPathData();
    } catch (err) { 
      console.error(err);
      setError('SIGNAL JAMMED: RETRYING'); 
      setSosStatus('error');
    }
    finally { setLoading(false); }
  }

  // Keep ref to latest handleSendSOS for speech recognition callback
  useEffect(() => {
    handleSendSOSRef.current = handleSendSOS;
  });

  // SPEECH RECOGNITION — manual start via click
  const startListening = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('VOICE NOT SUPPORTED IN THIS BROWSER');
      return;
    }

    // Step 1: Explicitly request mic permission first (triggers browser popup)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('mediaDevices API not available (requires HTTPS or localhost)');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Got permission — stop the stream immediately, SpeechRecognition uses its own
      stream.getTracks().forEach(t => t.stop());
    } catch (e) {
      setError(`MIC ERROR: ${e.name} - ${e.message}`);
      return;
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e){}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    const keywords = ["help", "sos", "emergency", "fire", "send help", "send sos", "evacuate", "danger", "call police", "trapped"];
    let isDetecting = false;

    recognition.onstart = () => {
      setIsListeningForKeyword(true);
      setError('');
    };

    recognition.onresult = (event) => {
      if (isDetecting) return;
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript.toLowerCase();
      }

      const found = keywords.some(k => transcript.includes(k));
      if (found) {
        isDetecting = true;
        setKeywordDetected(true);
        recognition.stop();
        setTimeout(() => {
          if (handleSendSOSRef.current) handleSendSOSRef.current();
          setKeywordDetected(false);
        }, 2000);
      }
    };

    recognition.onend = () => {
      setIsListeningForKeyword(false);
      if (!isDetecting && !isEmergencyActive && sosStatus !== 'success') {
        try { recognition.start(); } catch(e){}
      }
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      setIsListeningForKeyword(false);
      setError('VOICE ERROR: ' + e.error.toUpperCase());
    };

    try {
      recognition.start();
    } catch(e) {
      setError('FAILED TO START VOICE: ' + e.message);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e){}
      }
    };
  }, []);

  return (
    <div className={`fixed inset-0 flex flex-col items-center justify-center p-4 transition-all duration-700 overflow-hidden pt-12 ${
      isEmergencyActive ? 'bg-rose-950/20 critical-screen-overlay' : 'bg-[#030303]'
    } ${isStealth ? 'brightness-[0.25] grayscale' : ''}`}>
      
      {/* ROOM + GUEST INFO HEADER */}
      <div className="w-full bg-zinc-900/50 border-b border-white/10 px-4 py-2 flex items-center justify-between absolute top-0 left-0 z-50 backdrop-blur-md">
         <div className="flex items-center gap-3">
           <span className="font-display text-[10px] font-black text-white uppercase tracking-widest">{localStorage.getItem('guestName') || 'GUEST USER'}</span>
           <span className="font-mono text-[9px] text-zinc-400 uppercase tracking-widest border-l border-white/20 pl-3">RM {roomNumber || '301'}</span>
           <span className="font-mono text-[9px] text-zinc-400 uppercase tracking-widest border-l border-white/20 pl-3 hidden sm:inline">{localStorage.getItem('hotelName') || 'VANGUARD PLAZA'}</span>
         </div>
         <div className="flex items-center gap-1.5">
           <span className="text-[10px]">🔒</span>
           <span className="font-mono text-[8px] font-black text-emerald-400 uppercase tracking-widest hidden sm:inline">SECURE SESSION</span>
         </div>
      </div>

      {/* Background Decorators */}
      <div className="cyber-grid absolute inset-0"></div>
      <div className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none ${isEmergencyActive ? 'opacity-35' : 'opacity-10'}`}>
        <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${isEmergencyActive ? 'from-rose-950/40' : 'from-zinc-900/20'} via-black to-black`}></div>
        {isEmergencyActive && <div className="absolute inset-0 scanline-container opacity-30"></div>}
      </div>

      {showMap && (
        <div className="fixed inset-0 z-[200] overflow-hidden bg-black animate-fadeIn">
          <HotelMapSystem onClose={() => setShowMap(false)} isMobilityImpaired={isMobilityImpaired} />
        </div>
      )}

      <div className="w-full h-full max-w-md flex flex-col justify-between relative z-10 py-2">
        
        {/* TOP STATUS BAR */}
        <div className="flex justify-between items-end mb-4 px-1">
          <div className="flex flex-col">
            <h2 className="font-display text-2xl font-black tracking-widest leading-none text-white flex items-center gap-1.5">
              VANGUARD <span className="text-rose-500">SOS</span>
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${isLanActive ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-rose-600 shadow-[0_0_8px_#e11d48]'}`}></span>
              <span className="font-mono text-[8px] font-black tracking-widest text-zinc-500 uppercase">{isLanActive ? 'Mesh Link: Secured' : 'Mesh: Disconnected'}</span>
            </div>
            {/* Editable Room Number */}
            {editingRoom ? (
              <form onSubmit={(e) => { e.preventDefault(); const val = e.target.room.value.trim(); if(val) { setRoomNumber(val); localStorage.setItem('roomNumber', val); } setEditingRoom(false); }} className="flex items-center gap-1 mt-1.5">
                <input name="room" defaultValue={roomNumber} autoFocus className="w-16 bg-zinc-900 border border-sky-500/50 rounded-md px-2 py-0.5 text-[9px] font-black text-sky-400 outline-none" />
                <button type="submit" className="text-[8px] font-black text-sky-400 uppercase tracking-widest cursor-pointer">SAVE</button>
              </form>
            ) : (
              <button onClick={() => setEditingRoom(true)} className="flex items-center gap-1 mt-1.5 cursor-pointer group">
                <span className="font-mono text-[9px] font-black text-sky-400 uppercase tracking-widest group-hover:text-sky-300">
                  RM {roomNumber || '?'}
                </span>
                <span className="font-mono text-[7px] text-zinc-600 group-hover:text-zinc-400">✎ edit</span>
              </button>
            )}
          </div>
          <div className="text-right flex flex-col items-end gap-1.5">
            <span className="font-mono text-base font-bold text-zinc-500 leading-none">{clock}</span>
            <button 
              onClick={toggleStealth}
              className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                isStealth 
                  ? 'bg-rose-600 text-white animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.4)]' 
                  : 'bg-white/5 text-white/30 border border-white/10 hover:border-white/20 hover:text-white/60'
              }`}
            >
              {isStealth ? 'Stealth: ACTIVE' : 'STEALTH MODE'}
            </button>
          </div>
        </div>

        {/* CORE PANEL: Pipeline Response */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
          
          {/* Main SOS Button */}
          <div className="mt-4 mb-2 flex justify-center items-center relative">
            {/* Pulse rings when idle/holding */}
            {(sosStatus === 'idle' || sosStatus === 'error') && (
              <>
                <div className={`absolute inset-0 bg-rose-600/20 rounded-full animate-ping pointer-events-none transition-all duration-1000 ${isHolding ? 'scale-125' : 'scale-100'}`} style={{ animationDuration: '2s' }}></div>
                <div className={`absolute inset-0 bg-rose-600/10 rounded-full animate-ping pointer-events-none transition-all duration-1000 delay-500 ${isHolding ? 'scale-150' : 'scale-100'}`} style={{ animationDuration: '2s' }}></div>
              </>
            )}
            <button 
              onMouseDown={startHold}
              onMouseUp={endHold}
              onMouseLeave={endHold}
              onTouchStart={startHold}
              onTouchEnd={endHold}
              className={`relative z-10 w-40 h-40 rounded-full font-mono font-black text-[11px] uppercase tracking-widest text-center flex flex-col items-center justify-center transition-all duration-300 cursor-pointer shadow-[0_0_40px_rgba(225,29,72,0.4)] ${
                sosStatus === 'sending' ? 'bg-zinc-800 text-white scale-95' :
                sosStatus === 'success' ? 'bg-emerald-600 text-white shadow-[0_0_40px_rgba(16,185,129,0.4)]' :
                sosStatus === 'error' ? 'bg-amber-600 text-white shadow-[0_0_40px_rgba(245,158,11,0.4)]' :
                isHolding ? 'bg-rose-500 text-white scale-95 shadow-[0_0_60px_rgba(225,29,72,0.6)]' :
                'bg-rose-600 text-white hover:bg-rose-500'
              }`}
            >
              {sosStatus === 'sending' ? (
                <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mb-2"></span><span>SENDING...</span></>
              ) : sosStatus === 'success' ? (
                <><span className="text-3xl mb-1">✓</span><span>HELP IS<br/>COMING</span></>
              ) : sosStatus === 'error' ? (
                <span>RETRY</span>
              ) : (
                <span>PRESS & HOLD<br/>TO SOS</span>
              )}
            </button>
          </div>

          {/* EVACUATION ROUTE DISPLAY */}
          {isEmergencyActive && (
            <div className="w-full flex flex-col items-center p-5 bg-zinc-900/60 border border-emerald-500/30 rounded-2xl relative overflow-hidden mt-2">
               <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50"></div>
               <h3 className="font-display text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">SAFE ROUTE CALCULATED</h3>
               <div className="flex items-center gap-6">
                 {/* Direction Arrow */}
                 <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                   <div 
                     className="w-1 h-8 bg-gradient-to-t from-transparent to-emerald-400 rounded-full transition-transform duration-1000 relative" 
                     style={{ transform: `rotate(${heading || 0}deg)` }}
                   >
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-emerald-400 -mt-1"></div>
                   </div>
                 </div>
                 {/* Waypoint */}
                 <div className="flex flex-col">
                   <span className="font-mono text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Proceed to:</span>
                   <span className="font-mono text-2xl font-black text-white uppercase">{nextWaypoint || 'WAITING...'}</span>
                 </div>
               </div>
               
               <div className="mt-5 flex items-center gap-3 w-full justify-center flex-wrap">
                 <span className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md font-mono text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                   Routed in {rerouteMs}ms
                 </span>
                 {isMobilityImpaired && (
                   <span className="px-2.5 py-1 bg-sky-950/40 border border-sky-500/30 rounded-md font-mono text-[8px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
                     ♿ ACCESSIBILITY ROUTE ACTIVE
                   </span>
                 )}
               </div>
            </div>
          )}

          {/* Voice communications UI */}
          {isEmergencyActive && (
            <div className={`p-4 rounded-2xl border transition-all mt-1 ${voiceStatus === 'connected' ? 'bg-emerald-500/5 border-emerald-500/30' : voiceStatus === 'connecting' ? 'bg-amber-500/5 border-amber-500/30' : 'bg-zinc-900/30 border-white/5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {voiceStatus === 'connected' ? (
                    <div className="flex items-end gap-1 h-4">
                      <div className="w-1 h-full bg-emerald-500 animate-[pulse_1s_infinite_0s]"></div>
                      <div className="w-1 h-3 bg-emerald-500 animate-[pulse_1s_infinite_0.2s]"></div>
                      <div className="w-1 h-full bg-emerald-500 animate-[pulse_1s_infinite_0.4s]"></div>
                    </div>
                  ) : voiceStatus === 'connecting' ? (
                    <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping"></div>
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                  )}
                  
                  <div className="flex flex-col">
                    <span className={`font-mono text-[10px] font-black uppercase tracking-widest ${
                      voiceStatus === 'connected' ? 'text-emerald-400 animate-pulse' :
                      voiceStatus === 'connecting' ? 'text-amber-400 animate-pulse' :
                      'text-zinc-500'
                    }`}>
                      {voiceStatus === 'connected' ? 'LIVE — ADMIN ON LINE' : 
                       voiceStatus === 'connecting' ? 'CONNECTING TO ADMIN...' : 
                       'VOICE LINE STANDBY'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Situation Inputs */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[8px] font-bold text-zinc-500 ml-1.5 uppercase tracking-widest">Situation Type</span>
              <div className="relative">
                <select 
                  value={contextType} 
                  onChange={(e) => setContextType(e.target.value)} 
                  className="w-full bg-zinc-950/60 border border-white/10 rounded-2xl px-4 py-3 text-xs font-black outline-none focus:border-rose-500/55 text-white appearance-none cursor-pointer"
                >
                  <option value="GENERAL">GENERAL Situation</option>
                  <option value="FIRE">FIRE / Smoke outbreak</option>
                  <option value="THREAT">INTRUDER / Armed threat</option>
                  <option value="MEDICAL">MEDICAL Emergency</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none text-[8px]">▼</div>
              </div>
            </div>
            <div className="flex flex-col gap-1 justify-center px-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-zinc-950/60 border border-white/10 rounded-2xl transition hover:border-sky-500/50">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 accent-sky-500 rounded bg-zinc-950 border-white/10 cursor-pointer"
                  checked={isMobilityImpaired}
                  onChange={(e) => setIsMobilityImpaired(e.target.checked)}
                />
                <span className={`font-mono text-[9px] font-black uppercase tracking-widest ${isMobilityImpaired ? 'text-sky-400' : 'text-zinc-400'}`}>
                  ♿ I need an accessible route
                </span>
              </label>
            </div>
          </div>

          {/* Description Text */}
          <div className="flex-1 min-h-[80px] flex flex-col gap-1 mt-1">
            <span className="font-mono text-[8px] font-bold text-zinc-500 ml-1.5 uppercase tracking-widest">Optional Details</span>
            <textarea 
              value={sosMessage} 
              onChange={(e) => setSosMessage(e.target.value)} 
              placeholder="DESCRIBE SITUATION SPECIFICS (OPTIONAL)..." 
              className="w-full flex-1 bg-zinc-950/60 border border-white/10 rounded-2xl px-4 py-3 text-xs font-medium outline-none focus:border-rose-500/55 text-white placeholder:text-zinc-800 resize-none transition"
            />
          </div>
        </div>

        {/* FEEDBACK logs */}
        <div className="h-6 flex flex-col items-center justify-center my-1">
          {message && <p className="font-mono text-[8px] font-black text-emerald-400 uppercase tracking-[0.2em] animate-pulse">{message}</p>}
          {error && <p className="font-mono text-[8px] font-black text-rose-500 uppercase tracking-[0.2em] animate-pulse">{error}</p>}
        </div>

        <audio id="remote-audio" autoPlay />

        {/* VOICE TRIGGER — tap to activate, no animations */}
        <button
          onClick={startListening}
          className={`flex items-center justify-center gap-2 mb-2 cursor-pointer py-2 px-4 rounded-lg transition-colors ${
            isListeningForKeyword ? 'bg-emerald-500/10 border border-emerald-500/20' :
            keywordDetected ? 'bg-rose-500/10 border border-rose-500/20' :
            'bg-zinc-900/50 border border-white/5 hover:border-white/10'
          }`}
        >
          <svg className={`w-3 h-3 ${keywordDetected ? 'text-rose-400' : isListeningForKeyword ? 'text-emerald-400' : 'text-zinc-500'}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-2a5 5 0 01-10 0H3a7.001 7.001 0 006 6.93V17H6v2h8v-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
          <span className={`font-mono text-[8px] font-black uppercase tracking-widest ${keywordDetected ? 'text-rose-400' : isListeningForKeyword ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {keywordDetected ? 'KEYWORD DETECTED \u2014 SENDING SOS' : isListeningForKeyword ? 'LISTENING FOR VOICE TRIGGER' : 'TAP TO ACTIVATE VOICE TRIGGER'}
          </span>
        </button>

        {/* BOTTOM ACTIONS FOOTER */}
        <div className="grid grid-cols-2 gap-4 mt-1">
          <button 
            onClick={() => setShowMap(!showMap)} 
            className="py-3 px-4 bg-zinc-950 border border-white/5 rounded-xl font-display text-[9px] font-black uppercase text-zinc-400 tracking-widest hover:text-white hover:bg-white/5 hover:border-white/10 transition-colors cursor-pointer text-center"
          >
            Evac Map
          </button>
          <button 
            onClick={() => {
              localStorage.clear();
              navigate('/');
            }} 
            className="py-3 px-4 bg-zinc-950 border border-white/5 rounded-xl font-display text-[9px] font-black uppercase text-zinc-400 tracking-widest hover:text-white hover:bg-rose-600/10 hover:border-rose-500/20 transition-colors cursor-pointer text-center"
          >
            Log Out Exit
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserSOS;
