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
    roomNumber: ''
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
        
        await setDoc(doc(db, "customers", formData.email), {
          name: formData.name,
          hotelId: formData.roomNumber,
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
          hotelId: formData.roomNumber,
          roomNumber: formData.roomNumber,
          password: formData.password, // Added for demo visibility in Firebase
          status: 'ACTIVE'
        });

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
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      {/* Red ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.1),transparent_70%)]" />

      <div className="relative w-full max-w-md rounded-[2.5rem] border border-zinc-800 bg-zinc-900/40 p-10 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-rose-600" />
          <h1 className="text-3xl font-black tracking-tight text-zinc-100 uppercase">
            {isLogin ? 'Guest Login' : 'Guest Signup'}
          </h1>
          <p className="mt-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
            Emergency Protocol System
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-500">Full Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="John Doe"
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-zinc-200 outline-none transition focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20"
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-500">Room Assignment</label>
                <input
                  type="text"
                  name="roomNumber"
                  placeholder="e.g. 402"
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-zinc-200 outline-none transition focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20"
                  onChange={handleChange}
                />
              </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Email Identifier</label>
            <input
              type="email"
              name="email"
              placeholder="user@gateway.local"
              required
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-zinc-200 outline-none transition focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20"
              onChange={handleChange}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Secure Passcode</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              required
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-zinc-200 outline-none transition focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20"
              onChange={handleChange}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/10 p-2 text-center text-xs font-bold text-rose-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full overflow-hidden rounded-2xl bg-rose-600 py-4 font-black tracking-widest text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            <span className="relative z-10">
              {loading ? 'PROCESSING...' : isLogin ? 'AUTHORIZE ACCESS' : 'INITIALIZE ID'}
            </span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 transition hover:text-rose-400"
          >
            {isLogin ? "Generate New Tactical ID" : "Return to Authorization"}
          </button>
        </div>
      </div>
      
      {/* Bottom status indicator */}
      <div className="absolute bottom-6 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-zinc-600">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        SECURE GATEWAY ENCRYPTION ACTIVE
      </div>
    </div>
  );
}

export default RegisterUser;