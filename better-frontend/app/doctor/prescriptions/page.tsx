'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

interface Prescription {
  id: number
  patient_name: string
  patient_age: number
  patient_gender: string
  doctor_name: string
  clinic_name: string
  diagnosis: string
  issue_date: string
  follow_up_date: string
  uploaded_by: string
}

export default function DoctorPrescriptionsPage() {
  const router = useRouter()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filteredPrescriptions, setFilteredPrescriptions] = useState<Prescription[]>([])

  useEffect(() => {
    const token = localStorage.getItem('rxify_access_token')
    if (!token) {
      router.push('/login')
      return
    }

    fetchPrescriptions()
  }, [router])

  useEffect(() => {
    if (!search.trim()) {
      setFilteredPrescriptions(prescriptions)
    } else {
      const query = search.toLowerCase()
      setFilteredPrescriptions(
        prescriptions.filter(p =>
          p.patient_name.toLowerCase().includes(query) ||
          p.diagnosis.toLowerCase().includes(query) ||
          p.doctor_name.toLowerCase().includes(query) ||
          p.clinic_name.toLowerCase().includes(query)
        )
      )
    }
  }, [search, prescriptions])

  const fetchPrescriptions = async () => {
    try {
      const token = localStorage.getItem('rxify_access_token')
      const response = await fetch(`${apiBase}/api/doctor/prescriptions`, {
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
              <h1 className="text-4xl font-bold text-slate-100 mb-2">Patient Prescriptions</h1>
              <p className="text-slate-400">Review prescriptions from your connected patients</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search by patient name, diagnosis, doctor, or clinic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-900/50 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/20"
          />
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
            <div className="text-5xl mb-4">📄</div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No prescriptions yet</h3>
            <p className="text-slate-400 mb-6">You don't have access to any patient prescriptions yet</p>
            <Link href="/doctor/patients">
              <button className="px-6 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition">
                View My Patients
              </button>
            </Link>
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900/30 p-12 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No results found</h3>
            <p className="text-slate-400 mb-6">Try adjusting your search terms</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPrescriptions.map((prescription) => (
              <Link key={prescription.id} href={`/doctor/prescription/${prescription.id}`}>
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

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Age/Gender</p>
                          <p className="text-sm text-slate-200 font-medium">{prescription.patient_age} {prescription.patient_gender}</p>
                        </div>
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
