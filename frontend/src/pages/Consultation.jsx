import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './Consultation.css';

const Consultation = () => {
  const { appointmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultation, setConsultation] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isVideoActive, setIsVideoActive] = useState(true);
  const [isAudioActive, setIsAudioActive] = useState(true);
  const [transcription, setTranscription] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Refs
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // STUN servers for WebRTC (free public servers)
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    fetchConsultation();
    initializeTranscription();

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (consultation?.roomId) {
      initializeSocket();
    }
  }, [consultation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const cleanup = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Stop transcription
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const fetchConsultation = async () => {
    try {
      const response = await api.get(`/appointments/${appointmentId}`);
      setAppointment(response.data.appointment);
      setConsultation(response.data.consultation);
      if (response.data.consultation) {
        setMessages(response.data.consultation.chatMessages || []);
        setTranscription(response.data.consultation.transcription || []);
      }
    } catch (error) {
      console.error('Error fetching consultation:', error);
    }
  };

  const initializeSocket = () => {
    if (!consultation?.roomId || socketRef.current) return;

    const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('join-room', consultation.roomId);
      setConnectionStatus('connected');
    });

    socket.on('user-joined', async ({ userId }) => {
      console.log('User joined:', userId);
      // If we already have a local stream, create offer
      if (localStreamRef.current && !peerConnectionRef.current) {
        await createPeerConnection();
        await createOffer();
      }
    });

    socket.on('webrtc-offer', async ({ offer, userId }) => {
      console.log('Received offer from:', userId);
      if (!peerConnectionRef.current) {
        await createPeerConnection();
      }
      await handleOffer(offer);
    });

    socket.on('webrtc-answer', async ({ answer, userId }) => {
      console.log('Received answer from:', userId);
      if (peerConnectionRef.current) {
        await handleAnswer(answer);
      }
    });

    socket.on('webrtc-ice-candidate', async ({ candidate, userId }) => {
      console.log('Received ICE candidate from:', userId);
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    socket.on('user-left', ({ userId }) => {
      console.log('User left:', userId);
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      setIsCallActive(false);
      setConnectionStatus('disconnected');
    });

    socket.on('chat-message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnectionStatus('disconnected');
    });
  };

  const initializeVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsVideoActive(true);
      setIsAudioActive(true);
      setIsCallActive(true);

      // If socket is connected and we have a room, create peer connection
      if (socketRef.current && consultation?.roomId && !peerConnectionRef.current) {
        await createPeerConnection();
        // Wait a bit for other user to join, then create offer
        setTimeout(async () => {
          await createOffer();
        }, 1000);
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  };

  const createPeerConnection = async () => {
    try {
      const pc = new RTCPeerConnection(iceServers);
      peerConnectionRef.current = pc;

      // Add local stream tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Received remote stream');
        const remoteStream = event.streams[0];
        remoteStreamRef.current = remoteStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        setIsCallActive(true);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current && consultation?.roomId) {
          socketRef.current.emit('webrtc-ice-candidate', {
            roomId: consultation.roomId,
            candidate: event.candidate,
          });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        setConnectionStatus(pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setIsCallActive(false);
        }
      };

      return pc;
    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current || !socketRef.current || !consultation?.roomId) return;

    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      socketRef.current.emit('webrtc-offer', {
        roomId: consultation.roomId,
        offer: offer,
      });

      console.log('Offer created and sent');
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleOffer = async (offer) => {
    if (!peerConnectionRef.current || !socketRef.current || !consultation?.roomId) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      socketRef.current.emit('webrtc-answer', {
        roomId: consultation.roomId,
        answer: answer,
      });

      console.log('Answer created and sent');
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Answer received and set');
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const initializeTranscription = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          }
        }

        if (finalTranscript) {
          const transcriptionEntry = {
            speaker: user.role,
            text: finalTranscript.trim(),
            timestamp: new Date(),
          };
          setTranscription((prev) => [...prev, transcriptionEntry]);
          saveTranscription(transcriptionEntry);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };

      recognitionRef.current = recognition;
    }
  };

  const startTranscription = () => {
    if (recognitionRef.current && !isTranscribing) {
      recognitionRef.current.start();
      setIsTranscribing(true);
    }
  };

  const stopTranscription = () => {
    if (recognitionRef.current && isTranscribing) {
      recognitionRef.current.stop();
      setIsTranscribing(false);
    }
  };

  const saveTranscription = async (entry) => {
    try {
      if (consultation?.roomId) {
        await api.post(`/consultations/${consultation.roomId}/transcription`, entry);
      }
    } catch (error) {
      console.error('Error saving transcription:', error);
    }
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !socketRef.current || !consultation) return;

    const messageData = {
      roomId: consultation.roomId,
      senderId: user.id,
      senderRole: user.role,
      message: messageInput.trim(),
    };

    socketRef.current.emit('chat-message', messageData);
    setMessageInput('');
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoActive;
        setIsVideoActive(!isVideoActive);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioActive;
        setIsAudioActive(!isAudioActive);
      }
    }
  };

  const startConsultation = async () => {
    try {
      await api.post(`/consultations/${consultation.roomId}/start`);
      await initializeVideo();
      startTranscription();
    } catch (error) {
      console.error('Error starting consultation:', error);
    }
  };

  const endConsultation = async () => {
    try {
      stopTranscription();
      await api.post(`/consultations/${consultation.roomId}/end`);
      
      if (socketRef.current && consultation?.roomId) {
        socketRef.current.emit('leave-room', consultation.roomId);
      }
      
      cleanup();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error ending consultation:', error);
      cleanup();
      navigate('/dashboard');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!consultation || !appointment) {
    return <div className="loading">Loading consultation...</div>;
  }

  return (
    <div className="consultation">
      <div className="consultation-header">
        <h2>
          Consultation with{' '}
          {user.role === 'patient'
            ? `Dr. ${appointment.doctorId?.firstName} ${appointment.doctorId?.lastName}`
            : `${appointment.patientId?.firstName} ${appointment.patientId?.lastName}`}
        </h2>
        <div className="header-info">
          <span className={`connection-status status-${connectionStatus}`}>
            {connectionStatus}
          </span>
          <button onClick={endConsultation} className="btn-end">
            End Consultation
          </button>
        </div>
      </div>

      <div className="consultation-content">
        <div className="video-section">
          <div className="video-container">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
            />
            {!isCallActive && (
              <div className="video-placeholder">
                <p>Waiting for other participant...</p>
              </div>
            )}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video"
            />
          </div>
          <div className="video-controls">
            {!isCallActive && consultation.status === 'scheduled' && (
              <button onClick={startConsultation} className="btn-start">
                Start Video Call
              </button>
            )}
            {isCallActive && (
              <>
                <button
                  onClick={toggleVideo}
                  className={`control-btn ${isVideoActive ? 'active' : ''}`}
                >
                  {isVideoActive ? '📹' : '📹❌'} Video
                </button>
                <button
                  onClick={toggleAudio}
                  className={`control-btn ${isAudioActive ? 'active' : ''}`}
                >
                  {isAudioActive ? '🎤' : '🎤❌'} Audio
                </button>
                <button
                  onClick={isTranscribing ? stopTranscription : startTranscription}
                  className={`control-btn ${isTranscribing ? 'active' : ''}`}
                >
                  {isTranscribing ? '⏹️' : '🎙️'} Transcription
                </button>
              </>
            )}
          </div>
        </div>

        <div className="sidebar">
          <div className="chat-section">
            <h3>Chat</h3>
            <div className="messages-container">
              {messages.length === 0 ? (
                <p className="empty-message">No messages yet. Start the conversation!</p>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`message ${
                      msg.senderRole === user.role ? 'own' : 'other'
                    }`}
                  >
                    <div className="message-header">
                      <strong>
                        {msg.senderRole === 'patient' ? 'Patient' : 'Doctor'}
                      </strong>
                      <span className="timestamp">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-text">{msg.message}</div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                disabled={!socketRef.current}
              />
              <button onClick={sendMessage} className="btn-send" disabled={!socketRef.current}>
                Send
              </button>
            </div>
          </div>

          <div className="transcription-section">
            <h3>Transcription</h3>
            <div className="transcription-container">
              {transcription.length === 0 ? (
                <p className="empty-transcription">
                  Transcription will appear here when enabled
                </p>
              ) : (
                transcription.map((entry, idx) => (
                  <div key={idx} className="transcription-entry">
                    <div className="transcription-header">
                      <strong>{entry.speaker === 'patient' ? 'Patient' : 'Doctor'}</strong>
                      <span>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="transcription-text">{entry.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Consultation;
