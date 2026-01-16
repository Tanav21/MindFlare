'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

interface Message {
  id: string
  senderId: string
  senderRole: string
  content: string
  createdAt: string
}

interface ChatProps {
  roomId: string
  consultationId: string
}

export default function Chat({ roomId, consultationId }: ChatProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { token, user } = useAuthStore()

  useEffect(() => {
    // Initialize socket
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
      auth: { token },
    })

    newSocket.on('connect', () => {
      newSocket.emit('join-consultation', roomId)
    })

    newSocket.on('new-message', (message: Message) => {
      setMessages((prev) => [...prev, message])
    })

    setSocket(newSocket)

    // Load existing messages
    loadMessages()

    return () => {
      newSocket.disconnect()
    }
  }, [roomId, token])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    try {
      const response = await api.get(`/consultations/${consultationId}`)
      setMessages(response.data.messages || [])
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !socket) return

    socket.emit('send-message', {
      roomId,
      content: newMessage.trim(),
    })

    setNewMessage('')
  }

  return (
    <div className="flex flex-col h-full bg-white border-l">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Chat</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.senderId === user?.id ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                message.senderId === user?.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {new Date(message.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
