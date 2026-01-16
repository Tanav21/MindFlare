'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import Link from 'next/link'

const bookingSchema = z.object({
  specialtyId: z.string().min(1, 'Please select a specialty'),
  scheduledAt: z.string().min(1, 'Please select a date and time'),
  amount: z.number().min(1, 'Amount must be greater than 0'),
})

type BookingForm = z.infer<typeof bookingSchema>

interface Specialty {
  id: string
  name: string
  description: string | null
}

export default function BookConsultationPage() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      amount: 50, // Default consultation fee
    },
  })

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'PATIENT') {
      router.push('/auth/login')
      return
    }

    fetchSpecialties()
  }, [isAuthenticated, user, router])

  const fetchSpecialties = async () => {
    try {
      const response = await api.get('/specialties')
      setSpecialties(response.data)
    } catch (error) {
      console.error('Error fetching specialties:', error)
    }
  }

  const onSubmit = async (data: BookingForm) => {
    setLoading(true)
    setError('')

    try {
      const response = await api.post('/consultations', data)
      router.push(`/consultations/${response.data.id}/payment`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to book consultation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-2xl font-bold text-primary-600">
            MindFlare Telehealth
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Book Consultation</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Specialty
            </label>
            <select
              {...register('specialtyId')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Choose a specialty...</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </select>
            {errors.specialtyId && (
              <p className="text-red-500 text-sm mt-1">{errors.specialtyId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date & Time
            </label>
            <input
              {...register('scheduledAt')}
              type="datetime-local"
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.scheduledAt && (
              <p className="text-red-500 text-sm mt-1">{errors.scheduledAt.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Consultation Fee (USD)
            </label>
            <input
              {...register('amount', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.amount && (
              <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
            )}
          </div>

          <div className="flex gap-4">
            <Link
              href="/dashboard"
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
            >
              {loading ? 'Booking...' : 'Continue to Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
