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
        password: formData.password, // For demo simplicity
        mapUrl: formData.mapUrl.trim(),
        createdAt: new Date().toISOString()
      });

      alert("FACILITY REGISTERED SUCCESSFULY // ID: " + hId.toUpperCase());
      navigate('/'); // Go back to Main Gateway
    } catch (err) {
      console.error(err);
      alert("UPLINK FAILED: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={s.page}>
      {/* Background Grid Decoration */}
      <div style={s.gridOverlay}></div>

      <div style={s.card}>
        <div style={s.header}>
          <div style={{fontSize: '40px'}}>🏨</div>
          <h1 style={s.logo}>VANGUARD <span style={{color: '#fff'}}>ADMIN</span></h1>
          <p style={s.tagline}>FACILITY REGISTRATION PROTOCOL</p>
        </div>

        <form onSubmit={handleRegister} style={s.form}>
          <div style={s.inputGroup}>
            <label style={s.label}>OFFICIAL HOTEL NAME</label>
            <input 
              required placeholder="e.g. Hotel Taj" style={s.input} 
              onChange={e => setFormData({...formData, hotelName: e.target.value})} 
            />
          </div>

          <div style={s.inputGroup}>
            <label style={s.label}>UNIQUE HOTEL ID (FOR GUEST UPLINK)</label>
            <input 
              required placeholder="e.g. taj01" style={s.input} 
              onChange={e => setFormData({...formData, hotelId: e.target.value})} 
            />
          </div>

          <div style={s.inputGroup}>
            <label style={s.label}>ADMIN EMAIL</label>
            <input 
              required type="email" placeholder="admin@vanguard.com" style={s.input} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
            />
          </div>

          <div style={s.inputGroup}>
            <label style={s.label}>TACTICAL MAP IMAGE URL</label>
            <input 
              required placeholder="https://i.ibb.co/.../map.jpg" style={s.input} 
              onChange={e => setFormData({...formData, mapUrl: e.target.value})} 
            />
            <p style={{fontSize: '9px', color: '#555', marginTop: '5px'}}>
              *Upload to PostImages.org and paste the "Direct Link" here.
            </p>
          </div>

          <button style={s.btn} disabled={loading}>
            {loading ? "SYNCHRONIZING..." : "REGISTER FACILITY"}
          </button>
        </form>

        <p  onClick={() => navigate('/')} style={s.footerLink}>
          RETURN TO MAIN GATEWAY
        </p>
      </div>
    </div>
  );
}

const s = {
  page: { 
    height: '100vh', 
    background: '#050505', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    fontFamily: 'monospace',
    position: 'relative',
    overflow: 'hidden'
  },
  gridOverlay: { 
    position: 'absolute', 
    inset: 0, 
    backgroundImage: 'radial-gradient(rgba(225, 29, 72, 0.1) 1px, transparent 1px)', 
    backgroundSize: '30px 30px' 
  },
  card: { 
    width: '420px', 
    background: 'rgba(10, 10, 10, 0.9)', 
    padding: '40px', 
    border: '1px solid #222', 
    borderRadius: '8px', 
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
    backdropFilter: 'blur(10px)',
    boxShadow: '0 0 40px rgba(0,0,0,0.5)'
  },
  header: { marginBottom: '30px' },
  logo: { color: '#e11d48', letterSpacing: '4px', fontSize: '24px', margin: '10px 0' },
  tagline: { fontSize: '10px', color: '#666', letterSpacing: '2px' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '9px', color: '#e11d48', fontWeight: 'bold' },
  input: { 
    background: '#111', 
    border: '1px solid #333', 
    padding: '12px', 
    color: '#fff', 
    outline: 'none', 
    borderRadius: '4px',
    fontSize: '13px'
  },
  btn: { 
    background: '#e11d48', 
    color: '#fff', 
    border: 'none', 
    padding: '15px', 
    fontWeight: 'bold', 
    cursor: 'pointer', 
    marginTop: '10px',
    letterSpacing: '2px',
    transition: 'opacity 0.2s'
  },
  footerLink: { 
    marginTop: '25px', 
    color: '#444', 
    fontSize: '11px', 
    cursor: 'pointer', 
    textDecoration: 'underline' 
  }
};