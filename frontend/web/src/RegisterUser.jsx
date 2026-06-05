import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

function RegisterUser() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    roomNumber: '',
    hotelId: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // --- LOGIN FLOW ---
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        
        // Save the token for the session
        localStorage.setItem('token', user.accessToken);
        localStorage.setItem('role', 'GUEST');
        localStorage.setItem('hotelId', formData.hotelId);
        localStorage.setItem('roomNumber', formData.roomNumber || 'R301');
        localStorage.setItem('userId', formData.email);
        
        await setDoc(doc(db, "customers", formData.email), {
          name: formData.name,
          hotelId: formData.hotelId,
          roomNumber: formData.roomNumber,
          password: formData.password, // Added for demo visibility in Firebase
          status: 'ACTIVE'
        });

        // CONNECTED: Redirect to your SOS page
        navigate('/sos');
        
      } else {
        // --- SIGNUP FLOW ---
        await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        // Write the metadata to Firestore directly during creation
        await setDoc(doc(db, "customers", formData.email), {
          name: formData.name,
          hotelId: formData.hotelId,
          roomNumber: formData.roomNumber,
          password: formData.password, // Added for demo visibility in Firebase
          status: 'ACTIVE'
        });

        localStorage.setItem('roomNumber', formData.roomNumber || 'R301');
        localStorage.setItem('userId', formData.email);

        setIsLogin(true);
        alert('Tactical ID Created. Please authorize to enter.');
      }
    } catch (err) {
      setError(err.message || 'Authorization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col md:flex-row bg-[#030303] overflow-hidden">
      {/* 50% LEFT PANEL: GUEST FEATURES & DECORATION (AdaptFit Split Screen Style) */}
      <div className="relative w-full md:w-1/2 flex flex-col justify-between p-8 md:p-16 border-b md:border-b-0 md:border-r border-white/5 bg-[#050508]/60 overflow-hidden">
        {/* Background Grid */}
        <div className="cyber-grid absolute inset-0"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-rose-500/10 blur-[80px] pointer-events-none"></div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2">
          <span className="text-2xl shadow-[0_0_15px_rgba(239,68,68,0.3)]">🛡️</span>
          <span className="font-display text-lg font-black tracking-[0.2em] text-white">VANGUARD</span>
          <span className="rounded-full border border-rose-500/20 bg-rose-500/5 px-2 py-0.5 text-[8px] font-extrabold tracking-widest text-rose-400">GUEST LINK</span>
        </div>

        {/* Features Content */}
        <div className="relative z-10 my-12 md:my-auto max-w-md">
          <h2 className="font-display text-3xl md:text-4xl font-black text-white tracking-tight leading-tight mb-6">
            Secure evac coordination <br />
            <span className="gradient-text-rose font-black">straight to your device.</span>
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed mb-8">
            Access Vanguard's secure guest portal to link directly with local facility command centres. In case of an emergency, receive dynamic routing maps and talk live with responders.
          </p>

          {/* List of Features */}
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 font-bold text-xs">01</div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Live voice channel</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">Stream direct audio feeds to first responders via high-reliability WebRTC.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 font-bold text-xs">02</div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Evacuation vector radar</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">Automated real-time pathfinding routes you away from detected threats and fire hazards.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 font-bold text-xs">03</div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI threat assessment</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">Instant triage analyses hazard priority, routing rescue operations to high-vulnerability rooms first.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center gap-2 text-[8px] font-black tracking-[0.2em] text-zinc-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          SECURE SATELLITE LINK ACTIVE
        </div>
      </div>

      {/* 50% RIGHT PANEL: AUTHENTICATION FORM CONTAINER (AdaptFit Split Screen Form Style) */}
      <div className="relative w-full md:w-1/2 flex items-center justify-center p-8 md:p-16">
        <div className="absolute top-[20%] right-[-10%] w-[350px] h-[350px] rounded-full bg-rose-600/5 blur-[90px] pointer-events-none"></div>

        <div className="relative w-full max-w-sm rounded-3xl border border-white/5 bg-zinc-900/35 p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-md">
          {/* Header */}
          <div className="mb-6">
            <h1 className="font-display text-2xl font-black tracking-tight text-white uppercase">
              {isLogin ? 'GUEST AUTHORIZATION' : 'TACTICAL REGISTRATION'}
            </h1>
            <p className="mt-1 text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
              {isLogin ? 'Enter active security codes' : 'Establish new guest node credentials'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Full Name</label>
              <input
                type="text"
                name="name"
                placeholder="e.g. John Doe"
                required
                className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-2.5 text-zinc-200 outline-none transition focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 text-xs font-semibold placeholder:text-zinc-700"
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Hotel ID</label>
                <input
                  type="text"
                  name="hotelId"
                  placeholder="e.g. taj01"
                  required
                  className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-2.5 text-zinc-200 outline-none transition focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 text-xs font-semibold placeholder:text-zinc-700"
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Room Number</label>
                <input
                  type="text"
                  name="roomNumber"
                  placeholder="e.g. 301"
                  required
                  className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-2.5 text-zinc-200 outline-none transition focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 text-xs font-semibold placeholder:text-zinc-700"
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="guest@domain.com"
                required
                className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-2.5 text-zinc-200 outline-none transition focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 text-xs font-semibold placeholder:text-zinc-700"
                onChange={handleChange}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Secure Passcode</label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-2.5 text-zinc-200 outline-none transition focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 text-xs font-semibold placeholder:text-zinc-700"
                onChange={handleChange}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-center text-[10px] font-bold text-rose-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-xl bg-rose-600 py-3.5 text-xs font-black tracking-widest text-white transition hover:bg-rose-500 disabled:opacity-50 cursor-pointer shadow-[0_4px_20px_rgba(239,68,68,0.25)]"
            >
              <span className="relative z-10">
                {loading ? 'PROCESSING...' : isLogin ? 'AUTHORIZE ACCESS' : 'INITIALIZE ID'}
              </span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            </button>
          </form>

          {/* Links */}
          <div className="mt-8 text-center space-y-3.5">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="block w-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition hover:text-rose-400 cursor-pointer"
            >
              {isLogin ? "Request New Guest Code" : "Return to login"}
            </button>
            <button
              onClick={() => navigate('/')}
              className="block w-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition hover:text-rose-400 cursor-pointer"
            >
              Return to main gateway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterUser;