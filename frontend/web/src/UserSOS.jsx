import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyLatestAlert, getSafeHeading, logout, sendAlert, sendSignal } from './api';
import HotelMapSystem from './HotelMap';
import { db } from './firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

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
      const hData = await getSafeHeading('R301', null, vulnerability);
      setHeading(hData.data.heading);
      setNextWaypoint(hData.data.nextWaypoint);
      setEstimatedTime(hData.data.estimatedTimeSeconds);
      
      if (vulnerability === 'VISION' && nextWaypoint) {
        speakInstruction(`Warning. Proceed towards ${nextWaypoint}. Time to safety is ${Math.floor(hData.data.estimatedTimeSeconds / 60)} minutes.`);
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
  }, [isEmergencyActive])

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
      setError('VOICE UPLINK FAILED: ' + err.message);
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
        roomNumber: 'R301',
        floor: '3rd Floor',
        emergencyType: contextType,
        message: sosMessage || `EMERGENCY: ${contextType} situation at Room R301.`,
        vulnerabilityProfile: vulnerability,
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
      
      // 2. BACKGROUND UPLINK: Get AI assessment without blocking
      sendAlert(payload).then(resp => {
        const aiSeverity = resp.data.aiThreatSeverity;
        setAiSeverity(aiSeverity);
        updateDoc(doc(db, 'alerts', alertDoc.id), { aiThreatSeverity: aiSeverity });
      }).catch(err => {
        console.warn("AI Uplink Failed");
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
    <div className={`fixed inset-0 bg-black flex flex-col items-center justify-center p-4 hud-font overflow-hidden selection:bg-rose-500/30 transition-all duration-700 ${
      isEmergencyActive ? 'border-[8px] border-rose-600/20' : ''
    } ${isStealth ? 'brightness-[0.25] grayscale' : ''}`}>
      {showMap && (
        <div className="fixed inset-0 z-[200] overflow-hidden bg-black animate-fadeIn">
          <HotelMapSystem onClose={() => setShowMap(false)} />
        </div>
      )}

      <div className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none ${isEmergencyActive ? 'opacity-40' : 'opacity-10'}`}>
        <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${isEmergencyActive ? 'from-rose-900/60' : 'from-zinc-900'} via-black to-black`}></div>
        {isEmergencyActive && <div className="absolute inset-0 scanline-container opacity-30"></div>}
      </div>

      <div className="w-full h-full max-w-lg flex flex-col relative z-10">
        <div className="flex justify-between items-end mb-6 px-2">
            <div className="flex flex-col">
                <h2 className="text-3xl font-black tracking-tighter leading-none mb-1">VANGUARD <span className="text-rose-500 font-black">SOS</span></h2>
                <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isLanActive ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-rose-600 shadow-[0_0_8px_#e11d48]'}`}></span>
                    <span className="text-[10px] font-black tracking-[0.3em] text-zinc-500 uppercase">{isLanActive ? 'Satellite/Mesh Link: Active' : 'Offline Mode Enabled'}</span>
                </div>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
                <span className="text-xl font-black text-white/40 leading-none">{clock}</span>
                <button 
                  onClick={toggleStealth}
                  className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${
                    isStealth ? 'bg-rose-600 text-white animate-pulse' : 'bg-white/5 text-white/30 border border-white/10'
                  }`}
                >
                  {isStealth ? 'Stealth: ON' : 'Stealth: OFF'}
                </button>
            </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className={`tactical-glass rounded-[2rem] p-6 border transition-all duration-700 flex flex-col items-center justify-center gap-4 ${
                isEmergencyActive ? 'border-rose-500/50 bg-rose-500/10 shadow-[0_0_40px_rgba(244,63,94,0.2)]' : 'border-white/5 bg-white/2'
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

                {aiSeverity && (
                  <div className="mt-2 p-3 bg-black/40 rounded-xl border border-white/10 w-full">
                    <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">AI Threat Assessment</p>
                    <p className="text-[11px] font-bold text-white leading-tight italic">"{aiSeverity}"</p>
                  </div>
                )}

                {isEmergencyActive && (
                    <div className="w-full flex flex-col items-center pt-4 border-t border-white/5 mt-4">
                        <div className="w-2 h-16 bg-emerald-500 rounded-full shadow-[0_0_25px_#10b981] animate-pulse transition-transform duration-1000" style={{ transform: `rotate(${heading || 0}deg)` }}></div>
                        <p className="text-[10px] font-black text-emerald-400 mt-4 tracking-[0.3em] uppercase">SafePath: {nextWaypoint || 'Calculating...'}</p>
                    </div>
                )}
            </div>

            {isEmergencyActive && (
              <div className={`p-4 rounded-3xl border transition-all ${isVoiceActive ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-zinc-900 border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isVoiceActive ? 'bg-emerald-500 animate-ping' : 'bg-zinc-700'}`}></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white">Live Voice Channel</p>
                  </div>
                  <button onClick={isVoiceActive ? () => setIsVoiceActive(false) : startVoiceComms} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isVoiceActive ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'}`}>
                    {isVoiceActive ? 'End Call' : 'Open Mic'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black text-zinc-600 ml-2 uppercase tracking-widest">Type</span>
                    <select value={contextType} onChange={(e) => setContextType(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black outline-none focus:border-rose-500 text-white appearance-none">
                        <option value="GENERAL">GENERAL</option>
                        <option value="FIRE">FIRE / SMOKE</option>
                        <option value="THREAT">INTRUDER / WEAPON</option>
                        <option value="MEDICAL">MEDICAL</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black text-zinc-600 ml-2 uppercase tracking-widest">Accessibility</span>
                    <select value={vulnerability} onChange={(e) => setVulnerability(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black outline-none focus:border-rose-500 text-white appearance-none">
                        <option value="NONE">STANDARD</option>
                        <option value="WHEELCHAIR">WHEELCHAIR</option>
                        <option value="VISION">VISION AID</option>
                        <option value="HEARING">HAPTIC/TEXT</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 min-h-[100px] relative">
                <textarea value={sosMessage} onChange={(e) => setSosMessage(e.target.value)} placeholder="DESCRIBE SITUATION (OPTIONAL)..." className="w-full h-full bg-zinc-950/50 border border-white/10 rounded-3xl px-6 py-6 text-sm font-medium outline-none focus:border-rose-500 text-white placeholder:text-zinc-800 resize-none shadow-inner" />
            </div>

            <div className="relative group">
                <button onClick={handleSendSOS} disabled={loading} className={`w-full py-7 rounded-[2.5rem] font-black text-2xl tracking-[0.4em] uppercase transition-all active:scale-[0.97] shadow-2xl relative overflow-hidden ${loading ? 'bg-zinc-800 text-zinc-500' : 'bg-rose-600 text-white active:bg-rose-700'}`}>
                    {loading ? 'Transmitting...' : 'Initiate SOS'}
                </button>
            </div>
        </div>

        <div className="h-4 mt-2 flex flex-col items-center gap-1">
            {message && <p className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.5em] animate-pulse">{message}</p>}
            {error && <p className="text-[8px] font-black text-rose-500 uppercase tracking-[0.5em] animate-pulse">{error}</p>}
        </div>

        <div className="h-4 mt-2 flex flex-col items-center gap-1">
            {message && <p className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.5em] animate-pulse">{message}</p>}
            {error && <p className="text-[8px] font-black text-rose-500 uppercase tracking-[0.5em] animate-pulse">{error}</p>}
        </div>

        <div className="h-4 mt-2 flex flex-col items-center gap-1">
            {message && <p className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.5em] animate-pulse">{message}</p>}
            {error && <p className="text-[8px] font-black text-rose-500 uppercase tracking-[0.5em] animate-pulse">{error}</p>}
        </div>

        <audio id="remote-audio" autoPlay />

        <div className="grid grid-cols-2 gap-4 mt-4 pb-2">
            <button onClick={() => setShowMap(!showMap)} className="py-4 px-4 bg-zinc-950 border border-white/5 rounded-[1.5rem] text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] active:bg-zinc-900 transition-colors">Tactical Map</button>
            <button onClick={() => navigate('/login')} className="py-4 px-4 bg-zinc-950 border border-white/5 rounded-[1.5rem] text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] active:bg-zinc-900 transition-colors">Log Exit</button>
        </div>
      </div>
    </div>
  );
}

export default UserSOS;