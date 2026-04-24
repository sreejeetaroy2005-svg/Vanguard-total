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
    <div style={s.page}>
      <div style={s.gridOverlay}></div>
      <div style={s.card}>
        <div style={s.header}>
          <div style={{fontSize: '40px'}}>🏨</div>
          <h1 style={s.logo}>HOTEL <span style={{color: '#fff'}}>LOGIN</span></h1>
          <p style={s.tagline}>ADMINISTRATOR UPLINK</p>
        </div>

        <form onSubmit={handleLogin} style={s.form}>
          <div style={s.inputGroup}>
            <label style={s.label}>UNIQUE HOTEL ID</label>
            <input 
              required placeholder="e.g. taj01" style={s.input} 
              onChange={e => setFormData({...formData, hotelId: e.target.value})} 
            />
          </div>

          <div style={s.inputGroup}>
            <label style={s.label}>ADMIN PASSCODE</label>
            <input 
              required type="password" placeholder="••••••••" style={s.input} 
              onChange={e => setFormData({...formData, password: e.target.value})} 
            />
          </div>

          <button style={s.btn} disabled={loading}>
            {loading ? "AUTHORIZING..." : "ENTER DASHBOARD"}
          </button>
        </form>

        <p onClick={() => navigate('/register')} style={s.footerLink}>
          Need to register a new facility? INITIALIZE HERE
        </p>
        <p onClick={() => navigate('/')} style={{...s.footerLink, marginTop: '10px'}}>
          RETURN TO MAIN GATEWAY
        </p>
      </div>
    </div>
  );
}

const s = {
  page: { height: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', position: 'relative', overflow: 'hidden' },
  gridOverlay: { position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(14, 165, 233, 0.1) 1px, transparent 1px)', backgroundSize: '30px 30px' },
  card: { width: '420px', background: 'rgba(10, 10, 10, 0.9)', padding: '40px', border: '1px solid #111', borderTop: '4px solid #0ea5e9', borderRadius: '8px', textAlign: 'center', position: 'relative', zIndex: 1, backdropFilter: 'blur(10px)', boxShadow: '0 0 40px rgba(0,0,0,0.5)' },
  header: { marginBottom: '30px' },
  logo: { color: '#0ea5e9', letterSpacing: '4px', fontSize: '24px', margin: '10px 0' },
  tagline: { fontSize: '10px', color: '#666', letterSpacing: '2px' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '9px', color: '#0ea5e9', fontWeight: 'bold' },
  input: { background: '#111', border: '1px solid #333', padding: '12px', color: '#fff', outline: 'none', borderRadius: '4px', fontSize: '13px' },
  btn: { background: '#0ea5e9', color: '#fff', border: 'none', padding: '15px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', letterSpacing: '2px', transition: 'opacity 0.2s' },
  footerLink: { marginTop: '25px', color: '#555', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', transition: 'color 0.2s' }
};
