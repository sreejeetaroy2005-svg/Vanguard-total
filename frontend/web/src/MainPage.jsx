import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MainPage() {
  const navigate = useNavigate();

  return (
    <div style={s.container}>
      {/* Visual Effects */}
      <div style={s.gridOverlay}></div>
      <div className="scanline"></div>

      <div style={s.content}>
        <div style={s.header}>
          <div style={{fontSize: '60px', marginBottom: '10px'}}>🛡️</div>
          <h1 style={s.logo}>VANGUARD</h1>
          <p style={s.tagline}>GLOBAL DEFENSE & COORDINATION GATEWAY</p>
        </div>

        <div style={s.cardContainer}>
          {/* HOTEL ADMINISTRATION PORTAL */}
          <div 
            className="v-card" 
            style={s.card} 
            onClick={() => navigate('/login')}
          >
            <div style={{fontSize: '45px', marginBottom: '15px'}}>🏨</div>
            <h2 style={s.cardTitle}>HOTEL LOGIN</h2>
            <p style={s.cardDesc}>
              Facility management uplink. Upload blueprints, define sectors, and initialize GDC protocols.
            </p>
            <div style={s.actionBtn}>ADMIN UPLINK</div>
          </div>

          {/* GUEST / USER PORTAL */}
          <div 
            className="v-card" 
            style={{...s.card, borderBottom: '4px solid #0ea5e9'}} 
            onClick={() => navigate('/signup')}
          >
            <div style={{fontSize: '45px', marginBottom: '15px'}}>👤</div>
            <h2 style={s.cardTitle}>USER LOGIN</h2>
            <p style={s.cardDesc}>
              Guest tactical access. Retrieve evacuation vectors, SOS triage, and P2P mesh connectivity.
            </p>
            <div style={{...s.actionBtn, borderColor: '#0ea5e9', color: '#0ea5e9'}}>GUEST UPLINK</div>
          </div>
        </div>

        <div style={s.footer}>
          <div style={s.statusDot}></div>
          <span>ENCRYPTED MESH NETWORK ACTIVE // NODE: BENGALURU_GDC_MAIN</span>
        </div>
      </div>

      {/* Internal CSS for Animations */}
      <style>{`
        .v-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .v-card:hover {
          background: rgba(25, 25, 25, 0.9) !important;
          transform: translateY(-8px);
          border-color: #e11d48 !important;
          box-shadow: 0 15px 40px rgba(225, 29, 72, 0.15);
        }
        .scanline {
          width: 100%;
          height: 2px;
          background: rgba(225, 29, 72, 0.1);
          position: absolute;
          top: 0;
          left: 0;
          z-index: 2;
          animation: scan 4s linear infinite;
        }
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
}

const s = {
  container: { 
    height: '100vh', 
    background: '#050505', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    color: '#fff', 
    fontFamily: 'monospace', 
    overflow: 'hidden', 
    position: 'relative' 
  },
  gridOverlay: { 
    position: 'absolute', 
    inset: 0, 
    backgroundImage: 'radial-gradient(rgba(225, 29, 72, 0.15) 1px, transparent 1px)', 
    backgroundSize: '40px 40px', 
    opacity: 0.4 
  },
  content: { 
    position: 'relative', 
    zIndex: 3, 
    textAlign: 'center', 
    width: '100%', 
    maxWidth: '900px', 
    padding: '20px' 
  },
  header: { marginBottom: '50px' },
  logo: { 
    fontSize: '72px', 
    fontWeight: '900', 
    letterSpacing: '14px', 
    margin: '10px 0', 
    color: '#fff',
    textShadow: '0 0 20px rgba(225, 29, 72, 0.3)'
  },
  tagline: { fontSize: '12px', color: '#666', letterSpacing: '5px' },
  cardContainer: { 
    display: 'flex', 
    gap: '40px', 
    justifyContent: 'center', 
    flexWrap: 'wrap' 
  },
  card: { 
    width: '340px', 
    padding: '50px 40px', 
    background: 'rgba(10, 10, 10, 0.9)', 
    border: '1px solid #222', 
    borderBottom: '4px solid #e11d48',
    borderRadius: '8px', 
    cursor: 'pointer', 
    textAlign: 'left', 
    backdropFilter: 'blur(10px)' 
  },
  cardTitle: { 
    fontSize: '20px', 
    margin: '10px 0', 
    letterSpacing: '3px',
    fontWeight: 'bold' 
  },
  cardDesc: { 
    fontSize: '13px', 
    color: '#888', 
    lineHeight: '1.7', 
    marginBottom: '40px', 
    minHeight: '65px' 
  },
  actionBtn: { 
    border: '1px solid #e11d48', 
    padding: '12px', 
    textAlign: 'center', 
    fontSize: '11px', 
    fontWeight: 'bold', 
    color: '#e11d48', 
    letterSpacing: '2px' 
  },
  footer: { 
    marginTop: '100px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: '12px', 
    fontSize: '11px', 
    color: '#333' 
  },
  statusDot: { 
    width: '10px', 
    height: '10px', 
    background: '#0f0', 
    borderRadius: '50%', 
    boxShadow: '0 0 10px #0f0',
    animation: 'pulse 1.5s infinite'
  }
};