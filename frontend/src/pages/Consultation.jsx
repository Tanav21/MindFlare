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
  const [isCallActive, setIsCallActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Refs
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const remoteStreamsRef = useRef({}); // userId -> MediaStream (for handling multiple tracks)
  const peersRef = useRef({});
  const iceCandidateQueueRef = useRef({}); // userId -> array of candidates
  const connectionStateRef = useRef({}); // Track connection states for logging

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const cleanup = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    Object.values(peersRef.current).forEach((peerConnection) => {
      if (peerConnection && peerConnection.close) {
        peerConnection.close();
      }
    });
    peersRef.current = {};

    // Clean up all remote streams
    Object.values(remoteStreamsRef.current).forEach((stream) => {
      stream.getTracks().forEach(track => track.stop());
    });
    remoteStreamsRef.current = {};

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }

    // Clean up queues and state
    iceCandidateQueueRef.current = {};
    connectionStateRef.current = {};

    // Stop transcription
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

    // Reset UI state
    setIsCallActive(false);
    setConnectionStatus('disconnected');
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

  const initializeSocket = async () => {
    if (!consultation?.roomId) return;
    
    // Disconnect existing socket if any
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    
    const newSocket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000');
    setSocket(newSocket);
    socketRef.current = newSocket; // Set ref for consistency
    setConnectionStatus('connecting');

    newSocket.on('connect', async () => {
      console.log('Socket connected:', newSocket.id);
      setConnectionStatus('connected');
      
      // Initialize video first and WAIT for it to complete
      await initializeVideo();
      
      // Verify stream exists before joining room
      if (localStreamRef.current && localStreamRef.current.getTracks().length > 0) {
        logWebRTCState('stream-ready', { tracks: localStreamRef.current.getTracks().length });
      newSocket.emit('join-room', consultation.roomId);
      } else {
        logWebRTCState('stream-not-ready', { error: 'Stream not available after initialization' });
        console.error('Stream not ready, cannot join room');
        setConnectionStatus('error');
      }
    });

    // Handle user joined - server assigns initiator role
    newSocket.on('user-joined', async (data) => {
      const { userId, isInitiator } = data;
      const stream = localStreamRef.current;
      logWebRTCState('user-joined', { userId, isInitiator, hasStream: !!stream, trackCount: stream?.getTracks().length || 0 });
      
      if (userId === newSocket.id) return; // Ignore self
      
      // BLOCK until local stream exists and has tracks
      const waitForStream = () => {
        const currentStream = localStreamRef.current;
        if (currentStream && currentStream.getTracks().length > 0) {
          // Verify tracks are active
          const activeTracks = currentStream.getTracks().filter(t => t.readyState === 'live');
          if (activeTracks.length > 0) {
            // Check if peer already exists
            if (!peersRef.current[userId]) {
              logWebRTCState('creating-peer-with-stream', { userId, activeTracks: activeTracks.length });
              createPeerConnection(userId, isInitiator, newSocket);
            } else {
              logWebRTCState('peer-already-exists', { userId });
            }
          } else {
            logWebRTCState('waiting-for-active-tracks', { userId });
            setTimeout(waitForStream, 100);
          }
        } else {
          logWebRTCState('waiting-for-stream', { userId });
          setTimeout(waitForStream, 100);
        }
      };
      waitForStream();
    });

    // Handle room ready (first user in room)
    newSocket.on('room-ready', (data) => {
      logWebRTCState('room-ready', data);
    });

    // Handle WebRTC offer - deterministic answer creation
    newSocket.on('webrtc-offer', (data) => {
      const { from, offer } = data;
      logWebRTCState('offer-received', { from, signalingState: peersRef.current[from]?.signalingState });
      
      if (from === newSocket.id) return; // Ignore self
      
      // BLOCK until local stream exists and has tracks
      const waitForStream = async () => {
        const stream = localStreamRef.current;
        if (stream && stream.getTracks().length > 0) {
          const activeTracks = stream.getTracks().filter(t => t.readyState === 'live');
          if (activeTracks.length > 0) {
            // Ensure peer connection exists
            if (!peersRef.current[from]) {
              logWebRTCState('creating-peer-for-offer', { from, activeTracks: activeTracks.length });
              createPeerConnection(from, false, newSocket);
            }
            
            // Set remote description and create answer deterministically
            const peerConnection = peersRef.current[from];
            if (peerConnection && peerConnection.signalingState !== 'closed') {
              try {
                // Set remote description first
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                logWebRTCState('remote-description-set', { from, state: peerConnection.signalingState });
                
                // Process queued ICE candidates
                processIceCandidateQueue(from, peerConnection);
                
                // Create and send answer
                const answer = await peerConnection.createAnswer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                await peerConnection.setLocalDescription(answer);
                logWebRTCState('answer-created', { from, state: peerConnection.signalingState });
                
                newSocket.emit('webrtc-answer', {
                  roomId: consultation.roomId,
                  answer: answer,
                  to: from,
                });
              } catch (error) {
                logWebRTCState('offer-error', { from, error: error.message });
                console.error('Error handling offer:', error);
              }
            }
          } else {
            logWebRTCState('waiting-for-active-tracks-offer', { from });
            setTimeout(waitForStream, 100);
          }
        } else {
          logWebRTCState('waiting-for-stream-offer', { from });
          setTimeout(waitForStream, 100);
        }
      };
      waitForStream();
    });

    // Handle WebRTC answer - deterministic processing
    newSocket.on('webrtc-answer', async (data) => {
      const { from, answer } = data;
      logWebRTCState('answer-received', { from, signalingState: peersRef.current[from]?.signalingState });
      
      const peerConnection = peersRef.current[from];
      if (peerConnection && peerConnection.signalingState !== 'closed') {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          logWebRTCState('answer-processed', { from, state: peerConnection.signalingState });
          
          // Process queued ICE candidates
          processIceCandidateQueue(from, peerConnection);
        } catch (error) {
          logWebRTCState('answer-error', { from, error: error.message });
          console.error('Error handling answer:', error);
        }
      } else {
        logWebRTCState('answer-rejected', { from, reason: 'no-peer-connection-or-closed' });
      }
    });

    // Handle ICE candidates - queue until remoteDescription is set
    newSocket.on('webrtc-ice-candidate', async (data) => {
      const { from, candidate } = data;
      logWebRTCState('ice-candidate-received', { 
        from, 
        hasRemoteDesc: !!peersRef.current[from]?.remoteDescription,
        signalingState: peersRef.current[from]?.signalingState 
      });
      
      const peerConnection = peersRef.current[from];
      
      if (!peerConnection) {
        logWebRTCState('ice-candidate-queued', { from, reason: 'no-peer-connection' });
        // Queue candidate
        if (!iceCandidateQueueRef.current[from]) {
          iceCandidateQueueRef.current[from] = [];
        }
        iceCandidateQueueRef.current[from].push(candidate);
        return;
      }
      
      if (!candidate) {
        return; // Null candidate means end of candidates
      }
      
      // If remote description is set, add immediately
      if (peerConnection.remoteDescription) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          logWebRTCState('ice-candidate-added', { from });
        } catch (error) {
          logWebRTCState('ice-candidate-error', { from, error: error.message });
          console.error('Error adding ICE candidate:', error);
        }
      } else {
        // Queue candidate until remote description is set
        logWebRTCState('ice-candidate-queued', { from, reason: 'no-remote-description' });
        if (!iceCandidateQueueRef.current[from]) {
          iceCandidateQueueRef.current[from] = [];
        }
        iceCandidateQueueRef.current[from].push(candidate);
      }
    });

    // Handle chat messages
    newSocket.on('chat-message', (data) => {
      // Prevent duplicate messages (if we already added it locally)
      setMessages((prev) => {
        // Check if message already exists (by senderId, message, and timestamp within 1 second)
        const exists = prev.some(
          (msg) =>
            msg.senderId === data.senderId &&
            msg.message === data.message &&
            Math.abs(new Date(msg.timestamp) - new Date(data.timestamp)) < 1000
        );
        if (exists) return prev;
        return [...prev, data];
      });
    });

    // Handle user left - prevent premature disconnection
    newSocket.on('user-left', (data) => {
      const { userId } = data;
      logWebRTCState('user-left', { userId });
      
      const peerConnection = peersRef.current[userId];
      if (peerConnection) {
        // Only close if connection is in a terminal state
        const state = peerConnection.connectionState;
        if (state === 'closed' || state === 'failed' || state === 'disconnected') {
          logWebRTCState('peer-closing', { userId, state });
          peerConnection.close();
        } else {
          // Wait for connection to close naturally or transition to failed
          logWebRTCState('peer-waiting-close', { userId, state });
          const checkState = () => {
            if (peerConnection.connectionState === 'closed' || 
                peerConnection.connectionState === 'failed') {
              peerConnection.close();
              delete peersRef.current[userId];
            } else if (peerConnection.connectionState !== 'closed') {
              setTimeout(checkState, 1000);
            }
          };
          checkState();
        }
        delete peersRef.current[userId];
      }
      
      // Clean up ICE candidate queue
      delete iceCandidateQueueRef.current[userId];
      delete connectionStateRef.current[userId];
      
      // Clean up remote stream
      const remoteStream = remoteStreamsRef.current[userId];
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        delete remoteStreamsRef.current[userId];
      }
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      
      // Update UI state
      setIsCallActive(false);
      setConnectionStatus('disconnected');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnectionStatus('disconnected');
      setIsCallActive(false);
    });
  };

  const initializeVideo = async () => {
    try {
      logWebRTCState('initializing-video', {});
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      
      // Store in ref immediately (synchronous)
      localStreamRef.current = stream;
      
      // Verify stream has tracks
      const trackCount = stream.getTracks().length;
      const activeTracks = stream.getTracks().filter(t => t.readyState === 'live').length;
      logWebRTCState('stream-obtained', { trackCount, activeTracks });
      
      if (trackCount === 0) {
        throw new Error('No tracks in stream');
      }
      
      // Attach to video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        logWebRTCState('stream-attached-to-video', {});
      }
      
      // Add tracks to existing peer connections (if any exist)
      Object.keys(peersRef.current).forEach((userId) => {
        const peerConnection = peersRef.current[userId];
        if (peerConnection && peerConnection.signalingState !== 'closed') {
          stream.getTracks().forEach((track) => {
            // Check if track already added
            const sender = peerConnection.getSenders().find(
              (s) => s.track && s.track.kind === track.kind
            );
            if (!sender) {
              peerConnection.addTrack(track, stream);
              logWebRTCState('track-added-to-existing-peer', { userId, kind: track.kind });
            }
          });
        }
      });
      
      logWebRTCState('video-initialization-complete', { trackCount, activeTracks });
    } catch (error) {
      logWebRTCState('video-initialization-error', { error: error.message });
      console.error('Error accessing media devices:', error);
      alert('Error accessing camera/microphone. Please check permissions.');
      throw error; // Re-throw to prevent join-room if stream fails
    }
  };

  // Process queued ICE candidates
  const processIceCandidateQueue = async (userId, peerConnection) => {
    const queue = iceCandidateQueueRef.current[userId];
    if (queue && queue.length > 0) {
      logWebRTCState('processing-ice-queue', { userId, count: queue.length });
      const candidates = [...queue];
      iceCandidateQueueRef.current[userId] = [];
      
      for (const candidate of candidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          logWebRTCState('queued-ice-candidate-added', { userId });
        } catch (error) {
          logWebRTCState('queued-ice-candidate-error', { userId, error: error.message });
          console.error('Error adding queued ICE candidate:', error);
        }
      }
    }
  };

  // Comprehensive WebRTC state logging
  const logWebRTCState = (event, data) => {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      event,
      ...data,
    };
    
    // Log to console with structured format
    console.log(`[WebRTC] ${event}`, logData);
    
    // Track connection states
    if (data.userId) {
      const peerConnection = peersRef.current[data.userId];
      if (peerConnection) {
        connectionStateRef.current[data.userId] = {
          signalingState: peerConnection.signalingState,
          iceConnectionState: peerConnection.iceConnectionState,
          connectionState: peerConnection.connectionState,
          iceGatheringState: peerConnection.iceGatheringState,
          hasLocalDescription: !!peerConnection.localDescription,
          hasRemoteDescription: !!peerConnection.remoteDescription,
        };
        console.log(`[WebRTC State] ${data.userId}:`, connectionStateRef.current[data.userId]);
      }
    }
  };

  const createPeerConnection = (userId, isInitiator, socket) => {
    const stream = localStreamRef.current;
    
    // CRITICAL: Block peer creation if stream doesn't exist
    if (!stream || stream.getTracks().length === 0) {
      logWebRTCState('peer-creation-blocked', { userId, reason: 'no-stream-or-tracks' });
      console.error('Cannot create peer connection: stream not available');
      return null;
    }
    
    const activeTracks = stream.getTracks().filter(t => t.readyState === 'live');
    if (activeTracks.length === 0) {
      logWebRTCState('peer-creation-blocked', { userId, reason: 'no-active-tracks' });
      console.error('Cannot create peer connection: no active tracks');
      return null;
    }
    
    logWebRTCState('creating-peer-connection', { 
      userId, 
      isInitiator, 
      hasStream: !!stream, 
      trackCount: stream.getTracks().length,
      activeTracks: activeTracks.length
    });
    
    // Create RTCPeerConnection with STUN servers
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Initialize ICE candidate queue for this peer
    iceCandidateQueueRef.current[userId] = [];

    // Add local stream tracks to peer connection (guaranteed to exist)
    stream.getTracks().forEach((track) => {
      if (track.readyState === 'live') {
        peerConnection.addTrack(track, stream);
        logWebRTCState('track-added', { userId, kind: track.kind, enabled: track.enabled, readyState: track.readyState });
      } else {
        logWebRTCState('track-skipped', { userId, kind: track.kind, readyState: track.readyState });
      }
    });
    
    // Verify tracks were added
    const senders = peerConnection.getSenders();
    logWebRTCState('peer-tracks-verified', { userId, senderCount: senders.length });

    // Handle remote stream - manually create MediaStream if event.streams is undefined
    peerConnection.ontrack = (event) => {
      logWebRTCState('track-received', { 
        userId, 
        trackId: event.track.id,
        trackKind: event.track.kind,
        hasStreams: !!event.streams,
        streamsLength: event.streams?.length || 0,
        trackReadyState: event.track.readyState
      });
      
      // Get or create remote stream for this peer
      let remoteStream = remoteStreamsRef.current[userId];
      
      if (!remoteStream) {
        // Create new MediaStream if it doesn't exist
        remoteStream = new MediaStream();
        remoteStreamsRef.current[userId] = remoteStream;
        logWebRTCState('remote-stream-created', { userId });
      }
      
      // Add track to stream (handles both event.streams and manual stream)
      if (event.track && event.track.readyState === 'live') {
        // Check if track already in stream
        const existingTrack = remoteStream.getTracks().find(t => t.id === event.track.id);
        if (!existingTrack) {
          remoteStream.addTrack(event.track);
          logWebRTCState('track-added-to-stream', { 
            userId, 
            trackId: event.track.id,
            trackKind: event.track.kind,
            streamTrackCount: remoteStream.getTracks().length
          });
        } else {
          logWebRTCState('track-already-in-stream', { userId, trackId: event.track.id });
        }
      } else {
        logWebRTCState('track-not-live', { 
          userId, 
          trackId: event.track?.id,
          readyState: event.track?.readyState 
        });
      }
      
      // Attach stream to video element
      if (remoteVideoRef.current && remoteStream.getTracks().length > 0) {
        remoteVideoRef.current.srcObject = remoteStream;
        setIsCallActive(true); // Call is active when remote stream is received
        setConnectionStatus('connected');
        logWebRTCState('remote-stream-attached', { 
          userId, 
          trackCount: remoteStream.getTracks().length,
          videoTracks: remoteStream.getVideoTracks().length,
          audioTracks: remoteStream.getAudioTracks().length
        });
      }
      
      // Handle track ended
      event.track.onended = () => {
        logWebRTCState('remote-track-ended', { userId, trackId: event.track.id });
        remoteStream.removeTrack(event.track);
        
        // If no tracks left, clear the stream
        if (remoteStream.getTracks().length === 0) {
          delete remoteStreamsRef.current[userId];
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
          logWebRTCState('remote-stream-cleared', { userId });
        }
      };
      
      // Handle track mute/unmute
      event.track.onmute = () => {
        logWebRTCState('remote-track-muted', { userId, trackId: event.track.id, kind: event.track.kind });
      };
      
      event.track.onunmute = () => {
        logWebRTCState('remote-track-unmuted', { userId, trackId: event.track.id, kind: event.track.kind });
      };
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        logWebRTCState('ice-candidate-generated', { userId, candidate: event.candidate.candidate });
        socket.emit('webrtc-ice-candidate', {
          roomId: consultation.roomId,
          candidate: event.candidate,
          to: userId,
        });
      } else {
        logWebRTCState('ice-gathering-complete', { userId });
      }
    };

    // Handle ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
      logWebRTCState('ice-gathering-state-change', { 
        userId, 
        state: peerConnection.iceGatheringState 
      });
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      logWebRTCState('ice-connection-state-change', { userId, state });
      
      if (state === 'failed') {
        logWebRTCState('ice-connection-failed', { userId });
        setConnectionStatus('reconnecting');
        peerConnection.restartIce();
      } else if (state === 'disconnected') {
        logWebRTCState('ice-connection-disconnected', { userId });
        setConnectionStatus('disconnected');
        setIsCallActive(false);
        // Don't close immediately, wait for reconnection attempt
      } else if (state === 'connected' || state === 'completed') {
        logWebRTCState('ice-connection-established', { userId, state });
        setConnectionStatus('connected');
      } else if (state === 'checking') {
        setConnectionStatus('connecting');
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      logWebRTCState('connection-state-change', { userId, state });
      
      if (state === 'failed') {
        logWebRTCState('connection-failed', { userId });
        setConnectionStatus('failed');
        setIsCallActive(false);
        // Try to reconnect
        peerConnection.restartIce();
      } else if (state === 'closed') {
        logWebRTCState('connection-closed', { userId });
        setIsCallActive(false);
        setConnectionStatus('disconnected');
        delete peersRef.current[userId];
        delete iceCandidateQueueRef.current[userId];
        delete connectionStateRef.current[userId];
      } else if (state === 'connected') {
        logWebRTCState('connection-established', { userId });
        setConnectionStatus('connected');
        setIsCallActive(true);
      } else if (state === 'connecting') {
        setConnectionStatus('connecting');
      }
    };

    // Handle signaling state changes
    peerConnection.onsignalingstatechange = () => {
      logWebRTCState('signaling-state-change', { 
        userId, 
        state: peerConnection.signalingState 
      });
    };

    // Handle errors
    peerConnection.onerror = (error) => {
      logWebRTCState('peer-connection-error', { userId, error: error.message || 'Unknown error' });
      console.error('Peer connection error:', error);
    };

    // Store peer connection
    peersRef.current[userId] = peerConnection;

    // If initiator, create and send offer (deterministic)
    if (isInitiator) {
      // Small delay to ensure peer connection is fully initialized
      setTimeout(() => {
        createOffer(peerConnection, userId, socket);
      }, 100);
    }

    return peerConnection;
  };

  const createOffer = async (peerConnection, userId, socket) => {
    try {
      logWebRTCState('creating-offer', { userId, signalingState: peerConnection.signalingState });
      
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      await peerConnection.setLocalDescription(offer);
      logWebRTCState('offer-created', { 
        userId, 
        signalingState: peerConnection.signalingState,
        sdp: offer.sdp?.substring(0, 100) 
      });
      
      socket.emit('webrtc-offer', {
        roomId: consultation.roomId,
        offer: offer,
        to: userId,
      });
    } catch (error) {
      logWebRTCState('offer-creation-error', { userId, error: error.message });
      console.error('Error creating offer:', error);
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
    const currentSocket = socketRef.current || socket;
    if (!messageInput.trim() || !currentSocket || !consultation) return;

    const messageData = {
      roomId: consultation.roomId,
      senderId: user.id,
      senderRole: user.role,
      message: messageInput.trim(),
      timestamp: new Date(),
    };

    // Add message locally immediately for better UX
    // Use a temporary ID to prevent duplicates when socket receives it back
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setMessages((prev) => [...prev, { ...messageData, _id: tempId }]);
    currentSocket.emit('chat-message', messageData);
    setMessageInput('');
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoActive;
        setIsVideoActive(!isVideoActive);
      }
    }
  };

  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
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
      setIsCallActive(true);
      setConnectionStatus('connecting');
      startTranscription();
    } catch (error) {
      console.error('Error starting consultation:', error);
      setConnectionStatus('error');
    }
  };

  const endConsultation = async () => {
    try {
      stopTranscription();
      
      // Clean up peer connections
      Object.values(peersRef.current).forEach((peerConnection) => {
        if (peerConnection && peerConnection.close) {
          peerConnection.close();
        }
      });
      peersRef.current = {};
      iceCandidateQueueRef.current = {};
      connectionStateRef.current = {};
      
      // Clean up all remote streams
      Object.values(remoteStreamsRef.current).forEach((stream) => {
        stream.getTracks().forEach(track => track.stop());
      });
      remoteStreamsRef.current = {};
      
      // Leave room
      if (socket && consultation?.roomId) {
        socket.emit('leave-room', consultation.roomId);
      }
      
      // Stop local stream
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      
      // End consultation
      await api.post(`/consultations/${consultation.roomId}/end`);
      
      // Disconnect socket
      if (socket) {
        socket.disconnect();
      }
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error ending consultation:', error);
      cleanup();
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    fetchConsultation();
    initializeTranscription();

    return () => {
      if (socket) socket.disconnect();
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      // Clean up all peer connections
      Object.values(peersRef.current).forEach((peerConnection) => {
        if (peerConnection && peerConnection.close) {
          peerConnection.close();
        }
      });
      peersRef.current = {};
      iceCandidateQueueRef.current = {};
      connectionStateRef.current = {};
      
      // Clean up all remote streams
      Object.values(remoteStreamsRef.current).forEach((stream) => {
        stream.getTracks().forEach(track => track.stop());
      });
      remoteStreamsRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (consultation?.roomId) {
      // Clean up existing socket before creating a new one
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      initializeSocket();
    }
    
    // Cleanup function
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultation?.roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
              {messages.map((msg, idx) => (
                <div
    key={msg._id || `msg-${idx}-${msg.timestamp}`}
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

    {/* ✅ MESSAGE BODY (THIS WAS MISSING) */}
    <div className="message-text">
      {msg.message}
    </div>
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
                disabled={!socketRef.current && !socket}
              />
              <button onClick={sendMessage} className="btn-send" disabled={!socketRef.current && !socket}>
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
