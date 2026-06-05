import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MainPage() {
  const navigate = useNavigate(); const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-x-hidden overflow-y-auto bg-[#030303]">
      {/* Decorative Network Grid & Blur Effects */}
      <div className="cyber-grid absolute inset-0"></div>
      <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-rose-600/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[20%] w-[400px] h-[400px] rounded-full bg-emerald-600/5 blur-[100px] pointer-events-none"></div>

      {/* Sticky Header Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#030303]/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-6 md:px-12">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <span className="text-2xl shadow-[0_0_15px_rgba(239,68,68,0.3)]">🛡️</span>
            <span className="font-display text-lg font-black tracking-[0.2em] text-white">VANGUARD</span>
            <span className="hidden sm:inline-block rounded-full border border-rose-500/20 bg-rose-500/5 px-2 py-0.5 text-[8px] font-extrabold tracking-widest text-rose-400">v2.5 CORE</span>
          </div>

          {/* Navigation Links (AdaptFit Center Link Style) */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#uplinks" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-white">Access Portals</a>
            <a href="#features" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-white">Core Features</a>
            <a href="#status" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-white">System Status</a>
          </nav>

          {/* CTA Buttons (AdaptFit Right Nav Style) */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/login')}
              className="text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition cursor-pointer"
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/signup')}
              className="hidden sm:flex items-center justify-center rounded-full border border-rose-500/30 bg-rose-950/20 px-5 py-2 text-xs font-bold uppercase tracking-widest text-rose-400 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.1)] cursor-pointer"
            >
              Register
            </button>
            <button 
              className="md:hidden text-zinc-400 hover:text-white cursor-pointer"
              onClick={() => setNavOpen(!navOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${navOpen ? 'max-h-48 border-t border-white/5 bg-[#030303]/90' : 'max-h-0'}`}>
          <nav className="flex flex-col px-6 py-4 space-y-4">
            <a href="#uplinks" onClick={() => setNavOpen(false)} className="text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-white">Access Portals</a>
            <a href="#features" onClick={() => setNavOpen(false)} className="text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-white">Core Features</a>
            <a href="#status" onClick={() => setNavOpen(false)} className="text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-white">System Status</a>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 md:px-12 text-center max-w-5xl mx-auto">
        
        {/* Floating Telemetry Widgets (AdaptFit Style) */}
        <div className="hidden lg:block absolute left-[-110px] top-[10%] p-4 rounded-2xl border border-rose-500/10 bg-zinc-950/45 backdrop-blur-md shadow-2xl animate-float-slow select-none w-44 text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping"></span>
            <span className="font-mono text-[7px] font-black tracking-widest text-zinc-500 uppercase">CCTV INTELLIGENCE</span>
          </div>
          <p className="text-[10px] font-bold text-white uppercase tracking-wider leading-tight">YOLOv8 Threat Scan</p>
          <p className="text-[8px] text-rose-400 font-mono mt-0.5 font-bold uppercase tracking-widest">30 FPS // ACTIVE</p>
        </div>

        <div className="hidden lg:block absolute right-[-110px] top-[22%] p-4 rounded-2xl border border-sky-500/10 bg-zinc-950/45 backdrop-blur-md shadow-2xl animate-float-delayed select-none w-44 text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            <span className="font-mono text-[7px] font-black tracking-widest text-zinc-500 uppercase">EDGE LOCAL BACKEND</span>
          </div>
          <p className="text-[10px] font-bold text-white uppercase tracking-wider leading-tight">Gemma 2B Continuity</p>
          <p className="text-[8px] text-sky-400 font-mono mt-0.5 font-bold uppercase tracking-widest">FAILOVER READY</p>
        </div>

        <div className="hidden lg:block absolute left-[-130px] bottom-[30%] p-4 rounded-2xl border border-emerald-500/10 bg-zinc-950/45 backdrop-blur-md shadow-2xl animate-float-delayed select-none w-44 text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span className="font-mono text-[7px] font-black tracking-widest text-zinc-500 uppercase">DIJKSTRA PATHFINDING</span>
          </div>
          <p className="text-[10px] font-bold text-white uppercase tracking-wider leading-tight">Dynamic SafePath</p>
          <p className="text-[8px] text-emerald-400 font-mono mt-0.5 font-bold uppercase tracking-widest">&lt; 10MS REROUTE</p>
        </div>

        {/* Top Feature Tag (AdaptFit Badge Style) */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/5 px-4 py-1.5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
          <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_#0ea5e9]"></span>
          <span className="font-display text-[9px] font-black uppercase tracking-[0.25em] text-sky-400">⚡ Secured by Neural Mesh Networks</span>
        </div>

        {/* Hero Header */}
        <div className="mb-14">
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-[1.1] mb-6">
            Emergency Triage. <br />
            <span className="gradient-text-cyan font-black">Redesigned by AI.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-sm md:text-base text-zinc-400 leading-relaxed font-medium">
            Vanguard is an enterprise-grade emergency response and evacuation coordination system. Real-time pathfinding, camera feeds, and automated P2P fallback keep facilities and guests safe.
          </p>
        </div>

        {/* Uplink Cards Grid */}
        <div id="uplinks" className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
          
          {/* HOTEL ADMINISTRATION PORTAL */}
          <div 
            onClick={() => navigate('/login')}
            className="group relative cursor-pointer rounded-3xl border border-rose-500/80 bg-zinc-900/30 p-10 md:p-12 text-left transition-all duration-300 hover:border-rose-500 hover:bg-zinc-900/50 shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:shadow-[0_0_40px_rgba(239,68,68,0.4)] backdrop-blur-md"
          >
            {/* Top Glowing Decorator */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-rose-500 to-amber-500 rounded-t-3xl"></div>
            
            {/* Icon & Glow */}
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-3xl shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-transform duration-300 group-hover:scale-110">
              🏨
            </div>
            
            <h2 className="font-display text-xl font-bold tracking-wide text-white mb-3 flex items-center gap-2.5">
              ADMIN PORTAL — Primary Access
              <span className="text-zinc-600 text-xs font-normal group-hover:translate-x-1 transition-transform">→</span>
            </h2>
            
            <p className="text-xs text-zinc-400 leading-relaxed mb-8 min-h-[60px]">
              Facility management portal. Upload blueprints, define safety vectors, track guests, and manage active alarms from the operations dashboard.
            </p>
            
            <div className="inline-flex items-center justify-center w-full rounded-xl border border-rose-500/60 bg-rose-500/10 py-3 text-xs font-bold uppercase tracking-widest text-rose-400 transition group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-600">
              Admin Portal
            </div>
          </div>

          {/* GUEST / USER PORTAL */}
          <div 
            onClick={() => navigate('/signup')}
            className="group relative cursor-pointer rounded-3xl border border-sky-500/20 bg-zinc-900/30 p-8 text-left transition-all duration-300 hover:border-sky-500/40 hover:bg-zinc-900/50 hover:shadow-[0_0_35px_rgba(14,165,233,0.1)] backdrop-blur-md"
          >
            {/* Top Glowing Decorator */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-sky-500 to-indigo-500 rounded-t-3xl"></div>
            
            {/* Icon & Glow */}
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-3xl shadow-[0_0_15px_rgba(14,165,233,0.1)] transition-transform duration-300 group-hover:scale-110">
              👤
            </div>
            
            <h2 className="font-display text-xl font-bold tracking-wide text-white mb-3 flex items-center gap-2.5">
              GUEST PORTAL — Register Your Stay
              <span className="text-zinc-600 text-xs font-normal group-hover:translate-x-1 transition-transform">→</span>
            </h2>
            
            <p className="text-xs text-zinc-400 leading-relaxed mb-8 min-h-[60px]">
              Guest emergency dashboard. Open a secure voice line, request emergency SOS assistance, and fetch localized evacuation paths.
            </p>
            
            <div className="inline-flex items-center justify-center w-full rounded-xl border border-sky-500/40 bg-sky-500/5 py-3 text-xs font-bold uppercase tracking-widest text-sky-400 transition group-hover:bg-sky-600 group-hover:text-white group-hover:border-sky-600">
              Guest Portal
            </div>
          </div>

        </div>

        {/* MESH PROTOCOL FEATURES SECTION */}
        <section id="features" className="w-full mt-24 border-t border-white/5 pt-16 text-left">
          <div className="mb-10">
            <span className="text-[10px] font-black tracking-widest text-rose-500 uppercase">MESH CORE SPECIFICATIONS</span>
            <h3 className="font-display text-2xl md:text-3xl font-black text-white mt-1 uppercase">P2P NETWORK PROTOCOL</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="tactical-glass p-6 rounded-3xl border border-white/5 bg-zinc-950/20">
              <span className="text-xl">📡</span>
              <h4 className="text-sm font-bold text-white uppercase mt-4 mb-2">Decentralized Fallback</h4>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                Autonomous peer-to-peer mesh networks link devices locally via WiFi/Nearby APIs if centralized networks fail.
              </p>
            </div>
            <div className="tactical-glass p-6 rounded-3xl border border-white/5 bg-zinc-950/20">
              <span className="text-xl">⚡</span>
              <h4 className="text-sm font-bold text-white uppercase mt-4 mb-2">Sub-10ms Routing</h4>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                Optimized Dijkstra routing dynamically recalculates fire and threat paths inside the device cache.
              </p>
            </div>
            <div className="tactical-glass p-6 rounded-3xl border border-white/5 bg-zinc-950/20">
              <span className="text-xl">💾</span>
              <h4 className="text-sm font-bold text-white uppercase mt-4 mb-2">Local Telemetry Cache</h4>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                Fail-safe packet caching guarantees critical SOS delivery even through temporary telemetry blackouts.
              </p>
            </div>
          </div>
        </section>

        {/* GDC STATUS SECTION */}
        <section id="status" className="w-full mt-20 border-t border-white/5 pt-16 text-left mb-10">
          <div className="mb-10">
            <span className="text-[10px] font-black tracking-widest text-sky-400 uppercase">SYSTEM TELEMETRY</span>
            <h3 className="font-display text-2xl md:text-3xl font-black text-white mt-1 uppercase">Live System Health</h3>
          </div>
          
          <div className="w-full">
            <div className="tactical-glass p-5 rounded-2xl border border-white/5 flex items-center justify-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
              </span>
              <span className="font-display text-lg font-bold text-emerald-400 uppercase tracking-wide">
                System operational — all services nominal
              </span>
            </div>
          </div>
        </section>

      </main>

      {/* Footer Node Info */}
      <footer id="footer-status" className="relative z-10 w-full border-t border-white/5 py-8 bg-[#030303]/40">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-6 md:px-12 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
            </span>
            <span>ENCRYPTED MESH SYSTEM ACTIVE // NODE: BENGALURU_GDC_MAIN</span>
          </div>
          <div>
            © {new Date().getFullYear()} VANGUARD SYSTEMS INC. ALL RIGHTS RESERVED
          </div>
        </div>
      </footer>
    </div>
  );
}