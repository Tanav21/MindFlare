'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import Link from 'next/link'

interface Consultation {
  id: string
  status: string
  scheduledAt: string
  specialty: { name: string }
  patient?: { firstName: string; lastName: string }
  doctor?: { firstName: string; lastName: string }
  amount: number
  paymentStatus: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    fetchConsultations()
  }, [isAuthenticated, router])

  const fetchConsultations = async () => {
    try {
      const response = await api.get('/consultations')
      setConsultations(response.data)
    } catch (error) {
      console.error('Error fetching consultations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    useAuthStore.getState().clearAuth()
    router.push('/')
  }

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary-600">MindFlare Telehealth</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">
              {user.firstName} {user.lastName} ({user.role})
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          {user.role === 'PATIENT' && (
            <Link
              href="/consultations/book"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              Book Consultation
            </Link>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : consultations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No consultations found</p>
            {user.role === 'PATIENT' && (
              <Link
                href="/consultations/book"
                className="text-primary-600 hover:underline"
              >
                Book your first consultation
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {consultations.map((consultation) => (
              <div
                key={consultation.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      {consultation.specialty.name}
                    </h3>
                    <p className="text-gray-600 mb-1">
                      Scheduled: {new Date(consultation.scheduledAt).toLocaleString()}
                    </p>
                    <p className="text-gray-600 mb-1">
                      Status: <span className="font-medium">{consultation.status}</span>
                    </p>
                    <p className="text-gray-600 mb-1">
                      Payment: <span className="font-medium">{consultation.paymentStatus}</span>
                    </p>
                    {consultation.doctor && (
                      <p className="text-gray-600">
                        Doctor: {consultation.doctor.firstName} {consultation.doctor.lastName}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600 mb-4">
                      ${consultation.amount}
                    </p>
                    {consultation.paymentStatus === 'COMPLETED' &&
                      consultation.status !== 'COMPLETED' && (
                        <Link
                          href={`/consultations/${consultation.id}`}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                        >
                          Join Consultation
                        </Link>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
