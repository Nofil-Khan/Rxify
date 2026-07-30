'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DoctorDashboard } from '@/components/dashboard/doctor-dashboard'
import { PatientDashboard } from '@/components/dashboard/patient-dashboard'

export default function DashboardPage() {
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedRole = localStorage.getItem('rxify_user_role')
    const token = localStorage.getItem('rxify_access_token')

    if (!token) {
      router.push('/login')
      return
    }

    if (storedRole) {
      setRole(storedRole)
    }
    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-cyan-300 text-lg">Loading dashboard...</div>
      </div>
    )
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-300 text-lg">Unable to determine user role</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {role === 'patient' && <PatientDashboard />}
      {role === 'doctor' && <DoctorDashboard />}
    </div>
  )
}
