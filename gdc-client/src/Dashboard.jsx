import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  acknowledgeAlert,
  dispatchAlert,
  getAlertHistory,
  getAlerts,
  logout,
  resolveAlert,
} from './api'

function Dashboard() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [history, setHistory] = useState([])

  const fetchAlerts = async () => {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await getAlerts()
      const list = Array.isArray(response.data)
        ? response.data
        : response.data?.alerts || []
      setAlerts(list)
      const historyResponse = await getAlertHistory()
      setHistory(Array.isArray(historyResponse.data) ? historyResponse.data : [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch alerts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      fetchAlerts()
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      return undefined
    }

    const stream = new EventSource(
      `http://localhost:8080/api/alerts/stream?token=${encodeURIComponent(token)}`,
    )

    stream.onmessage = () => {
      fetchAlerts()
    }

    stream.addEventListener('NEW_ALERT', (event) => {
      fetchAlerts()
      if (Notification?.permission === 'granted') {
        const payload = JSON.parse(event.data)
        new Notification('New SOS Alert', {
          body: `${payload.userId || 'User'}: ${payload.message || 'Emergency alert'}`,
        })
      }
    })

    return () => stream.close()
  }, [])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handleStatusUpdate = async (id, nextAction) => {
    setError('')
    setMessage('')
    try {
      if (nextAction === 'ACKNOWLEDGED') {
        await acknowledgeAlert(id)
      } else if (nextAction === 'DISPATCHED') {
        await dispatchAlert(id)
      } else {
        await resolveAlert(id)
      }
      setMessage(`Alert marked as ${nextAction}.`)
      await fetchAlerts()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Status update failed.')
    }
  }

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

  const filteredAlerts = alerts.filter((alert) => {
    const status = alert.status ?? 'PENDING'
    const matchesStatus = statusFilter === 'ALL' || status === statusFilter
    const query = searchText.trim().toLowerCase()
    const matchesQuery =
      !query ||
      String(alert.userId ?? '').toLowerCase().includes(query) ||
      String(alert.id ?? '').toLowerCase().includes(query)
    return matchesStatus && matchesQuery
  })

  const uniqueUsersCount = new Set(
    alerts
      .map((alert) => alert.userId)
      .filter((userId) => userId && userId !== 'anonymous-user'),
  ).size
  const pendingCount = alerts.filter((alert) => (alert.status ?? 'PENDING') !== 'RESOLVED').length
  const resolvedCount = alerts.filter((alert) => alert.status === 'RESOLVED').length

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 md:px-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.65)] md:p-7">
        <div className="mb-6 flex flex-col gap-3 border-b border-zinc-800 pb-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-bold tracking-wide text-rose-400 md:text-2xl">
            VANGUARD GDC: LIVE MONITOR
          </h2>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            SYSTEM ONLINE
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={fetchAlerts}
            disabled={loading}
            className="rounded-xl bg-rose-500 px-4 py-2 font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh Alerts'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            Logout
          </button>
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <input
            type="text"
            placeholder="Search by User ID or Alert ID"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="md:col-span-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Live Users</p>
            <p className="mt-1 text-2xl font-bold text-sky-300">{uniqueUsersCount}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total Alerts</p>
            <p className="mt-1 text-2xl font-bold text-zinc-100">{alerts.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Pending Alerts</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Resolved Alerts</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{resolvedCount}</p>
          </div>
        </div>

        {message ? (
          <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] border-collapse overflow-hidden rounded-xl border border-zinc-800">
            <thead className="bg-zinc-900">
              <tr className="text-left text-sm text-zinc-300">
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Context</th>
                <th className="px-4 py-3">Latitude</th>
                <th className="px-4 py-3">Longitude</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Evidence</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 ? (
                <tr className="border-t border-zinc-800">
                  <td colSpan="8" className="px-4 py-8 text-center text-zinc-500">
                    No active alerts found.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="border-t border-zinc-800 text-sm text-zinc-200 transition hover:bg-zinc-900/70"
                  >
                    <td className="px-4 py-3">{alert.userId ?? 'N/A'}</td>
                    <td className="px-4 py-3">{alert.contextType ?? 'GENERAL'}</td>
                    <td className="px-4 py-3">{alert.latitude ?? 'N/A'}</td>
                    <td className="px-4 py-3">{alert.longitude ?? 'N/A'}</td>
                    <td className="max-w-[360px] px-4 py-3 text-zinc-300">
                      <p className="whitespace-pre-wrap break-words">
                        {alert.message?.trim() ? alert.message : 'No message'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-300">
                      {alert.evidenceUrl ? (
                        <a href={alert.evidenceUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline">
                          View
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                          alert.status === 'RESOLVED'
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                            : 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        {alert.status ?? 'PENDING'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate(alert.id, 'ACKNOWLEDGED')}
                          disabled={!alert.id || alert.status === 'RESOLVED'}
                          className="rounded-lg bg-blue-500 px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ACK
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate(alert.id, 'DISPATCHED')}
                          disabled={!alert.id || alert.status === 'RESOLVED'}
                          className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          DISPATCH
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate(alert.id, 'RESOLVED')}
                          disabled={!alert.id || alert.status === 'RESOLVED'}
                          className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          RESOLVE
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">Audit & History</h3>
          <div className="max-h-44 space-y-3 overflow-y-auto pr-1">
            {history.slice(0, 20).map((item) => (
              <div key={`history-${item.id}`} className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-300">
                <p>
                  <span className="font-semibold text-zinc-200">Alert:</span> {item.id}
                </p>
                <p>
                  <span className="font-semibold text-zinc-200">User:</span> {item.userId}
                </p>
                <p>
                  <span className="font-semibold text-zinc-200">Trail:</span>{' '}
                  {(item.history || []).map((h) => h.status).join(' -> ') || 'PENDING'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard