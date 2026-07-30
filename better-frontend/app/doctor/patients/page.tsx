'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

interface Patient {
  id: number
  username: string
  display_name: string
  total_prescriptions: number
  assigned_at: string
}

export default function DoctorPatientsPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('rxify_access_token')
    if (!token) {
      router.push('/login')
      return
    }

    const fetchPatients = async () => {
      try {
        const response = await fetch(`${apiBase}/api/doctor/patients`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json()
          setPatients(data.patients || [])
        } else {
          setError('Failed to load patients')
        }
      } catch (err) {
        setError('Error loading patients')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchPatients()
  }, [router])

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-100 mb-2">My Patients</h1>
              <p className="text-slate-400">View all your connected patients</p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-cyan-300 text-lg">Loading patients...</div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-red-300">{error}</p>
          </div>
        ) : patients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900/30 p-12 text-center">
            <div className="text-5xl mb-4">👥</div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No patients yet</h3>
            <p className="text-slate-400 mb-6">You don't have any connected patients yet. Check your pending requests.</p>
            <Link href="/doctor/requests">
              <button className="px-6 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition">
                View Requests
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patients.map((patient) => (
              <Link key={patient.id} href={`/doctor/patient/${patient.id}/prescriptions`}>
                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 hover:border-white/30 hover:bg-slate-900/80 transition cursor-pointer backdrop-blur-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">👤</div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-100">
                          {patient.display_name || patient.username}
                        </h3>
                        <p className="text-sm text-slate-400">@{patient.username}</p>
                      </div>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      ID: {patient.id}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-white/5">
                      <span className="text-slate-400 text-sm">Prescriptions</span>
                      <span className="text-slate-100 font-semibold">{patient.total_prescriptions}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-white/5">
                      <span className="text-slate-400 text-sm">Connected</span>
                      <span className="text-slate-100 font-semibold">{new Date(patient.assigned_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center text-cyan-400 text-sm font-medium">
                    View Prescriptions <span className="ml-2">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
