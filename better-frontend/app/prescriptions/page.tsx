'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

interface Prescription {
  id: number
  doctor_name: string
  clinic_name: string
  patient_name: string
  patient_age: number
  diagnosis: string
  issue_date: string
  follow_up_date: string
}

export default function PrescriptionsPage() {
  const router = useRouter()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('rxify_access_token')
    if (!token) {
      router.push('/login')
      return
    }

    const fetchPrescriptions = async () => {
      try {
        const response = await fetch(`${apiBase}/api/patient/my-prescriptions`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json()
          setPrescriptions(data.prescriptions || [])
        } else {
          setError('Failed to load prescriptions')
        }
      } catch (err) {
        setError('Error loading prescriptions')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchPrescriptions()
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
              <h1 className="text-4xl font-bold text-slate-100 mb-2">My Prescriptions</h1>
              <p className="text-slate-400">View all your uploaded prescriptions</p>
            </div>
            <Link href="/upload">
              <button className="px-6 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition">
                Upload New
              </button>
            </Link>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-cyan-300 text-lg">Loading prescriptions...</div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-red-300">{error}</p>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900/30 p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No prescriptions yet</h3>
            <p className="text-slate-400 mb-6">Start by uploading your first prescription using OCR</p>
            <Link href="/upload">
              <button className="px-6 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition">
                Upload Prescription
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {prescriptions.map((prescription) => (
              <Link key={prescription.id} href={`/prescription/${prescription.id}`}>
                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 hover:border-white/30 hover:bg-slate-900/80 transition cursor-pointer backdrop-blur-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-slate-100">
                          {prescription.patient_name}
                        </h3>
                        <span className="text-xs px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          ID: {prescription.id}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Doctor</p>
                          <p className="text-sm text-slate-200 font-medium">{prescription.doctor_name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Clinic</p>
                          <p className="text-sm text-slate-200 font-medium">{prescription.clinic_name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Date Issued</p>
                          <p className="text-sm text-slate-200 font-medium">{prescription.issue_date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Follow-up</p>
                          <p className="text-sm text-slate-200 font-medium">{prescription.follow_up_date || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                        <p className="text-xs text-slate-400 mb-1">Diagnosis</p>
                        <p className="text-slate-300 text-sm line-clamp-2">{prescription.diagnosis}</p>
                      </div>
                    </div>

                    <div className="ml-4 flex items-center text-cyan-400">
                      <span className="text-2xl">→</span>
                    </div>
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
