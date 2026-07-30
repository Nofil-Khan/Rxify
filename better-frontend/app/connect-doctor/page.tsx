'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

interface DoctorInfo {
  id: number
  username: string
  display_name: string
  specialty: string
}

export default function ConnectDoctorPage() {
  const router = useRouter()
  const [doctorId, setDoctorId] = useState('')
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setDoctorInfo(null)

    if (!doctorId.trim()) {
      setError('Please enter a doctor ID')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('rxify_access_token')
      const response = await fetch(`${apiBase}/api/patient/doctor/lookup/${doctorId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setDoctorInfo(data)
      } else {
        const data = await response.json().catch(() => null)
        setError(data?.detail || 'Doctor not found')
      }
    } catch (err) {
      setError('Failed to lookup doctor')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRequest = async () => {
    if (!doctorInfo) return

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const token = localStorage.getItem('rxify_access_token')
      const response = await fetch(`${apiBase}/api/patient/request-doctor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ doctor_id: doctorInfo.id }),
      })

      if (response.ok) {
        const data = await response.json()
        setSuccess('Connection request sent successfully!')
        setDoctorInfo(null)
        setDoctorId('')
        setTimeout(() => router.push('/my-requests'), 2000)
      } else {
        const data = await response.json().catch(() => null)
        setError(data?.detail || 'Failed to send request')
      }
    } catch (err) {
      setError('Error sending request')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-slate-100 mb-2">Connect with Doctor</h1>
          <p className="text-slate-400">Find and send a connection request to a doctor</p>
        </div>

        {/* Search Section */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur-sm mb-8">
          <h2 className="text-xl font-semibold text-slate-100 mb-6">Look up Doctor</h2>

          <form onSubmit={handleLookup} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Doctor User ID
              </label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  placeholder="Enter doctor's user ID"
                  className="flex-1 rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/20"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 disabled:opacity-50 transition"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {error && !doctorInfo && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                ✓ {success}
              </div>
            )}
          </form>

          {/* Doctor Info Card */}
          {doctorInfo && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-6">
              <div className="mb-4">
                <div className="text-4xl mb-3">👨‍⚕️</div>
                <h3 className="text-2xl font-bold text-slate-100 mb-1">
                  {doctorInfo.display_name || doctorInfo.username}
                </h3>
                <p className="text-cyan-300 text-sm mb-3">@{doctorInfo.username}</p>
                
                {doctorInfo.specialty && (
                  <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 text-sm mb-4">
                    {doctorInfo.specialty}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-white/5">
                  <span className="text-slate-400 text-sm">User ID</span>
                  <span className="text-slate-100 font-medium">{doctorInfo.id}</span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleRequest}
                  disabled={loading}
                  className="flex-1 px-6 py-3 rounded-lg bg-green-500 text-slate-950 font-semibold hover:bg-green-400 disabled:opacity-50 transition"
                >
                  {loading ? 'Sending...' : 'Send Connection Request'}
                </button>
                <button
                  onClick={() => {
                    setDoctorInfo(null)
                    setDoctorId('')
                  }}
                  className="flex-1 px-6 py-3 rounded-lg bg-slate-800 text-slate-100 font-semibold hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">How to find your doctor's ID?</h3>
          <ul className="space-y-3 text-slate-400 text-sm">
            <li className="flex items-start">
              <span className="text-cyan-300 mr-3">1.</span>
              <span>Ask your doctor for their user ID in the Rxify system</span>
            </li>
            <li className="flex items-start">
              <span className="text-cyan-300 mr-3">2.</span>
              <span>Your doctor can find their ID in their profile settings</span>
            </li>
            <li className="flex items-start">
              <span className="text-cyan-300 mr-3">3.</span>
              <span>Once found, enter it above and send a connection request</span>
            </li>
            <li className="flex items-start">
              <span className="text-cyan-300 mr-3">4.</span>
              <span>Your doctor will review and accept your request</span>
            </li>
          </ul>
        </div>

        {/* My Requests Link */}
        <div className="mt-8 text-center">
          <p className="text-slate-400 mb-4">Already sent a request?</p>
          <Link href="/my-requests">
            <button className="px-6 py-3 rounded-full bg-slate-800 text-slate-100 font-semibold hover:bg-slate-700 transition">
              View My Requests
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
