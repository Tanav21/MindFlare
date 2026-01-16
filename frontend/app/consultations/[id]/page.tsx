'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import VideoCall from '@/components/VideoCall'
import Chat from '@/components/Chat'
import Transcription from '@/components/Transcription'
import Link from 'next/link'

interface Consultation {
  id: string
  roomId: string
  status: string
  paymentStatus: string
  specialty: { name: string }
  scheduledAt: string
  startedAt: string | null
  endedAt: string | null
}

export default function ConsultationPage() {
  const router = useRouter()
  const params = useParams()
  const consultationId = params.id as string
  const { isAuthenticated, user } = useAuthStore()
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [loading, setLoading] = useState(true)
  const [inCall, setInCall] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    fetchConsultation()
  }, [isAuthenticated, router, consultationId])

  const fetchConsultation = async () => {
    try {
      const response = await api.get(`/consultations/${consultationId}`)
      setConsultation(response.data)
    } catch (error: any) {
      console.error('Error fetching consultation:', error)
      if (error.response?.status === 404) {
        router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  const startConsultation = async () => {
    try {
      await api.patch(`/consultations/${consultationId}/status`, {
        status: 'IN_PROGRESS',
      })
      setInCall(true)
      fetchConsultation()
    } catch (error) {
      console.error('Error starting consultation:', error)
    }
  }

  const endConsultation = async () => {
    try {
      await api.patch(`/consultations/${consultationId}/status`, {
        status: 'COMPLETED',
      })
      setInCall(false)
      fetchConsultation()
      router.push('/dashboard')
    } catch (error) {
      console.error('Error ending consultation:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  if (!consultation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Consultation not found</div>
      </div>
    )
  }

  if (consultation.paymentStatus !== 'COMPLETED') {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <Link href="/dashboard" className="text-2xl font-bold text-primary-600">
              MindFlare Telehealth
            </Link>
          </div>
        </nav>
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-xl mb-4">Payment required to start consultation</p>
          <Link
            href={`/consultations/${consultationId}/payment`}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Complete Payment
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-2xl font-bold text-primary-600">
            MindFlare Telehealth
          </Link>
          <div className="text-sm text-gray-600">
            {consultation.specialty.name} - {consultation.status}
          </div>
        </div>
      </nav>

      {!inCall && consultation.status !== 'COMPLETED' ? (
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Consultation Ready</h2>
            <p className="text-gray-600 mb-4">
              Scheduled for: {new Date(consultation.scheduledAt).toLocaleString()}
            </p>
            <p className="text-gray-600 mb-6">
              Status: {consultation.status}
            </p>
            <button
              onClick={startConsultation}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Start Consultation
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-[calc(100vh-73px)]">
          <div className="flex-1 flex">
            <div className="flex-1">
              <VideoCall
                roomId={consultation.roomId}
                consultationId={consultationId}
                onEndCall={endConsultation}
              />
              <Transcription roomId={consultation.roomId} consultationId={consultationId} />
            </div>
            <div className="w-80">
              <Chat roomId={consultation.roomId} consultationId={consultationId} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
