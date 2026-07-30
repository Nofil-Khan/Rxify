'use client'

import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

interface Medication {
  id: number
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
  date: string
}

interface PrescriptionDetail {
  id: number
  patient_name: string
  patient_age: number
  patient_gender: string
  doctor_name: string
  clinic_name: string
  clinic_address: string
  clinic_phone: string
  diagnosis: string
  issue_date: string
  follow_up_date: string
  notes: string
  raw_text: string
  medications: Medication[]
}

export default function PrescriptionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const prescriptionId = params.id as string
  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('rxify_access_token')
    if (!token) {
      router.push('/login')
      return
    }

    const fetchPrescription = async () => {
      try {
        const response = await fetch(`${apiBase}/api/patient/prescriptions/${prescriptionId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json()
          setPrescription(data)
        } else {
          setError('Prescription not found')
        }
      } catch (err) {
        setError('Error loading prescription')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchPrescription()
  }, [prescriptionId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-8 flex items-center justify-center">
        <div className="text-cyan-300 text-lg">Loading prescription...</div>
      </div>
    )
  }

  if (error || !prescription) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/prescriptions" className="text-cyan-400 hover:text-cyan-300 text-sm mb-8 inline-block">
            ← Back to Prescriptions
          </Link>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="text-red-300 mb-6">{error || 'Prescription not found'}</p>
            <Link href="/prescriptions">
              <button className="px-6 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition">
                Back to Prescriptions
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/prescriptions" className="text-cyan-400 hover:text-cyan-300 text-sm mb-4 inline-block">
            ← Back to Prescriptions
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold text-slate-100">Prescription Details</h1>
            <span className="text-xs px-4 py-2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              ID: {prescription.id}
            </span>
          </div>
        </div>

        {/* Patient Info Section */}
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-8 mb-8 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Patient Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-slate-400 mb-2">Name</p>
              <p className="text-lg font-semibold text-slate-100">{prescription.patient_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-2">Age</p>
              <p className="text-lg font-semibold text-slate-100">{prescription.patient_age} years</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-2">Gender</p>
              <p className="text-lg font-semibold text-slate-100">{prescription.patient_gender}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-2">Issue Date</p>
              <p className="text-lg font-semibold text-slate-100">{prescription.issue_date}</p>
            </div>
          </div>
        </div>

        {/* Doctor & Clinic Info Section */}
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-8 mb-8 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Healthcare Provider</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-400 mb-2">Doctor Name</p>
              <p className="text-lg font-semibold text-slate-100">{prescription.doctor_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-2">Clinic/Hospital</p>
              <p className="text-lg font-semibold text-slate-100">{prescription.clinic_name}</p>
            </div>
            {prescription.clinic_address && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Address</p>
                <p className="text-lg font-semibold text-slate-100">{prescription.clinic_address}</p>
              </div>
            )}
            {prescription.clinic_phone && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Phone</p>
                <p className="text-lg font-semibold text-slate-100">{prescription.clinic_phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Diagnosis & Follow-up */}
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-8 mb-8 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Medical Details</h2>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-slate-400 mb-2">Diagnosis</p>
              <p className="text-lg font-semibold text-slate-100 bg-slate-800/50 rounded-lg p-4 border border-white/5">
                {prescription.diagnosis}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-slate-400 mb-2">Follow-up Date</p>
                <p className="text-lg font-semibold text-slate-100 bg-slate-800/50 rounded-lg p-4 border border-white/5">
                  {prescription.follow_up_date || 'Not specified'}
                </p>
              </div>
              {prescription.notes && (
                <div>
                  <p className="text-sm text-slate-400 mb-2">Additional Notes</p>
                  <p className="text-lg font-semibold text-slate-100 bg-slate-800/50 rounded-lg p-4 border border-white/5">
                    {prescription.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Medications Section */}
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-8 mb-8 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Medications</h2>
          {prescription.medications && prescription.medications.length > 0 ? (
            <div className="space-y-4">
              {prescription.medications.map((med, idx) => (
                <div key={med.id || idx} className="rounded-xl border border-green-500/20 bg-slate-900/50 p-6">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-slate-100 mb-2">{med.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-xs border border-green-500/30">
                        {med.dosage}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs border border-blue-500/30">
                        {med.frequency}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs border border-purple-500/30">
                        {med.duration}
                      </span>
                    </div>
                  </div>
                  {med.instructions && (
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                      <p className="text-xs text-slate-400 mb-1">Instructions</p>
                      <p className="text-slate-300">{med.instructions}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              No medications recorded
            </div>
          )}
        </div>

        {/* Raw Text Section */}
        {prescription.raw_text && (
          <div className="rounded-2xl border border-slate-600 bg-slate-900/50 p-8 mb-8 backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-slate-100 mb-6">Extracted Raw Text</h2>
            <div className="bg-slate-950 rounded-lg p-4 border border-white/5 font-mono text-sm text-slate-400 max-h-48 overflow-auto">
              {prescription.raw_text}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <Link href="/prescriptions" className="flex-1">
            <button className="w-full px-6 py-3 rounded-full bg-slate-800 text-slate-100 font-semibold hover:bg-slate-700 transition">
              Back to Prescriptions
            </button>
          </Link>
          <button
            onClick={() => window.print()}
            className="flex-1 px-6 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  )
}
