'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

export function PatientDashboard() {
  const router = useRouter()
  const [username, setUsername] = useState('')

  const handleLogout = () => {
    localStorage.removeItem('rxify_access_token')
    localStorage.removeItem('rxify_user_role')
    router.push('/login')
  }

  const dashboardOptions = [
    {
      id: 'upload-ocr',
      title: 'Upload Prescription',
      description: 'Use OCR to extract prescription data from an image',
      icon: '📷',
      color: 'from-cyan-500 to-blue-500',
      href: '/upload',
    },
    {
      id: 'my-prescriptions',
      title: 'My Prescriptions',
      description: 'View all your uploaded prescriptions and their details',
      icon: '📋',
      color: 'from-purple-500 to-pink-500',
      href: '/prescriptions',
    },
    {
      id: 'connect-doctor',
      title: 'Connect with Doctor',
      description: 'Request access from a doctor to review your prescriptions',
      icon: '👨‍⚕️',
      color: 'from-green-500 to-emerald-500',
      href: '/connect-doctor',
    },
    {
      id: 'my-requests',
      title: 'My Requests',
      description: 'View pending and accepted doctor connection requests',
      icon: '📬',
      color: 'from-orange-500 to-red-500',
      href: '/my-requests',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-100 mb-2">Patient Dashboard</h1>
            <p className="text-slate-400">Manage your prescriptions and medical connections</p>
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
          <h2 className="text-xl font-semibold text-cyan-300 mb-2">Welcome back!</h2>
          <p className="text-slate-300">
            Start by uploading your prescription for OCR analysis, or manage your existing medical records and doctor connections.
          </p>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
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
                  Get started <span className="ml-2">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Stats Section */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-slate-100 mb-6">Quick Stats</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4 text-center">
              <p className="text-2xl font-bold text-cyan-400 mb-1">0</p>
              <p className="text-sm text-slate-400">Prescriptions</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4 text-center">
              <p className="text-2xl font-bold text-purple-400 mb-1">0</p>
              <p className="text-sm text-slate-400">Connected Doctors</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4 text-center">
              <p className="text-2xl font-bold text-green-400 mb-1">0</p>
              <p className="text-sm text-slate-400">Pending Requests</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
