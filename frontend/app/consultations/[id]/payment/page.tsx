'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import Link from 'next/link'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
)

interface Consultation {
  id: string
  amount: number
  specialty: { name: string }
  scheduledAt: string
}

function PaymentForm() {
  const router = useRouter()
  const params = useParams()
  const consultationId = params.id as string
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [consultation, setConsultation] = useState<Consultation | null>(null)

  useEffect(() => {
    fetchConsultation()
  }, [])

  const fetchConsultation = async () => {
    try {
      const response = await api.get(`/consultations/${consultationId}`)
      setConsultation(response.data)
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load consultation')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError('')

    try {
      // Create payment intent
      const { data } = await api.post('/payments/create-intent', {
        consultationId,
        amount: consultation?.amount || 0,
      })

      // Confirm payment
      const { error: confirmError } = await stripe.confirmCardPayment(
        data.clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        }
      )

      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
      } else {
        router.push(`/consultations/${consultationId}`)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Payment failed')
    } finally {
      setLoading(false)
    }
  }

  if (!consultation) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Consultation Details</h3>
        <p className="text-gray-600">Specialty: {consultation.specialty.name}</p>
        <p className="text-gray-600">
          Scheduled: {new Date(consultation.scheduledAt).toLocaleString()}
        </p>
        <p className="text-2xl font-bold text-primary-600 mt-2">
          ${consultation.amount}
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="border border-gray-300 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Details
        </label>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
            },
          }}
        />
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
          disabled={!stripe || loading}
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
        >
          {loading ? 'Processing...' : `Pay $${consultation.amount}`}
        </button>
      </div>
    </form>
  )
}

export default function PaymentPage() {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, router])

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Stripe is not configured</p>
          <p className="text-gray-600">
            Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your environment variables
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-2xl font-bold text-primary-600">
            MindFlare Telehealth
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Complete Payment</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <Elements stripe={stripePromise}>
            <PaymentForm />
          </Elements>
        </div>
      </div>
    </div>
  )
}
