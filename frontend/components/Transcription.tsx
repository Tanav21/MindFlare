// 'use client'

// import { useEffect, useState, useRef } from 'react'
// import { io, Socket } from 'socket.io-client'
// import { useAuthStore } from '@/store/authStore'
// import { api } from '@/lib/api'

// interface TranscriptionProps {
//   roomId: string
//   consultationId: string 
// }

// export default function Transcription({ roomId, consultationId }: TranscriptionProps) {
//   const [socket, setSocket] = useState<Socket | null>(null)
//   const [transcription, setTranscription] = useState('')
//   const [isListening, setIsListening] = useState(false)
//   const recognitionRef = useRef<SpeechRecognition | null>(null)
//   const { token } = useAuthStore()

//   useEffect(() => {
//     // Initialize socket
//     const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
//       auth: { token },
//     })

//     newSocket.on('connect', () => {
//       newSocket.emit('join-consultation', roomId)
//     })

//     newSocket.on('transcription-update', (data: { text: string }) => {
//       setTranscription((prev) => prev + ' ' + data.text)
//     })

//     setSocket(newSocket)

//     // Initialize Web Speech API
//     if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
//       const SpeechRecognition =
//         (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
//       const recognition = new SpeechRecognition()

//       recognition.continuous = true
//       recognition.interimResults = true
//       recognition.lang = 'en-US'

//       recognition.onresult = (event: SpeechRecognitionEvent) => {
//         let interimTranscript = ''
//         let finalTranscript = ''

//         for (let i = event.resultIndex; i < event.results.length; i++) {
//           const transcript = event.results[i][0].transcript
//           if (event.results[i].isFinal) {
//             finalTranscript += transcript + ' '
//           } else {
//             interimTranscript += transcript
//           }
//         }

//         if (finalTranscript && socket) {
//           socket.emit('transcription-update', {
//             roomId,
//             text: finalTranscript.trim(),
//           })
//           setTranscription((prev) => prev + ' ' + finalTranscript.trim())
//         }
//       }

//       recognition.onerror = (event: any) => {
//         console.error('Speech recognition error:', event.error)
//       }

//       recognitionRef.current = recognition
//     }

//     return () => {
//       if (recognitionRef.current) {
//         recognitionRef.current.stop()
//       }
//       newSocket.disconnect()
//     }
//   }, [roomId, token])

//   const toggleListening = () => {
//     if (!recognitionRef.current) {
//       alert('Speech recognition is not supported in your browser')
//       return
//     }

//     if (isListening) {
//       recognitionRef.current.stop()
//       setIsListening(false)
//     } else {
//       recognitionRef.current.start()
//       setIsListening(true)
//     }
//   }

//   return (
//     <div className="bg-white border-t p-4">
//       <div className="flex justify-between items-center mb-2">
//         <h3 className="font-semibold">Live Transcription</h3>
//         <button
//           onClick={toggleListening}
//           className={`px-3 py-1 rounded text-sm ${
//             isListening
//               ? 'bg-red-500 text-white'
//               : 'bg-primary-600 text-white'
//           }`}
//         >
//           {isListening ? 'Stop' : 'Start'} Transcription
//         </button>
//       </div>
//       <div className="bg-gray-50 p-3 rounded-lg max-h-32 overflow-y-auto">
//         <p className="text-sm text-gray-700">
//           {transcription || 'Transcription will appear here...'}
//         </p>
//       </div>
//       <p className="text-xs text-gray-500 mt-2">
//         Note: Transcription helps overcome dialect and accent challenges during remote consultations
//       </p>
//     </div>
//   )
// }



'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/authStore'



interface TranscriptionProps {
  roomId: string
}

interface TranscriptionEvent {
  text: string
  senderRole: 'doctor' | 'patient'
  timestamp: string
}

export default function Transcription({ roomId }: TranscriptionProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [transcription, setTranscription] = useState<TranscriptionEvent[]>([])
  const [isListening, setIsListening] = useState(false)
  const isListeningRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const { token, user } = useAuthStore()

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
      auth: { token },
    })

    s.emit('join-room', roomId)

    // Receive transcription ONLY from socket
    s.on('transcription-update', (data: TranscriptionEvent) => {
      setTranscription(prev => [...prev, data])
    })

    setSocket(s)

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onresult = (event: SpeechRecognitionEvent) => {
  let finalText = ''

  for (let i = event.resultIndex; i < event.results.length; i++) {
    if (event.results[i].isFinal) {
      finalText += event.results[i][0].transcript + ' '
    }
  }

  if (finalText.trim()) {
    s.emit('transcription-update', {
      roomId,
      text: finalText.trim(),
      senderRole: user.role, // ✅ FIX
    })
  }
}

recognition.onend = () => {
  if (isListeningRef.current) {
    recognition.start()
  }
}



      recognitionRef.current = recognition
    }

    return () => {
      recognitionRef.current?.stop()
      s.off('transcription-update')
      s.disconnect()
    }
  }, [roomId, token,user?.role])

  // const toggleListening = () => {
  //   if (!recognitionRef.current) {
  //     alert('Speech recognition not supported')
  //     return
  //   }

  //   if (isListening) {
  //     recognitionRef.current.stop()
  //   } else {
  //     recognitionRef.current.start()
  //   }

  //   setIsListening(!isListening)
  // }

  const toggleListening = () => {
  if (!recognitionRef.current) return

  if (isListeningRef.current) {
    isListeningRef.current = false
    recognitionRef.current.stop()
    setIsListening(false)
  } else {
    isListeningRef.current = true
    recognitionRef.current.start()
    setIsListening(true)
  }
}



  return (
    <div className="bg-white border-t p-4">
      <div className="flex justify-between mb-2">
        <h3 className="font-semibold">Live Transcription</h3>
        <button
          onClick={toggleListening}
          className={`px-3 py-1 rounded text-sm ${
            isListening ? 'bg-red-500' : 'bg-primary-600'
          } text-white`}
        >
          {isListening ? 'Stop' : 'Start'}
        </button>
      </div>

      <div className="bg-gray-50 p-3 rounded max-h-40 overflow-y-auto space-y-1">
        {transcription.length === 0 && (
          <p className="text-sm text-gray-500">
            Transcription will appear here…
          </p>
        )}

        {transcription.map((t, i) => (
          <p key={i} className="text-sm">
            <strong>{t.senderRole}:</strong> {t.text}
          </p>
        ))}
      </div>
    </div>
  )
}
