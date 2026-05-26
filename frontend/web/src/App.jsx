import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

import MainPage from './MainPage';       
import Register from './Register';       // Hotel Admin
import RegisterUser from './RegisterUser'; // Guest Signup/Login
import Dashboard from './Dashboard';     
import UserSOS from './UserSOS';         // The Emergency SOS Component
import HotelLogin from './HotelLogin';

function BroadcastOverlay({ message, onClose }) {
  const [isMuted, setIsMuted] = useState(false);
  const location = useLocation();
  const isAdminPage = location.pathname === '/dashboard' || location.pathname === '/register';

  const handleMute = () => {
    window.speechSynthesis.cancel();
    setIsMuted(true);
  };

  const handleClose = () => {
    window.speechSynthesis.cancel();
    onClose();
  };

  if (!message || isAdminPage) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-8 animate-fadeIn">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#e11d4822_0%,_transparent_70%)] animate-pulse"></div>
      <div className="absolute inset-0 scanline-container opacity-20"></div>
      
      <div className="absolute top-10 right-10 flex gap-4">
        <button 
          onClick={handleMute}
          className={`w-12 h-12 rounded-full border flex items-center justify-center text-xl transition-all active:scale-90 ${
            isMuted ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-rose-600/20 border-rose-500/50 text-rose-500'
          }`}
          title={isMuted ? "Muted" : "Mute Voice"}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        <button 
          onClick={handleClose}
          className="w-12 h-12 rounded-full border border-rose-500/50 flex items-center justify-center text-rose-500 text-2xl font-bold hover:bg-rose-500 hover:text-white transition-all active:scale-90"
        >
          ✕
        </button>
      </div>

      <div className="relative text-center">
        <div className="mb-6 inline-block px-6 py-2 border-2 border-rose-600 bg-rose-600/10 rounded-full animate-bounce">
          <span className="text-rose-500 font-black tracking-[0.6em] text-sm uppercase">Priority Broadcast</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-8 leading-none">
          Tactical <span className="text-rose-600">Command</span>
        </h1>
        <div className="p-8 tactical-glass border border-rose-500/30 rounded-[3rem] shadow-[0_0_50px_rgba(225,29,72,0.2)]">
          <p className="text-2xl md:text-4xl font-bold text-white tracking-tight leading-snug">
            "{message}"
          </p>
        </div>
        <p className="mt-12 text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] animate-pulse">
          Message Authenticated by Vanguard Central GDC
        </p>
      </div>
    </div>
  );
}

function App() {
  const [broadcastMsg, setBroadcastMsg] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const latest = snapshot.docs[0].data();
        // Show if message is within the last 10 minutes
        if (Date.now() - latest.timestamp < 600000) {
          setBroadcastMsg(latest.message);
          
          // Check for Stealth Mode / Mute before playing audio
          const isStealth = localStorage.getItem('vanguard_stealth') === 'true';
          if (!isStealth) {
            const utterance = new SpeechSynthesisUtterance("Incoming Tactical Command: " + latest.message);
            window.speechSynthesis.speak(utterance);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <div className="App relative">
        <BroadcastOverlay message={broadcastMsg} onClose={() => setBroadcastMsg('')} />

        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<HotelLogin />} />
          <Route path="/signup" element={<RegisterUser />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sos" element={<UserSOS />} />
          <Route path="*" element={<MainPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;