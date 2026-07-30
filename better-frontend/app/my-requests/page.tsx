'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

interface DoctorRequest {
  id: number
  doctor_id: number
  doctor_username: string
  doctor_display_name: string
  doctor_specialty: string
  status: 'pending' | 'accepted' | 'rejected'
  requested_at: string
}

export default function MyRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<DoctorRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('rxify_access_token')
    if (!token) {
      router.push('/login')
      return
    }

    const fetchRequests = async () => {
      try {
        const response = await fetch(`${apiBase}/api/patient/my-requests`, {
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

    fetchRequests()
  }, [router])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-xs font-semibold">⏳ Pending</span>
      case 'accepted':
        return <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 text-xs font-semibold">✓ Accepted</span>
      case 'rejected':
        return <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold">✗ Rejected</span>
      default:
        return null
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳'
      case 'accepted':
        return '✓'
      case 'rejected':
        return '✗'
      default:
        return '•'
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-100 mb-2">My Doctor Requests</h1>
              <p className="text-slate-400">View and manage your doctor connection requests</p>
            </div>
            <Link href="/connect-doctor">
              <button className="px-6 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition">
                New Request
              </button>
            </Link>
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
            <div className="text-5xl mb-4">📬</div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No requests yet</h3>
            <p className="text-slate-400 mb-6">Send your first doctor connection request to get started</p>
            <Link href="/connect-doctor">
              <button className="px-6 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition">
                Send Request
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending Requests */}
            {requests.filter(r => r.status === 'pending').length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-yellow-300 mb-4">⏳ Pending</h2>
                <div className="space-y-3 mb-8">
                  {requests
                    .filter(r => r.status === 'pending')
                    .map((request) => (
                      <div key={request.id} className="rounded-2xl border border-yellow-500/20 bg-slate-900/50 p-6 backdrop-blur-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="text-3xl">👨‍⚕️</div>
                              <div>
                                <h3 className="text-lg font-semibold text-slate-100">
                                  {request.doctor_display_name || request.doctor_username}
                                </h3>
                                <p className="text-sm text-slate-400">@{request.doctor_username}</p>
                              </div>
                            </div>

                            {request.doctor_specialty && (
                              <div className="inline-block mb-3 px-3 py-1 rounded-full bg-slate-800/50 border border-white/10 text-slate-300 text-xs">
                                {request.doctor_specialty}
                              </div>
                            )}

                            <p className="text-sm text-slate-400">
                              Requested on {new Date(request.requested_at).toLocaleDateString()}
                            </p>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Accepted Requests */}
            {requests.filter(r => r.status === 'accepted').length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-green-300 mb-4">✓ Connected</h2>
                <div className="space-y-3 mb-8">
                  {requests
                    .filter(r => r.status === 'accepted')
                    .map((request) => (
                      <div key={request.id} className="rounded-2xl border border-green-500/20 bg-slate-900/50 p-6 backdrop-blur-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="text-3xl">👨‍⚕️</div>
                              <div>
                                <h3 className="text-lg font-semibold text-slate-100">
                                  {request.doctor_display_name || request.doctor_username}
                                </h3>
                                <p className="text-sm text-slate-400">@{request.doctor_username}</p>
                              </div>
                            </div>

                            {request.doctor_specialty && (
                              <div className="inline-block mb-3 px-3 py-1 rounded-full bg-slate-800/50 border border-white/10 text-slate-300 text-xs">
                                {request.doctor_specialty}
                              </div>
                            )}

                            <p className="text-sm text-slate-400">
                              Connected on {new Date(request.requested_at).toLocaleDateString()}
                            </p>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Rejected Requests */}
            {requests.filter(r => r.status === 'rejected').length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-red-300 mb-4">✗ Rejected</h2>
                <div className="space-y-3">
                  {requests
                    .filter(r => r.status === 'rejected')
                    .map((request) => (
                      <div key={request.id} className="rounded-2xl border border-red-500/20 bg-slate-900/50 p-6 backdrop-blur-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="text-3xl">👨‍⚕️</div>
                              <div>
                                <h3 className="text-lg font-semibold text-slate-100">
                                  {request.doctor_display_name || request.doctor_username}
                                </h3>
                                <p className="text-sm text-slate-400">@{request.doctor_username}</p>
                              </div>
                            </div>

                            <p className="text-sm text-slate-400">
                              Requested on {new Date(request.requested_at).toLocaleDateString()}
                            </p>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
