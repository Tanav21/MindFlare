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
  const [socket, setSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    fetchConsultation();
    initializeVideo();
    initializeTranscription();

    return () => {
      if (socket) socket.disconnect();
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
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
    if (!consultation?.roomId) return;
    
    const newSocket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-room', consultation.roomId);
    });

    newSocket.on('chat-message', (data) => {
      setMessages((prev) => [...prev, data]);
    });
  };

  const initializeVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
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
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
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
      await api.post(`/consultations/${consultation.roomId}/transcription`, entry);
    } catch (error) {
      console.error('Error saving transcription:', error);
    }
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !socket || !consultation) return;

    const messageData = {
      roomId: consultation.roomId,
      senderId: user.id,
      senderRole: user.role,
      message: messageInput.trim(),
    };

    socket.emit('chat-message', messageData);
    setMessageInput('');
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoActive;
        setIsVideoActive(!isVideoActive);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioActive;
        setIsAudioActive(!isAudioActive);
      }
    }
  };

  const startConsultation = async () => {
    try {
      await api.post(`/consultations/${consultation.roomId}/start`);
      startTranscription();
    } catch (error) {
      console.error('Error starting consultation:', error);
    }
  };

  const endConsultation = async () => {
    try {
      stopTranscription();
      await api.post(`/consultations/${consultation.roomId}/end`);
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      navigate('/dashboard');
    } catch (error) {
      console.error('Error ending consultation:', error);
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
        <button onClick={endConsultation} className="btn-end">
          End Consultation
        </button>
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
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video"
            />
          </div>
          <div className="video-controls">
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
            {consultation.status === 'scheduled' && (
              <button onClick={startConsultation} className="btn-start">
                Start Consultation
              </button>
            )}
          </div>
        </div>

        <div className="sidebar">
          <div className="chat-section">
            <h3>Chat</h3>
            <div className="messages-container">
              {messages.map((msg, idx) => (
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
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
              />
              <button onClick={sendMessage} className="btn-send">
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
