'use client'

import { useEffect, useRef, useState } from 'react'
import Peer from 'simple-peer'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/authStore'

interface VideoCallProps {
  roomId: string
  consultationId: string
  onEndCall: () => void
}

export default function VideoCall({ roomId, consultationId, onEndCall }: VideoCallProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [peers, setPeers] = useState<{ [key: string]: Peer.Instance }>({})
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({})
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const peersRef = useRef<{ [key: string]: Peer.Instance }>({})
  const { token, user } = useAuthStore()

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
      auth: { token },
    })

    newSocket.on('connect', () => {
      console.log('Socket connected')
      newSocket.emit('join-consultation', roomId)
    })

    // Get user media
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Listen for other users joining
        newSocket.on('user-joined', (data: { userId: string }) => {
          if (data.userId !== user?.id) {
            createPeer(data.userId, stream, false, newSocket)
          }
        })

        // Handle incoming call
        newSocket.on('webrtc-offer', async (data: { offer: any; from: string }) => {
          if (data.from !== user?.id) {
            const peer = createPeer(data.from, stream, true, newSocket)
            peer.signal(data.offer)
          }
        })

        // Handle answer
        newSocket.on('webrtc-answer', (data: { answer: any; from: string }) => {
          if (peersRef.current[data.from]) {
            peersRef.current[data.from].signal(data.answer)
          }
        })

        // Handle ICE candidates
        newSocket.on('webrtc-ice-candidate', (data: { candidate: any; from: string }) => {
          if (peersRef.current[data.from]) {
            peersRef.current[data.from].signal(data.candidate)
          }
        })
      })
      .catch((error) => {
        console.error('Error accessing media devices:', error)
      })

    setSocket(newSocket)

    return () => {
      newSocket.emit('leave-consultation', roomId)
      newSocket.disconnect()
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
      Object.values(peersRef.current).forEach((peer) => peer.destroy())
    }
  }, [roomId, token, user?.id])

  const createPeer = (
    userId: string,
    stream: MediaStream,
    initiator: boolean,
    socket: Socket
  ): Peer.Instance => {
    const peer = new Peer({
      initiator,
      trickle: false,
      stream,
    })

    peer.on('signal', (data) => {
      if (initiator) {
        socket.emit('webrtc-offer', { roomId, offer: data })
      } else {
        socket.emit('webrtc-answer', { roomId, answer: data })
      }
    })

    peer.on('stream', (remoteStream) => {
      setRemoteStreams((prev) => ({ ...prev, [userId]: remoteStream }))
    })

    peer.on('error', (error) => {
      console.error('Peer error:', error)
    })

    peersRef.current[userId] = peer
    setPeers((prev) => ({ ...prev, [userId]: peer }))

    return peer
  }

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted
      })
      setIsMuted(!isMuted)
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff
      })
      setIsVideoOff(!isVideoOff)
    }
  }

  const handleEndCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }
    Object.values(peersRef.current).forEach((peer) => peer.destroy())
    if (socket) {
      socket.emit('leave-consultation', roomId)
      socket.disconnect()
    }
    onEndCall()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-black">
        {/* Local video */}
        <div className="relative rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
            You {isMuted && '(Muted)'} {isVideoOff && '(Video Off)'}
          </div>
        </div>

        {/* Remote videos */}
        {Object.entries(remoteStreams).map(([userId, stream]) => (
          <div key={userId} className="relative rounded-lg overflow-hidden">
            <video
              autoPlay
              playsInline
              ref={(video) => {
                if (video) video.srcObject = stream
              }}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white p-4 flex justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`px-4 py-2 rounded-lg ${
            isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          onClick={toggleVideo}
          className={`px-4 py-2 rounded-lg ${
            isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          {isVideoOff ? 'Turn On Video' : 'Turn Off Video'}
        </button>
        <button
          onClick={handleEndCall}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          End Call
        </button>
      </div>
    </div>
  )
}
