import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyLatestAlert, logout, sendAlert } from './api';
import HotelMapSystem from './HotelMap';

function UserSOS() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sosMessage, setSosMessage] = useState('')
  const [contextType, setContextType] = useState('GENERAL')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [latestStatus, setLatestStatus] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const recognitionRef = useRef(null)
  const speechSupportedRef = useRef(true)
  const [clock, setClock] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  )
  const [showMap, setShowMap] = useState(false)
  const [mapTriggered, setMapTriggered] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const retryPendingAlerts = async () => {
      const raw = localStorage.getItem('pendingSosQueue')
      if (!raw) {
        return
      }

      const queue = JSON.parse(raw)
      if (!Array.isArray(queue) || queue.length === 0) {
        return
      }

      const remaining = []
      for (const queuedPayload of queue) {
        try {
          await sendAlert(queuedPayload)
        } catch {
          remaining.push(queuedPayload)
        }
      }
      localStorage.setItem('pendingSosQueue', JSON.stringify(remaining))
    }

    retryPendingAlerts()
    const timer = setInterval(retryPendingAlerts, 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const loadLatestStatus = async () => {
      try {
        const response = await getMyLatestAlert()
        setLatestStatus(response.data?.status || '')
      } catch {
        setLatestStatus('')
      }
    }
    loadLatestStatus()
    const timer = setInterval(loadLatestStatus, 6000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      speechSupportedRef.current = false
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setVoiceError('')
      setIsRecording(true)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || ''
      if (transcript) {
        setSosMessage(transcript)
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceError('Microphone permission denied.')
      } else {
        setVoiceError('Voice capture failed. Please try again.')
      }
      setIsRecording(false)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [])

  // Auto-open map if user asks for shortest path
  useEffect(() => {
    const text = sosMessage.toLowerCase()
    if (!mapTriggered && (text.includes('shortest path') || text.includes('escape route') || text.includes('show map') || text.includes('where to go'))) {
      setShowMap(true)
      setMapTriggered(true) // prevent infinite loop bouncing
    }
  }, [sosMessage, mapTriggered])

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // Ignore logout network errors and clear local session.
    }
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('role')
    navigate('/login')
  }

  const handleSendSOS = async () => {
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const translatedMessage = await translateToEnglish(sosMessage.trim())
      const payload = {
        uniqueId: "SOS-" + Date.now().toString(),
        timestamp: Date.now(),
        timeToLive: 300000,
        status: "PENDING",
        priority: contextType === 'THREAT' ? 'INTRUDER' : contextType,
        userId: "GUEST-APP",
        latitude: 12.9716,
        longitude: 77.5946,
        message: translatedMessage,
        evidenceUrl: evidenceUrl.trim(),
        contextType,
      }

      const response = await sendAlert(payload)
      setLatestStatus(response.data?.status || 'PENDING')
      setMessage('SOS alert sent successfully with current location.')
    } catch (err) {
      const payloadForQueue = {
        uniqueId: "SOS-" + Date.now().toString() + "-Q",
        timestamp: Date.now(),
        timeToLive: 300000,
        status: "PENDING",
        priority: contextType === 'THREAT' ? 'INTRUDER' : contextType,
        userId: "GUEST-APP",
        latitude: 12.9716,
        longitude: 77.5946,
        message: sosMessage.trim(),
        evidenceUrl: evidenceUrl.trim(),
        contextType,
      }
      const existingQueue = JSON.parse(localStorage.getItem('pendingSosQueue') || '[]')
      existingQueue.push(payloadForQueue)
      localStorage.setItem('pendingSosQueue', JSON.stringify(existingQueue))
      setError(err.response?.data?.message || err.message || 'Failed to send SOS.')
    } finally {
      setLoading(false)
    }
  }

  const handleVoiceToggle = () => {
    setVoiceError('')

    if (!speechSupportedRef.current || !recognitionRef.current) {
      setVoiceError('Voice input not supported in this browser')
      return
    }

    if (isRecording) {
      recognitionRef.current.stop()
      return
    }

    recognitionRef.current.start()
  }

  const translateToEnglish = async (text) => {
    if (!text) {
      return ''
    }

    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`,
      )

      if (!response.ok) {
        return text
      }

      const data = await response.json()
      const translated = data?.[0]?.map((chunk) => chunk?.[0] || '').join('').trim()
      return translated || text
    } catch {
      return text
    }
  }

  // Intercept render if Map is active
  if (showMap) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-black">
        <HotelMapSystem onClose={() => setShowMap(false)} />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.14),transparent_50%)]" />
      <div className="relative h-[620px] w-full max-w-[360px] overflow-hidden rounded-[2.5rem] border-4 border-zinc-700 bg-zinc-950 shadow-[0_30px_70px_rgba(0,0,0,0.7)]">
        <div className="absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="flex h-8 items-center justify-between bg-zinc-900 px-5 text-xs text-zinc-400">
          <span>{clock}</span>
          <span className="font-semibold text-rose-400">MESH ACTIVE</span>
        </div>
        <div className="flex h-[calc(100%-2rem)] flex-col justify-between px-6 py-8 text-center">
          <div>
            <h2 className="m-0 text-2xl font-bold text-zinc-100">Guest Emergency</h2>
            <p className="mt-2 text-sm text-zinc-500">P2P Tactical Mode</p>
            {latestStatus ? (
              <p className="mt-2 text-xs text-emerald-300">
                Latest alert status: {latestStatus}
              </p>
            ) : null}
            <div className="mt-4">
              <div className="mb-2 grid grid-cols-2 gap-2">
                <select
                  value={contextType}
                  onChange={(event) => setContextType(event.target.value)}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-100 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
                >
                  <option value="GENERAL">General</option>
                  <option value="MEDICAL">Medical</option>
                  <option value="THREAT">Threat</option>
                  <option value="FIRE">Fire</option>
                </select>
                <input
                  type="url"
                  value={evidenceUrl}
                  onChange={(event) => setEvidenceUrl(event.target.value)}
                  placeholder="Evidence URL (optional)"
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-100 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
                />
              </div>
              <textarea
                value={sosMessage}
                onChange={(event) => setSosMessage(event.target.value)}
                placeholder="Describe emergency message"
                rows={5}
                className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
              />
              <button
                type="button"
                onClick={handleVoiceToggle}
                disabled={loading}
                className="mt-2 inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRecording ? '🎤 Stop' : '🎤 Speak'}
              </button>
              {isRecording ? (
                <p className="mt-2 text-xs font-medium text-rose-300">Listening...</p>
              ) : null}
              {voiceError ? (
                <p className="mt-2 text-xs text-rose-300">{voiceError}</p>
              ) : null}
            </div>
          </div>
          <div>
            <button
              className="w-full rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 px-4 py-5 text-lg font-black tracking-wide text-white shadow-[0_8px_30px_rgba(244,63,94,0.4)] transition hover:scale-[1.01] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSendSOS}
              disabled={loading}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                {loading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    SENDING SOS...
                  </>
                ) : (
                  'SEND SOS'
                )}
              </span>
            </button>
            {message ? (
              <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            ) : null}
          </div>
          <div>
            <div className="mb-2.5 text-xs text-zinc-500">
              Connected to GDC Gateway
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="w-full rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 font-medium text-rose-300 transition hover:bg-rose-500/20 text-sm"
                onClick={() => setShowMap(true)}
              >
                🗺️ EVAC MAP
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-medium text-zinc-200 transition hover:bg-zinc-800 text-sm"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserSOS