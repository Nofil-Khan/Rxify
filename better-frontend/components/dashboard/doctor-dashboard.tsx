'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

interface DoctorStats {
  assigned_patients: number
  total_prescriptions: number
  pending_requests: number
  upcoming_follow_ups: number
}

export function DoctorDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<DoctorStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('rxify_access_token')
        const response = await fetch(`${apiBase}/api/doctor/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('rxify_access_token')
    localStorage.removeItem('rxify_user_role')
    router.push('/login')
  }

  const dashboardOptions = [
    {
      id: 'my-patients',
      title: 'My Patients',
      description: 'View and manage your assigned patients and their prescriptions',
      icon: '👥',
      color: 'from-cyan-500 to-blue-500',
      href: '/doctor/patients',
    },
    {
      id: 'pending-requests',
      title: 'Pending Requests',
      description: 'Review and respond to patient connection requests',
      icon: '📨',
      color: 'from-purple-500 to-pink-500',
      href: '/doctor/requests',
    },
    {
      id: 'prescriptions',
      title: 'Patient Prescriptions',
      description: 'Review prescriptions from your connected patients',
      icon: '📄',
      color: 'from-green-500 to-emerald-500',
      href: '/doctor/prescriptions',
    },
    {
      id: 'profile',
      title: 'My Profile',
      description: 'Update your profile information and credentials',
      icon: '👤',
      color: 'from-orange-500 to-red-500',
      href: '/doctor/profile',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-100 mb-2">Doctor Dashboard</h1>
            <p className="text-slate-400">Manage your patients and review prescriptions</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2 rounded-full bg-red-500/20 border border-red-500/50 text-red-200 hover:bg-red-500/30 transition"
          >
            Logout
          </button>
        </div>

        {/* Welcome Banner */}
        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-8 backdrop-blur-sm mb-12">
          <h2 className="text-xl font-semibold text-cyan-300 mb-2">Welcome back, Doctor!</h2>
          <p className="text-slate-300">
            View your patient connections, review prescription OCR data, and respond to new connection requests.
          </p>
        </div>
      </div>

      {/* Stats Section */}
      {!loading && stats && (
        <div className="max-w-7xl mx-auto mb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-6 text-center">
              <p className="text-3xl font-bold text-cyan-400 mb-2">{stats.assigned_patients}</p>
              <p className="text-sm text-slate-400">Assigned Patients</p>
            </div>
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6 text-center">
              <p className="text-3xl font-bold text-purple-400 mb-2">{stats.total_prescriptions}</p>
              <p className="text-sm text-slate-400">Total Prescriptions</p>
            </div>
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-6 text-center">
              <p className="text-3xl font-bold text-orange-400 mb-2">{stats.pending_requests}</p>
              <p className="text-sm text-slate-400">Pending Requests</p>
            </div>
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6 text-center">
              <p className="text-3xl font-bold text-green-400 mb-2">{stats.upcoming_follow_ups}</p>
              <p className="text-sm text-slate-400">Follow-ups (7 days)</p>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dashboardOptions.map((option) => (
            <Link key={option.id} href={option.href}>
              <div className="group h-full rounded-2xl border border-white/10 bg-slate-900/50 p-8 hover:border-white/30 hover:bg-slate-900/80 transition cursor-pointer backdrop-blur-sm">
                <div className="flex items-start justify-between mb-6">
                  <div className={`text-5xl mb-4`}>{option.icon}</div>
                  <div className={`w-1 h-12 bg-gradient-to-b ${option.color} rounded-full`}></div>
                </div>
                <h3 className="text-xl font-semibold text-slate-100 mb-2 group-hover:text-cyan-300 transition">
                  {option.title}
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                  {option.description}
                </p>
                <div className="flex items-center text-cyan-400 text-sm font-medium group-hover:translate-x-2 transition">
                  View <span className="ml-2">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
