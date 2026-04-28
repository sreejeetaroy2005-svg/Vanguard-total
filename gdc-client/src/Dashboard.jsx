import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from './firebase'
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore'
import { pathfinder } from './utils/pathfinder'

const Dashboard = () => {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [broadcastText, setBroadcastText] = useState('')
  const [heading, setHeading] = useState(0)
  const [nextWaypoint, setNextWaypoint] = useState('')
  
  const hotelId = localStorage.getItem('hotelId') || 'GLOBAL'

  // 1. REAL-TIME SUBSCRIPTION
  useEffect(() => {
    const alertsRef = collection(db, 'alerts')
    // Subscribe to both current hotel alerts and GLOBAL alerts
    const q = query(alertsRef, orderBy('timestamp', 'desc'))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alertList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      // Filter in JS since Firestore doesn't support complex OR queries easily without indexes
      const filtered = alertList.filter(a => a.hotelId === hotelId || a.hotelId === 'GLOBAL')
      setAlerts(filtered)
      setLoading(false)
      
      // Update Pathfinder with active hazards
      pathfinder.clearHazards()
      filtered.forEach(a => {
        if (a.status !== 'RESOLVED') pathfinder.markHazard(a.roomNumber)
      })
      
      calculateLocalPath()
    }, (err) => {
      setError('Uplink Failed: ' + err.message)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [hotelId])

  const calculateLocalPath = () => {
    const path = pathfinder.findSafePath('R301')
    if (path.length >= 2) {
      const from = path[0]
      const to = path[1]
      const angle = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI)
      setHeading(angle)
      setNextWaypoint(to.label)
    } else {
      setHeading(0)
      setNextWaypoint('STAY IN PLACE')
    }
  }

  const handleStatusUpdate = async (alertId, newStatus) => {
    try {
      const alertRef = doc(db, 'alerts', alertId)
      await updateDoc(alertRef, { status: newStatus })
    } catch (err) {
      setError('Update Denied: ' + err.message)
    }
  }

  const handleBroadcast = async () => {
    if (!broadcastText.trim()) return
    try {
      await addDoc(collection(db, 'alerts'), {
        uniqueId: 'BCAST-' + Date.now(),
        message: 'GDC BROADCAST: ' + broadcastText,
        priority: 'NONE',
        status: 'PENDING',
        hotelId: hotelId,
        timestamp: Date.now(),
        userId: 'GDC-CONSOLE'
      })
      setBroadcastText('')
    } catch (err) {
      setError('Broadcast Failed: ' + err.message)
    }
  }

  const activeThreats = alerts.filter(a => a.status !== 'RESOLVED' && a.priority !== 'NONE')

  return (
    <div className="min-h-screen bg-black text-white p-4 lg:p-8 hud-font selection:bg-rose-500/30">
      {/* TOP HUD BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-l-rose-500 scanline-container">
          <p className="text-[10px] font-black tracking-[0.2em] text-rose-500 mb-1">ACTIVE THREATS</p>
          <p className="text-4xl font-black">{activeThreats.length}</p>
        </div>
        <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-l-sky-500">
          <p className="text-[10px] font-black tracking-[0.2em] text-sky-500 mb-1">FIREBASE UPLINK</p>
          <p className="text-4xl font-black">ACTIVE</p>
        </div>
        <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-l-amber-500">
          <p className="text-[10px] font-black tracking-[0.2em] text-amber-500 mb-1">GUESTS AT RISK</p>
          <p className="text-4xl font-black">{activeThreats.length}</p>
        </div>
        <div className="tactical-glass p-5 rounded-2xl flex flex-col justify-center border-l-4 border-l-zinc-500">
          <p className="text-[10px] font-black tracking-[0.2em] text-zinc-400 mb-1">SYSTEM STATUS</p>
          <p className="text-xl font-bold text-emerald-400">SERVERLESS / READY</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: LIVE FEED & TACTICAL MAP */}
        <div className="lg:col-span-4 space-y-8">
          <div className="tactical-glass rounded-3xl overflow-hidden relative group">
             <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <span className="h-2 w-2 bg-rose-500 rounded-full animate-ping"></span>
                <span className="text-[10px] font-black tracking-widest text-white drop-shadow-md">LIVE CCTV (LOCAL NODE)</span>
             </div>
             <img 
               src={`http://localhost:5000/video_feed`} 
               alt="AI Stream" 
               className="w-full aspect-video object-cover grayscale brightness-75 hover:grayscale-0 transition-all duration-700"
               onError={(e) => e.target.src = "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000&auto=format&fit=crop"}
             />
             <div className="p-4 border-t border-white/5 bg-white/5">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Mixed Content Warning: local camera stream requires allow-insecure-content</p>
             </div>
          </div>

          <div className="tactical-glass rounded-3xl p-6 relative">
             <h3 className="hud-title text-sm text-sky-400 mb-4">Local SafePath (In-Browser Calculaion)</h3>
             <div className="aspect-square rounded-2xl bg-zinc-900 border border-white/5 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                <div 
                   className="w-full flex justify-center mb-4 transition-transform duration-1000"
                   style={{ transform: `rotate(${heading || 0}deg)` }}
                >
                   <div className="w-2 h-16 bg-emerald-500 rounded-full shadow-[0_0_20px_#10b981] animate-bounce"></div>
                </div>
                <div className="relative z-10">
                   <p className="text-xs font-bold text-emerald-300 mb-1 uppercase tracking-widest">
                     {heading ? 'Safe Exit Vector Calculated' : 'Pathfinding Standby'}
                   </p>
                   <p className="text-[10px] text-zinc-500 uppercase">Heading: {heading?.toFixed(1) || '0.0'}° | {nextWaypoint || 'WAITING'}</p>
                </div>
             </div>
          </div>

          <div className="tactical-glass rounded-3xl p-6">
             <h3 className="hud-title text-sm text-rose-400 mb-4">Cloud Broadcast</h3>
             <textarea 
               value={broadcastText}
               onChange={(e) => setBroadcastText(e.target.value)}
               placeholder="TYPE TACTICAL DIRECTIVE..."
               className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-rose-500 outline-none h-24 mb-3"
             />
             <button 
               onClick={handleBroadcast}
               className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-[10px] font-black tracking-[0.3em] uppercase rounded-xl transition-all active:scale-95"
             >
                Sync to All Nodes
             </button>
          </div>
        </div>

        {/* RIGHT COLUMN: ALERT TRIAGE FEED */}
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
             <h2 className="text-2xl font-black hud-title tracking-tighter">
                Firebase <span className="text-rose-500">Live</span> Feed
             </h2>
          </div>

          <div className="space-y-4 overflow-y-auto max-h-[850px] pr-2 custom-scrollbar">
            {activeThreats.length === 0 ? (
              <div className="py-20 text-center tactical-glass rounded-3xl">
                <p className="text-zinc-600 font-bold uppercase tracking-widest text-sm">Monitoring Cloud Signals...</p>
              </div>
            ) : (
              activeThreats.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`tactical-glass p-6 rounded-3xl border-l-8 transition-all hover:translate-x-2 ${
                    alert.priority === 'FIRE' || alert.priority === 'INTRUDER' ? 'border-l-rose-500' : 'border-l-amber-500'
                  }`}
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                       <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-0.5 text-[10px] font-black rounded uppercase ${
                            alert.priority === 'FIRE' || alert.priority === 'INTRUDER' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black'
                          }`}>
                            {alert.priority}
                          </span>
                       </div>
                       <h4 className="text-lg font-bold mb-2 text-zinc-100">{alert.message}</h4>
                       <div className="flex flex-wrap gap-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          <p>Location: <span className="text-white">{alert.hotelId || 'GLOBAL'} / ROOM {alert.roomNumber || 'N/A'}</span></p>
                          <p>Source: <span className="text-white">{alert.userId}</span></p>
                       </div>
                    </div>
                    <div className="flex flex-row md:flex-col gap-2 justify-end">
                       <button 
                         onClick={() => handleStatusUpdate(alert.id, 'ACKNOWLEDGED')}
                         className="px-4 py-2 bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[10px] font-black rounded-lg hover:bg-sky-500 hover:text-white transition-all uppercase tracking-widest"
                       >
                         ACK
                       </button>
                       <button 
                         onClick={() => handleStatusUpdate(alert.id, 'RESOLVED')}
                         className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-black rounded-lg hover:bg-emerald-500 hover:text-white transition-all uppercase tracking-widest"
                       >
                         RESOLVE
                       </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard