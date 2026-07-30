'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

interface PatientRequest {
  id: number
  patient_id: number
  patient_username: string
  patient_display_name: string
  requested_at: string
}

export default function DoctorRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<PatientRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('rxify_access_token')
    if (!token) {
      router.push('/login')
      return
    }

    fetchRequests()
  }, [router])

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('rxify_access_token')
      const response = await fetch(`${apiBase}/api/doctor/requests`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests || [])
      } else {
        setError('Failed to load requests')
      }
    } catch (err) {
      setError('Error loading requests')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleResponse = async (requestId: number, accept: boolean) => {
    setActionLoading(requestId)
    try {
      const token = localStorage.getItem('rxify_access_token')
      const response = await fetch(`${apiBase}/api/doctor/requests/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accept }),
      })

      if (response.ok) {
        setRequests(requests.filter(r => r.id !== requestId))
      } else {
        alert('Failed to respond to request')
      }
    } catch (err) {
      alert('Error responding to request')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-slate-100 mb-2">Pending Requests</h1>
            <p className="text-slate-400">Review and respond to patient connection requests</p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-cyan-300 text-lg">Loading requests...</div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-red-300">{error}</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900/30 p-12 text-center">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No pending requests</h3>
            <p className="text-slate-400 mb-6">You don't have any pending patient connection requests</p>
            <Link href="/doctor/patients">
              <button className="px-6 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition">
                View My Patients
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-orange-500/20 bg-slate-900/50 p-6 backdrop-blur-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">👤</div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">
                        {request.patient_display_name || request.patient_username}
                      </h3>
                      <p className="text-sm text-slate-400">@{request.patient_username}</p>
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    ID: {request.patient_id}
                  </span>
                </div>

                <p className="text-sm text-slate-400 mb-6">
                  Requested on {new Date(request.requested_at).toLocaleDateString()}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleResponse(request.id, true)}
                    disabled={actionLoading !== null}
                    className="flex-1 px-4 py-2 rounded-lg bg-green-500 text-slate-950 font-semibold hover:bg-green-400 disabled:opacity-50 transition"
                  >
                    {actionLoading === request.id ? 'Processing...' : '✓ Accept'}
                  </button>
                  <button
                    onClick={() => handleResponse(request.id, false)}
                    disabled={actionLoading !== null}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 font-semibold hover:bg-red-500/30 disabled:opacity-50 transition"
                  >
                    {actionLoading === request.id ? 'Processing...' : '✗ Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
