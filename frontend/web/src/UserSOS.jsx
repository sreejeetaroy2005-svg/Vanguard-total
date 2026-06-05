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
  
  // WebRTC States
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const [clock, setClock] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  const [showMap, setShowMap] = useState(false)
  const [heading, setHeading] = useState(0)
  const [nextWaypoint, setNextWaypoint] = useState('')
  const [estimatedTime, setEstimatedTime] = useState(0)
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
        // Let staff know immediately
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
      
      if (isMobilityImpaired && data.nextWaypoint) {
        speakInstruction(`Warning. Proceed towards ${data.nextWaypoint}. Time to safety is ${Math.floor(data.estimatedTimeSeconds / 60)} minutes.`);
      }
    } catch { }
  }

  const speakInstruction = (text) => {
    if (isStealth) return; // Mute if in stealth mode
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  const toggleStealth = () => {
    const newState = !isStealth;
    setIsStealth(newState);
    localStorage.setItem('vanguard_stealth', newState.toString());
    if (newState) window.speechSynthesis.cancel(); // Kill any current audio
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
        } else if (signal.candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      }
    });
    return () => eventSource.close();
  }, []);

  // Load room number from Firestore if missing from localStorage
  useEffect(() => {
    const loadRoomFromFirestore = async () => {
      const email = auth.currentUser?.email || localStorage.getItem('userId');
      if (!email) return;
      if (localStorage.getItem('roomNumber')) return; // already set
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
          setIsVoiceActive(false);
          if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        } else if (status === 'PENDING' || status === 'ACKNOWLEDGED' || status === 'DISPATCHED') {
          setIsEmergencyActive(true);
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
    }
  }

  const handleSendSOS = async () => {
    setLoading(true);
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
      
      // 1. INSTANT BROADCAST: Write to Firestore immediately
      const alertDoc = await addDoc(collection(db, 'alerts'), {
        ...payload,
        aiThreatSeverity: "ANALYZING...",
        timestamp: Date.now()
      });

      setLatestStatus('PENDING');
      setMessage('TACTICAL SOS BROADCASTED');
      
      // 2. BACKGROUND CONNECTION: Get AI assessment without blocking
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
    }
    finally { setLoading(false); }
  }

  return (
    <div className={`fixed inset-0 bg-[#030303] flex flex-col items-center justify-center p-4 transition-all duration-700 overflow-hidden ${
      isEmergencyActive ? 'border-[8px] border-rose-600/20' : ''
    } ${isStealth ? 'brightness-[0.25] grayscale' : ''}`}>
      
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

      <div className="w-full h-full max-w-md flex flex-col justify-between relative z-10 py-4">
        
        {/* TOP STATUS BAR */}
        <div className="flex justify-between items-end mb-6 px-1">
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
          
          <div className={`tactical-glass rounded-3xl p-6 border transition-all duration-700 flex flex-col items-center justify-center gap-4 ${
            isEmergencyActive ? 'border-rose-500/30 bg-rose-500/5 shadow-[0_15px_40px_rgba(239,68,68,0.15)] animate-pulse-red' : 'border-white/5 bg-zinc-900/30'
          }`}>
            <div className="flex flex-col items-center gap-1">
              <p className="font-mono text-[8px] font-black uppercase text-zinc-500 tracking-[0.25em]">RESPONSE STAGE</p>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${latestStatus === 'ACKNOWLEDGED' ? 'bg-emerald-500 animate-pulse' : latestStatus === 'PENDING' ? 'bg-amber-500 animate-pulse' : 'bg-zinc-800'}`}></span>
                <p className={`font-display text-xl font-black tracking-wider uppercase ${
                  latestStatus === 'ACKNOWLEDGED' ? 'text-emerald-400' : latestStatus === 'PENDING' ? 'text-amber-400' : 'text-zinc-500'
                }`}>
                  {latestStatus || 'STANDBY'}
                </p>
              </div>
            </div>

            {aiSeverity && (
              <div className="w-full text-center py-2 px-3 bg-zinc-950/60 rounded-xl border border-white/5">
                <p className="font-mono text-[7px] font-black text-rose-400 uppercase tracking-widest mb-0.5">AI Severity Appraisal</p>
                <p className="text-xs font-semibold text-zinc-300 leading-tight italic">"{aiSeverity}"</p>
              </div>
            )}

            {isEmergencyActive && (
              <div className="w-full flex flex-col items-center pt-4 border-t border-white/5 mt-2">
                <div 
                  className="w-[2px] h-14 bg-gradient-to-t from-transparent to-emerald-400 rounded-full shadow-[0_0_20px_#10b981] transition-transform duration-1000" 
                  style={{ transform: `rotate(${heading || 0}deg)` }}
                ></div>
                <p className="font-display text-[9px] font-black text-emerald-400 mt-3 tracking-widest uppercase">SafePath: {nextWaypoint || 'Calculating Waypoints...'}</p>
              </div>
            )}
          </div>

          {/* Voice communications UI */}
          {isEmergencyActive && (
            <div className={`p-4 rounded-2xl border transition-all ${isVoiceActive ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-zinc-900/30 border-white/5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${isVoiceActive ? 'bg-emerald-500 animate-ping' : 'bg-zinc-700'}`}></div>
                  <div>
                    <p className="font-mono text-[9px] font-black uppercase tracking-widest text-white">Direct Mic Connection</p>
                    <p className="text-[8px] text-zinc-500 mt-0.5">{isVoiceActive ? 'Live streaming audio' : 'Channel offline'}</p>
                  </div>
                </div>
                <button 
                  onClick={isVoiceActive ? () => setIsVoiceActive(false) : startVoiceComms} 
                  className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    isVoiceActive ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  }`}
                >
                  {isVoiceActive ? 'Close Line' : 'Connect Mic'}
                </button>
              </div>
            </div>
          )}

          {/* Situation Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[8px] font-bold text-zinc-500 ml-1.5 uppercase tracking-widest">Situation Type</span>
              <div className="relative">
                <select 
                  value={contextType} 
                  onChange={(e) => setContextType(e.target.value)} 
                  className="w-full bg-zinc-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs font-black outline-none focus:border-rose-500/55 text-white appearance-none cursor-pointer"
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
                  className="w-5 h-5 accent-sky-500 rounded bg-zinc-950 border-white/10 cursor-pointer"
                  checked={isMobilityImpaired}
                  onChange={(e) => setIsMobilityImpaired(e.target.checked)}
                />
                <span className={`font-mono text-[10px] font-black uppercase tracking-widest ${isMobilityImpaired ? 'text-sky-400' : 'text-zinc-400'}`}>
                  ♿ I need an accessible route
                </span>
              </label>
            </div>
          </div>

          {/* Description Text */}
          <div className="flex-1 min-h-[120px] flex flex-col gap-1">
            <span className="font-mono text-[8px] font-bold text-zinc-500 ml-1.5 uppercase tracking-widest">Optional Details</span>
            <textarea 
              value={sosMessage} 
              onChange={(e) => setSosMessage(e.target.value)} 
              placeholder="DESCRIBE SITUATION SPECIFICS (OPTIONAL)..." 
              className="w-full flex-1 bg-zinc-950/60 border border-white/10 rounded-3xl px-5 py-4 text-xs font-medium outline-none focus:border-rose-500/55 text-white placeholder:text-zinc-800 resize-none transition"
            />
          </div>

          {/* SOS Transmission button */}
          <div className="mt-2">
            <button 
              onClick={handleSendSOS} 
              disabled={loading} 
              className={`w-full py-5 rounded-2xl font-display font-black text-lg tracking-[0.25em] uppercase transition-all active:scale-[0.98] cursor-pointer ${
                loading 
                  ? 'bg-zinc-800 text-zinc-500' 
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_4px_30px_rgba(239,68,68,0.25)]'
              }`}
            >
              {loading ? 'Transmitting Alert...' : 'Initiate SOS Request'}
            </button>
          </div>
        </div>

        {/* FEEDBACK logs */}
        <div className="h-6 flex flex-col items-center justify-center my-2">
          {message && <p className="font-mono text-[8px] font-black text-emerald-400 uppercase tracking-[0.2em] animate-pulse">{message}</p>}
          {error && <p className="font-mono text-[8px] font-black text-rose-500 uppercase tracking-[0.2em] animate-pulse">{error}</p>}
        </div>

        <audio id="remote-audio" autoPlay />

        {/* BOTTOM ACTIONS FOOTER */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          <button 
            onClick={() => setShowMap(!showMap)} 
            className="py-3 px-4 bg-zinc-950 border border-white/5 rounded-xl font-display text-[9px] font-black uppercase text-zinc-400 tracking-widest hover:text-white hover:bg-white/5 hover:border-white/10 transition-colors cursor-pointer text-center"
          >
            Evac Map
          </button>
          <button 
            onClick={() => {
              localStorage.clear();
              navigate('/login');
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