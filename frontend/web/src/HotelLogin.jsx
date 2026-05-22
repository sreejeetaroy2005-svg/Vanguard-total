import React, { useState } from 'react';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function HotelLogin() {
  const [formData, setFormData] = useState({ hotelId: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const hId = formData.hotelId.trim().toLowerCase();
    if (!hId) return;

    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "hotels", hId));
      if (!snap.exists()) {
        throw new Error("Facility Not Found");
      }
      const data = snap.data();
      if (data.password !== formData.password) {
        throw new Error("Invalid Tactical Password");
      }

      // Success
      localStorage.setItem('token', 'hotel_admin_token_' + hId);
      localStorage.setItem('role', 'ADMIN');
      localStorage.setItem('hotelId', hId);
      
      navigate('/dashboard');
    } catch (err) {
      alert("AUTHORIZATION FAILED: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#030303] p-4 overflow-hidden">
      {/* Visual Effects */}
      <div className="cyber-grid absolute inset-0"></div>
      <div className="absolute top-[20%] left-[20%] w-[400px] h-[400px] rounded-full bg-sky-500/10 blur-[100px] pointer-events-none"></div>

      <div className="relative w-full max-w-md rounded-3xl border border-white/5 bg-zinc-900/35 p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all">
        {/* Top Accent Strip */}
        <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-sky-500 to-indigo-500 rounded-t-3xl"></div>

        {/* Header Section */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-3xl shadow-[0_0_15px_rgba(14,165,233,0.15)]">
            🏨
          </div>
          <h1 className="font-display text-2xl font-black tracking-wider text-white uppercase">
            HOTEL <span className="text-sky-500">LOGIN</span>
          </h1>
          <p className="mt-1.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
            Administrator Gateway Protocol
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
              Unique Hotel ID
            </label>
            <div className="relative">
              <input 
                required 
                placeholder="e.g. taj01" 
                className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-zinc-200 outline-none transition focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 placeholder:text-zinc-700 text-xs font-semibold"
                onChange={e => setFormData({...formData, hotelId: e.target.value})} 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
              Admin Passcode
            </label>
            <div className="relative">
              <input 
                required 
                type="password" 
                placeholder="••••••••" 
                className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-zinc-200 outline-none transition focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 placeholder:text-zinc-700 text-xs font-semibold"
                onChange={e => setFormData({...formData, password: e.target.value})} 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="group relative w-full overflow-hidden rounded-xl bg-sky-600 py-3.5 text-xs font-black tracking-widest text-white transition hover:bg-sky-500 disabled:opacity-50 cursor-pointer shadow-[0_4px_20px_rgba(14,165,233,0.2)]"
          >
            <span className="relative z-10">
              {loading ? "AUTHORIZING..." : "ENTER TACTICAL HUD"}
            </span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="mt-8 space-y-3.5 text-center">
          <button 
            onClick={() => navigate('/register')} 
            className="block w-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition hover:text-sky-400 cursor-pointer"
          >
            Register new facility // Uplink index
          </button>
          <button 
            onClick={() => navigate('/')} 
            className="block w-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition hover:text-sky-400 cursor-pointer"
          >
            Return to main gateway
          </button>
        </div>
      </div>
    </div>
  );
}
