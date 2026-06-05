import React, { useState } from 'react';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [formData, setFormData] = useState({ 
    hotelName: '', 
    hotelId: '', 
    email: '', 
    password: '', 
    mapUrl: '' 
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Safety check for empty Hotel ID
    const hId = formData.hotelId.trim().toLowerCase();
    if (!hId) {
      alert("CRITICAL: Hotel ID is required for database indexing.");
      return;
    }

    setLoading(true);
    try {
      // Saving to the 'hotels' collection using the Hotel ID as the Document Name
      await setDoc(doc(db, "hotels", hId), {
        hotelName: formData.hotelName.trim(),
        hotelId: hId,
        email: formData.email.trim(),
        password: formData.password, // Set by user
        mapUrl: formData.mapUrl.trim(),
        createdAt: new Date().toISOString()
      });

      alert("FACILITY REGISTERED SUCCESSFULY // ID: " + hId.toUpperCase());
      navigate('/'); // Go back to Main Gateway
    } catch (err) {
      console.error(err);
      alert("REGISTRATION FAILED: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#030303] p-4 overflow-hidden">
      {/* Visual Effects */}
      <div className="cyber-grid absolute inset-0"></div>
      <div className="absolute top-[20%] right-[20%] w-[400px] h-[400px] rounded-full bg-rose-500/5 blur-[100px] pointer-events-none"></div>

      <div className="relative w-full max-w-md rounded-3xl border border-white/5 bg-zinc-900/35 p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all">
        {/* Top Accent Strip */}
        <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-rose-500 to-amber-500 rounded-t-3xl"></div>

        {/* Header Section */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-3xl shadow-[0_0_15px_rgba(239,68,68,0.15)]">
            🏨
          </div>
          <h1 className="font-display text-2xl font-black tracking-wider text-white uppercase">
            VANGUARD <span className="text-rose-500">ADMIN</span>
          </h1>
          <p className="mt-1.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
            Facility Registration Protocol
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
              Official Hotel Name
            </label>
            <input 
              required 
              placeholder="e.g. Hotel Taj" 
              className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-zinc-200 outline-none transition focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 placeholder:text-zinc-700 text-xs font-semibold"
              onChange={e => setFormData({...formData, hotelName: e.target.value})} 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
              Unique Hotel ID (For Guest Link)
            </label>
            <input 
              required 
              placeholder="e.g. taj01" 
              className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-zinc-200 outline-none transition focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 placeholder:text-zinc-700 text-xs font-semibold"
              onChange={e => setFormData({...formData, hotelId: e.target.value})} 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
              Admin Email
            </label>
            <input 
              required 
              type="email" 
              placeholder="admin@vanguard.com" 
              className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-zinc-200 outline-none transition focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 placeholder:text-zinc-700 text-xs font-semibold"
              onChange={e => setFormData({...formData, email: e.target.value})} 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
              Admin Passcode
            </label>
            <input 
              required 
              type="password" 
              placeholder="••••••••" 
              className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-zinc-200 outline-none transition focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 placeholder:text-zinc-700 text-xs font-semibold"
              onChange={e => setFormData({...formData, password: e.target.value})} 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
              Tactical Map Image URL
            </label>
            <input 
              required 
              placeholder="https://i.ibb.co/.../map.jpg" 
              className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-zinc-200 outline-none transition focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 placeholder:text-zinc-700 text-xs font-semibold"
              onChange={e => setFormData({...formData, mapUrl: e.target.value})} 
            />
            <p className="text-[9px] text-zinc-600 font-semibold leading-relaxed">
              *Upload to postimages.org and paste the "Direct Link" here.
            </p>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="group relative w-full overflow-hidden rounded-xl bg-rose-600 py-3.5 text-xs font-black tracking-widest text-white transition hover:bg-rose-500 disabled:opacity-50 cursor-pointer shadow-[0_4px_20px_rgba(239,68,68,0.25)]"
          >
            <span className="relative z-10">
              {loading ? "SYNCHRONIZING..." : "REGISTER FACILITY"}
            </span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="mt-8 text-center">
          <button 
            onClick={() => navigate('/')} 
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition hover:text-rose-400 cursor-pointer"
          >
            Return to main gateway
          </button>
        </div>
      </div>
    </div>
  );
}