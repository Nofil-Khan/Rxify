'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

interface OCRResult {
  doctor_name: string
  clinic_name: string
  clinic_address: string
  clinic_phone: string
  patient_name: string
  patient_age: number
  patient_gender: string
  issue_date: string
  follow_up_date: string
  diagnosis: string
  notes: string
  medications: Array<{
    name: string
    dosage: string
    frequency: string
    duration: string
    instructions: string
  }>
}

interface JobStatus {
  status: 'processing' | 'done' | 'error'
  result?: OCRResult
  error?: string
  prescription_id?: number
}

export default function UploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('rxify_access_token')
    if (!token) {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (!jobId || !polling) return

    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('rxify_access_token')
        const response = await fetch(`${apiBase}/api/job/${jobId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json()
          setJobStatus(data)

          if (data.status === 'done' || data.status === 'error') {
            setPolling(false)
          }
        }
      } catch (error) {
        console.error('Failed to check job status:', error)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [jobId, polling])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    try {
      const token = localStorage.getItem('rxify_access_token')
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${apiBase}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setJobId(data.job_id)
        setJobStatus({ status: 'processing' })
        setPolling(true)
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
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
          <h1 className="text-4xl font-bold text-slate-100 mb-2">Upload Prescription</h1>
          <p className="text-slate-400">Upload an image of your prescription for AI-powered OCR analysis</p>
        </div>

        {/* Upload Section */}
        {!jobId ? (
          <div className="rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-12 text-center mb-8">
            <div className="mb-6">
              <div className="text-6xl mb-4">📷</div>
              <h2 className="text-xl font-semibold text-slate-100 mb-2">Choose a prescription image</h2>
              <p className="text-slate-400 text-sm mb-6">
                Supported formats: JPG, PNG, WebP, HEIC
              </p>
            </div>

            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="inline-block cursor-pointer">
                <button
                  type="button"
                  onClick={() => document.querySelector('input[type="file"]')?.click()}
                  className="px-8 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition"
                >
                  Select File
                </button>
              </div>
            </label>

            {file && (
              <div className="mt-6 text-left">
                <p className="text-sm text-slate-300 mb-4">
                  Selected: <span className="font-semibold text-cyan-300">{file.name}</span>
                </p>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full px-6 py-3 rounded-full bg-green-500 text-slate-950 font-semibold hover:bg-green-400 disabled:opacity-50 transition"
                >
                  {uploading ? 'Uploading...' : 'Upload & Analyze'}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Status Section */}
        {jobStatus && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur-sm">
            {jobStatus.status === 'processing' && (
              <div>
                <div className="flex items-center mb-4">
                  <div className="animate-spin mr-3">⚙️</div>
                  <h3 className="text-lg font-semibold text-cyan-300">Processing...</h3>
                </div>
                <p className="text-slate-400">OCR analysis in progress. This may take a moment.</p>
              </div>
            )}

            {jobStatus.status === 'done' && jobStatus.result && (
              <div className="space-y-6">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">✅</span>
                  <h3 className="text-lg font-semibold text-green-300">Analysis Complete!</h3>
                </div>

                {/* Prescription Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">Doctor</p>
                    <p className="text-slate-100 font-semibold">{jobStatus.result.doctor_name}</p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">Clinic</p>
                    <p className="text-slate-100 font-semibold">{jobStatus.result.clinic_name}</p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">Diagnosis</p>
                    <p className="text-slate-100 font-semibold">{jobStatus.result.diagnosis}</p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">Follow-up Date</p>
                    <p className="text-slate-100 font-semibold">{jobStatus.result.follow_up_date}</p>
                  </div>
                </div>

                {/* Medications */}
                {jobStatus.result.medications && jobStatus.result.medications.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-3">Medications</h4>
                    <div className="space-y-3">
                      {jobStatus.result.medications.map((med, idx) => (
                        <div key={idx} className="bg-slate-800/50 p-4 rounded-lg border border-white/5">
                          <p className="font-semibold text-slate-100 mb-2">{med.name}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <p><span className="text-slate-400">Dosage:</span> {med.dosage}</p>
                            <p><span className="text-slate-400">Frequency:</span> {med.frequency}</p>
                            <p><span className="text-slate-400">Duration:</span> {med.duration}</p>
                            <p><span className="text-slate-400">Instructions:</span> {med.instructions}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <Link href="/prescriptions" className="flex-1">
                    <button className="w-full px-6 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition">
                      View All Prescriptions
                    </button>
                  </Link>
                  <button
                    onClick={() => {
                      setJobId(null)
                      setJobStatus(null)
                      setFile(null)
                    }}
                    className="flex-1 px-6 py-3 rounded-full bg-slate-800 text-slate-100 font-semibold hover:bg-slate-700 transition"
                  >
                    Upload Another
                  </button>
                </div>
              </div>
            )}

            {jobStatus.status === 'error' && (
              <div>
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">❌</span>
                  <h3 className="text-lg font-semibold text-red-300">Error</h3>
                </div>
                <p className="text-slate-300 mb-4">{jobStatus.error}</p>
                <button
                  onClick={() => {
                    setJobId(null)
                    setJobStatus(null)
                    setFile(null)
                  }}
                  className="px-6 py-2 rounded-full bg-slate-800 text-slate-100 font-semibold hover:bg-slate-700 transition"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
