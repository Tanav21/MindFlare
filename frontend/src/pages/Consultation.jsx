import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import "./Consultation.css";

const Consultation = () => {
  const { appointmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultation, setConsultation] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [isVideoActive, setIsVideoActive] = useState(true);
  const [isAudioActive, setIsAudioActive] = useState(true);
  const [transcription, setTranscription] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [selectedFile, setSelectedFile] = useState(null);

  // Refs
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const fileInputRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const transcriptionEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const isTranscribingRef = useRef(false); // Use ref to avoid stale closures in event handlers
  const isRecognizingRef = useRef(false); // Prevent double starts
  const shouldBeActiveRef = useRef(false); // Track if transcription should be active
  const lastTranscriptionTextRef = useRef(''); // Prevent duplicate rapid submissions
  const lastTranscriptionTimestampRef = useRef(0); // Track last transcription time for deduplication
  const remoteStreamsRef = useRef({}); // userId -> MediaStream (for handling multiple tracks)
  const restartTimeoutRef = useRef(null); // Cooldown timer for restarts
  const consultationRef = useRef(consultation); // Avoid stale closure in onresult
  const userRef = useRef(user); // Avoid stale closure in onresult
  const socketRefForTranscription = useRef(null); // Socket ref for transcription
  const peersRef = useRef({});
  const iceCandidateQueueRef = useRef({}); // userId -> array of candidates
  const connectionStateRef = useRef({}); // Track connection states for logging

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      stream.getTracks().forEach((track) => track.stop());
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
    setConnectionStatus("disconnected");
  };

  const fetchConsultation = async () => {
    try {
      const response = await api.get(`/appointments/${appointmentId}`);
      setAppointment(response.data.appointment);
      setConsultation(response.data.consultation);
      setMedicalHistory(response.data.appointment.patientId.medicalHistory)
      if (response.data.consultation) {
        setMessages(response.data.consultation.chatMessages || []);
        // Load existing transcription from database with proper formatting
        const existingTranscription = (response.data.consultation.transcription || []).map(entry => ({
          senderId: entry.senderId,
          senderRole: entry.senderRole,
          text: entry.text,
          timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
        }));
        setTranscription(existingTranscription);
        
        // Scroll to bottom after loading
        setTimeout(() => {
          if (transcriptionEndRef.current) {
            transcriptionEndRef.current.scrollIntoView({ behavior: 'auto' });
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error fetching consultation:", error);
    }
  };

  const initializeSocket = async () => {
    if (!consultation?.roomId) return;

    // Disconnect existing socket if any
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    // Get API URL - production-safe: use environment variable, detect protocol, no localhost assumptions
    let apiUrl =
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_API_URL?.replace("/api", "") ||
      null;

    // If no URL configured, detect based on current location
    if (!apiUrl) {
      const isSecure =
        window.location.protocol === "https:" ||
        window.location.hostname === "localhost";
      const protocol = isSecure ? "https:" : "http:";
      const hostname =
        window.location.hostname === "localhost"
          ? "localhost"
          : window.location.hostname;
      const port = import.meta.env.VITE_API_PORT || "5000";
      apiUrl = `${protocol}//${hostname}:${port}`;
    }

    // Ensure URL doesn't have trailing slash
    apiUrl = apiUrl.replace(/\/$/, "");

    console.log("Connecting to socket:", apiUrl);
    const newSocket = io(apiUrl, {
      transports: ["websocket", "polling"], // Fallback to polling if websocket fails
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);
    socketRef.current = newSocket; // Set ref for consistency
    socketRefForTranscription.current = newSocket; // Set ref for transcription
    setConnectionStatus("connecting");

    newSocket.on("connect", async () => {
      console.log("Socket connected:", newSocket.id);
      setConnectionStatus("connected");

      // Initialize video first and WAIT for it to complete
      await initializeVideo();

      // Verify stream exists before joining room
      if (
        localStreamRef.current &&
        localStreamRef.current.getTracks().length > 0
      ) {
        logWebRTCState("stream-ready", {
          tracks: localStreamRef.current.getTracks().length,
        });
        newSocket.emit("join-room", consultation.roomId);
      } else {
        logWebRTCState("stream-not-ready", {
          error: "Stream not available after initialization",
        });
        console.error("Stream not ready, cannot join room");
        setConnectionStatus("error");
      }
    });

    // Handle user joined - server assigns initiator role
    newSocket.on("user-joined", async (data) => {
      const { userId, isInitiator } = data;
      const stream = localStreamRef.current;
      logWebRTCState("user-joined", {
        userId,
        isInitiator,
        hasStream: !!stream,
        trackCount: stream?.getTracks().length || 0,
      });

      if (userId === newSocket.id) return; // Ignore self

      // BLOCK until local stream exists and has tracks
      const waitForStream = () => {
        const currentStream = localStreamRef.current;
        if (currentStream && currentStream.getTracks().length > 0) {
          // Verify tracks are active
          const activeTracks = currentStream
            .getTracks()
            .filter((t) => t.readyState === "live");
          if (activeTracks.length > 0) {
            // Check if peer already exists
            if (!peersRef.current[userId]) {
              logWebRTCState("creating-peer-with-stream", {
                userId,
                activeTracks: activeTracks.length,
              });
              createPeerConnection(userId, isInitiator, newSocket);
            } else {
              logWebRTCState("peer-already-exists", { userId });
            }
          } else {
            logWebRTCState("waiting-for-active-tracks", { userId });
            setTimeout(waitForStream, 100);
          }
        } else {
          logWebRTCState("waiting-for-stream", { userId });
          setTimeout(waitForStream, 100);
        }
      };
      waitForStream();
    });

    // Handle room ready (first user in room)
    newSocket.on("room-ready", (data) => {
      logWebRTCState("room-ready", data);
    });

    // Handle WebRTC offer - deterministic answer creation
    newSocket.on("webrtc-offer", (data) => {
      const { from, offer } = data;
      logWebRTCState("offer-received", {
        from,
        signalingState: peersRef.current[from]?.signalingState,
      });

      if (from === newSocket.id) return; // Ignore self

      // BLOCK until local stream exists and has tracks
      const waitForStream = async () => {
        const stream = localStreamRef.current;
        if (stream && stream.getTracks().length > 0) {
          const activeTracks = stream
            .getTracks()
            .filter((t) => t.readyState === "live");
          if (activeTracks.length > 0) {
            // Ensure peer connection exists
            if (!peersRef.current[from]) {
              logWebRTCState("creating-peer-for-offer", {
                from,
                activeTracks: activeTracks.length,
              });
              createPeerConnection(from, false, newSocket);
            }

            // Set remote description and create answer deterministically
            const peerConnection = peersRef.current[from];
            if (peerConnection && peerConnection.signalingState !== "closed") {
              try {
                // Set remote description first
                await peerConnection.setRemoteDescription(
                  new RTCSessionDescription(offer)
                );
                logWebRTCState("remote-description-set", {
                  from,
                  state: peerConnection.signalingState,
                });

                // Process queued ICE candidates
                processIceCandidateQueue(from, peerConnection);

                // Create and send answer
                const answer = await peerConnection.createAnswer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                await peerConnection.setLocalDescription(answer);
                logWebRTCState("answer-created", {
                  from,
                  state: peerConnection.signalingState,
                });

                newSocket.emit("webrtc-answer", {
                  roomId: consultation.roomId,
                  answer: answer,
                  to: from,
                });
              } catch (error) {
                logWebRTCState("offer-error", { from, error: error.message });
                console.error("Error handling offer:", error);
              }
            }
          } else {
            logWebRTCState("waiting-for-active-tracks-offer", { from });
            setTimeout(waitForStream, 100);
          }
        } else {
          logWebRTCState("waiting-for-stream-offer", { from });
          setTimeout(waitForStream, 100);
        }
      };
      waitForStream();
    });

    // Handle WebRTC answer - deterministic processing
    newSocket.on("webrtc-answer", async (data) => {
      const { from, answer } = data;
      logWebRTCState("answer-received", {
        from,
        signalingState: peersRef.current[from]?.signalingState,
      });

      const peerConnection = peersRef.current[from];
      if (peerConnection && peerConnection.signalingState !== "closed") {
        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          logWebRTCState("answer-processed", {
            from,
            state: peerConnection.signalingState,
          });

          // Process queued ICE candidates
          processIceCandidateQueue(from, peerConnection);
        } catch (error) {
          logWebRTCState("answer-error", { from, error: error.message });
          console.error("Error handling answer:", error);
        }
      } else {
        logWebRTCState("answer-rejected", {
          from,
          reason: "no-peer-connection-or-closed",
        });
      }
    });

    // Handle ICE candidates - queue until remoteDescription is set
    newSocket.on("webrtc-ice-candidate", async (data) => {
      const { from, candidate } = data;
      logWebRTCState("ice-candidate-received", {
        from,
        hasRemoteDesc: !!peersRef.current[from]?.remoteDescription,
        signalingState: peersRef.current[from]?.signalingState,
      });

      const peerConnection = peersRef.current[from];

      if (!peerConnection) {
        logWebRTCState("ice-candidate-queued", {
          from,
          reason: "no-peer-connection",
        });
        // Queue candidate (PRODUCTION-SAFE: validate candidate and queue)
        if (candidate && typeof candidate === "object") {
          if (!iceCandidateQueueRef.current[from]) {
            iceCandidateQueueRef.current[from] = [];
          }
          if (Array.isArray(iceCandidateQueueRef.current[from])) {
            iceCandidateQueueRef.current[from].push(candidate);
          } else {
            iceCandidateQueueRef.current[from] = [candidate];
          }
        }
        return;
      }

      if (!candidate) {
        return; // Null candidate means end of candidates
      }

      // Validate candidate before processing
      if (typeof candidate !== "object") {
        logWebRTCState("ice-candidate-invalid", {
          from,
          candidate: typeof candidate,
        });
        return;
      }

      // Check if connection is still valid
      if (peerConnection.signalingState === "closed") {
        logWebRTCState("ice-candidate-rejected", {
          from,
          reason: "connection-closed",
        });
        return;
      }

      // If remote description is set, add immediately
      if (peerConnection.remoteDescription) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          logWebRTCState("ice-candidate-added", {
            from,
            candidate: candidate.candidate?.substring(0, 50),
          });
        } catch (error) {
          logWebRTCState("ice-candidate-error", { from, error: error.message });
          console.error("Error adding ICE candidate:", error);
        }
      } else {
        // Queue candidate until remote description is set (PRODUCTION-SAFE)
        logWebRTCState("ice-candidate-queued", {
          from,
          reason: "no-remote-description",
        });
        if (!iceCandidateQueueRef.current[from]) {
          iceCandidateQueueRef.current[from] = [];
        }
        // Validate queue exists and is array before pushing
        if (Array.isArray(iceCandidateQueueRef.current[from])) {
          iceCandidateQueueRef.current[from].push(candidate);
        } else {
          iceCandidateQueueRef.current[from] = [candidate];
        }
      }
    });

    // Handle chat messages
    newSocket.on("chat-message", (data) => {
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
    newSocket.on("user-left", (data) => {
      const { userId } = data;
      logWebRTCState("user-left", { userId });

      const peerConnection = peersRef.current[userId];
      if (peerConnection) {
        // Only close if connection is in a terminal state
        const state = peerConnection.connectionState;
        if (
          state === "closed" ||
          state === "failed" ||
          state === "disconnected"
        ) {
          logWebRTCState("peer-closing", { userId, state });
          peerConnection.close();
        } else {
          // Wait for connection to close naturally or transition to failed
          logWebRTCState("peer-waiting-close", { userId, state });
          const checkState = () => {
            if (
              peerConnection.connectionState === "closed" ||
              peerConnection.connectionState === "failed"
            ) {
              peerConnection.close();
              delete peersRef.current[userId];
            } else if (peerConnection.connectionState !== "closed") {
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
        remoteStream.getTracks().forEach((track) => track.stop());
        delete remoteStreamsRef.current[userId];
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      // Update UI state
      setIsCallActive(false);
      setConnectionStatus("disconnected");
    });

    // Handle real-time transcription updates from Socket.IO (remote users only)
    newSocket.on('transcription-update', (entry) => {
      // Entry format: { senderId, senderRole, text, timestamp }
      if (!entry || !entry.text || !entry.senderRole) {
        return;
      }

      // C. SOCKET SYNC - Only add if from remote user (not our own)
      // Our own transcripts are already shown via optimistic UI update
      const isOwnMessage = entry.senderId === user.id || 
                          (entry.senderRole === user.role && 
                           entry.text === lastTranscriptionTextRef.current);

      if (isOwnMessage) {
        // This is our own message - already shown optimistically, skip
        console.log('[Transcription] Ignoring own message from socket (already shown)');
        return;
      }

      const transcriptionEntry = {
        senderId: entry.senderId,
        senderRole: entry.senderRole,
        text: entry.text.trim(),
        timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
      };
      
      // Add to transcription state (remote user's speech)
      setTranscription((prev) => {
        // Prevent duplicates: check if same text from same sender within 3 seconds
        const isDuplicate = prev.some((existing) => {
          const timeDiff = Math.abs(
            new Date(existing.timestamp) - transcriptionEntry.timestamp
          );
          return (
            existing.text === transcriptionEntry.text &&
            existing.senderRole === transcriptionEntry.senderRole &&
            timeDiff < 3000
          );
        });

        if (isDuplicate) {
          console.log('[Transcription] Duplicate entry ignored:', transcriptionEntry.text.substring(0, 30));
          return prev;
        }

        const updated = [...prev, transcriptionEntry];
        
        // Auto-scroll to bottom when new transcription arrives
        setTimeout(() => {
          if (transcriptionEndRef.current) {
            transcriptionEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
        
        return updated;
      });
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnectionStatus("disconnected");
      setIsCallActive(false);
    });
  };

  const initializeVideo = async () => {
    try {
      // Check for secure context (required for getUserMedia in production)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const error =
          "getUserMedia is not available. Requires HTTPS or localhost.";
        logWebRTCState("media-devices-unavailable", {
          error,
          isSecure: window.isSecureContext,
        });
        alert("Camera/microphone access requires a secure connection (HTTPS).");
        throw new Error(error);
      }

      logWebRTCState("initializing-video", {
        isSecureContext: window.isSecureContext,
      });

      // Production-safe media constraints
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Store in ref immediately (synchronous)
      localStreamRef.current = stream;

      // Verify stream has tracks
      const trackCount = stream.getTracks().length;
      const activeTracks = stream
        .getTracks()
        .filter((t) => t.readyState === "live").length;
      logWebRTCState("stream-obtained", { trackCount, activeTracks });

      if (trackCount === 0) {
        throw new Error("No tracks in stream");
      }

      // Attach to video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        logWebRTCState("stream-attached-to-video", {});
      }

      // Add tracks to existing peer connections (if any exist)
      Object.keys(peersRef.current).forEach((userId) => {
        const peerConnection = peersRef.current[userId];
        if (peerConnection && peerConnection.signalingState !== "closed") {
          stream.getTracks().forEach((track) => {
            // Check if track already added
            const sender = peerConnection
              .getSenders()
              .find((s) => s.track && s.track.kind === track.kind);
            if (!sender) {
              peerConnection.addTrack(track, stream);
              logWebRTCState("track-added-to-existing-peer", {
                userId,
                kind: track.kind,
              });
            }
          });
        }
      });

      logWebRTCState("video-initialization-complete", {
        trackCount,
        activeTracks,
      });
    } catch (error) {
      logWebRTCState("video-initialization-error", { error: error.message });
      console.error("Error accessing media devices:", error);
      alert("Error accessing camera/microphone. Please check permissions.");
      throw error; // Re-throw to prevent join-room if stream fails
    }
  };

  // Process queued ICE candidates - PRODUCTION-SAFE with validation
  const processIceCandidateQueue = async (userId, peerConnection) => {
    // Validate inputs
    if (!peerConnection || !userId) {
      logWebRTCState("ice-queue-process-skipped", {
        userId,
        reason: "invalid-inputs",
      });
      return;
    }

    // Check if remote description is set (required for adding candidates)
    if (!peerConnection.remoteDescription) {
      logWebRTCState("ice-queue-process-skipped", {
        userId,
        reason: "no-remote-description",
      });
      return;
    }

    const queue = iceCandidateQueueRef.current[userId];
    if (queue && Array.isArray(queue) && queue.length > 0) {
      logWebRTCState("processing-ice-queue", { userId, count: queue.length });
      const candidates = [...queue]; // Copy array
      iceCandidateQueueRef.current[userId] = []; // Clear queue immediately

      for (const candidate of candidates) {
        try {
          // Validate candidate before adding
          if (!candidate || typeof candidate !== "object") {
            logWebRTCState("ice-candidate-invalid", {
              userId,
              candidate: typeof candidate,
            });
            continue;
          }

          // Check if connection is still valid
          if (peerConnection.signalingState === "closed") {
            logWebRTCState("ice-queue-process-stopped", {
              userId,
              reason: "connection-closed",
            });
            break;
          }

          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          logWebRTCState("queued-ice-candidate-added", {
            userId,
            candidate: candidate.candidate?.substring(0, 50),
          });
        } catch (error) {
          // Don't throw - continue processing other candidates
          logWebRTCState("queued-ice-candidate-error", {
            userId,
            error: error.message,
          });
          console.error("Error adding queued ICE candidate:", error);
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
        console.log(
          `[WebRTC State] ${data.userId}:`,
          connectionStateRef.current[data.userId]
        );
      }
    }
  };

  const createPeerConnection = (userId, isInitiator, socket) => {
    const stream = localStreamRef.current;

    // CRITICAL: Block peer creation if stream doesn't exist
    if (!stream || stream.getTracks().length === 0) {
      logWebRTCState("peer-creation-blocked", {
        userId,
        reason: "no-stream-or-tracks",
      });
      console.error("Cannot create peer connection: stream not available");
      return null;
    }

    const activeTracks = stream
      .getTracks()
      .filter((t) => t.readyState === "live");
    if (activeTracks.length === 0) {
      logWebRTCState("peer-creation-blocked", {
        userId,
        reason: "no-active-tracks",
      });
      console.error("Cannot create peer connection: no active tracks");
      return null;
    }

    logWebRTCState("creating-peer-connection", {
      userId,
      isInitiator,
      hasStream: !!stream,
      trackCount: stream.getTracks().length,
      activeTracks: activeTracks.length,
    });

    // Create RTCPeerConnection with production-grade STUN + TURN configuration
    const iceServers = [
      // Primary STUN servers (Google's public STUN)
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      // Additional STUN servers for redundancy
      { urls: "stun:stun.stunprotocol.org:3478" },
      { urls: "stun:stun.voiparound.com" },
      { urls: "stun:stun.voipbuster.com" },
    ];

    // Add TURN server if configured (required for cross-network connections)
    const turnServer = import.meta.env.VITE_TURN_SERVER;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME;
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

    if (turnServer && turnUsername && turnCredential) {
      // Custom TURN server with credentials
      const turnUrls = Array.isArray(turnServer)
        ? turnServer
        : turnServer.split(",").map((s) => s.trim());
      turnUrls.forEach((url) => {
        iceServers.push({
          urls: url,
          username: turnUsername,
          credential: turnCredential,
        });
      });
      logWebRTCState("turn-server-configured", {
        userId,
        turnServer: turnUrls[0],
      });
    } else {
      // Production-grade free TURN servers (multiple for redundancy)
      iceServers.push(
        // Metered.ca TURN servers (free tier)
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turns:openrelay.metered.ca:443?transport=tcp", // TLS transport for production
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        // Additional free TURN servers for fallback
        {
          urls: "turn:relay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:relay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:relay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turns:relay.metered.ca:443?transport=tcp", // TLS transport for production
          username: "openrelayproject",
          credential: "openrelayproject",
        }
      );
      logWebRTCState("using-public-turn-servers", { userId, count: 7 });
    }
    
    const peerConnection = new RTCPeerConnection({
      iceServers: iceServers,
      iceCandidatePoolSize: 10, // Pre-gather candidates for faster connection
      iceTransportPolicy: "all", // Use both UDP and TCP
      bundlePolicy: "max-bundle", // Bundle RTP and RTCP together
      rtcpMuxPolicy: "require", // Require RTCP multiplexing
    });

    // Initialize ICE candidate queue for this peer
    iceCandidateQueueRef.current[userId] = [];

    // Add local stream tracks to peer connection (guaranteed to exist)
    stream.getTracks().forEach((track) => {
      if (track.readyState === "live") {
        peerConnection.addTrack(track, stream);
        logWebRTCState("track-added", {
          userId,
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
        });
      } else {
        logWebRTCState("track-skipped", {
          userId,
          kind: track.kind,
          readyState: track.readyState,
        });
      }
    });

    // Verify tracks were added
    const senders = peerConnection.getSenders();
    logWebRTCState("peer-tracks-verified", {
      userId,
      senderCount: senders.length,
    });

    // Handle remote stream - PRODUCTION-SAFE: handles all edge cases
    peerConnection.ontrack = (event) => {
      try {
        // CRITICAL: Validate event and track exist
        if (!event || !event.track) {
          logWebRTCState("ontrack-invalid-event", {
            userId,
            hasEvent: !!event,
            hasTrack: !!event?.track,
          });
          return;
        }

        const track = event.track;
        const streams = event.streams || []; // Safe fallback for undefined streams

        logWebRTCState("track-received", {
          userId,
          trackId: track?.id || "unknown",
          trackKind: track?.kind || "unknown",
          hasStreams: !!event.streams,
          streamsLength: streams?.length || 0,
          trackReadyState: track?.readyState || "unknown",
        });

        // Get or create remote stream for this peer
        let remoteStream = remoteStreamsRef.current[userId];

        if (!remoteStream) {
          try {
            remoteStream = new MediaStream();
            remoteStreamsRef.current[userId] = remoteStream;
            logWebRTCState("remote-stream-created", { userId });
          } catch (error) {
            logWebRTCState("remote-stream-creation-error", {
              userId,
              error: error.message,
            });
            return;
          }
        }

        // Validate remoteStream exists and has getTracks method
        if (!remoteStream || typeof remoteStream.getTracks !== "function") {
          logWebRTCState("remote-stream-invalid", { userId });
          return;
        }

        // Add track to stream - handle all edge cases
        if (track && track.readyState === "live") {
          try {
            // Safely check if track already exists
            const existingTracks = remoteStream.getTracks();
            const existingTrack =
              existingTracks && Array.isArray(existingTracks)
                ? existingTracks.find((t) => t && t.id === track.id)
                : null;

            if (!existingTrack) {
              remoteStream.addTrack(track);
              const currentTracks = remoteStream.getTracks();
              logWebRTCState("track-added-to-stream", {
                userId,
                trackId: track.id,
                trackKind: track.kind,
                streamTrackCount: currentTracks ? currentTracks.length : 0,
              });
            } else {
              logWebRTCState("track-already-in-stream", {
                userId,
                trackId: track.id,
              });
            }
          } catch (error) {
            logWebRTCState("track-add-error", {
              userId,
              error: error.message,
              trackId: track?.id,
            });
          }
        } else {
          logWebRTCState("track-not-live", {
            userId,
            trackId: track?.id,
            readyState: track?.readyState,
          });
        }

        // Attach stream to video element - safe with null checks
        try {
          const tracks = remoteStream.getTracks();
          if (
            remoteVideoRef.current &&
            tracks &&
            Array.isArray(tracks) &&
            tracks.length > 0
          ) {
            // Only attach if no stream is currently attached, or if this is a new stream
            // For multiple participants, this ensures we show the most recent stream
            if (!remoteVideoRef.current.srcObject || remoteVideoRef.current.srcObject !== remoteStream) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            setIsCallActive(true);
            setConnectionStatus("connected");

            // Safely get track counts
            const videoTracks = remoteStream.getVideoTracks
              ? remoteStream.getVideoTracks()
              : [];
            const audioTracks = remoteStream.getAudioTracks
              ? remoteStream.getAudioTracks()
              : [];

            logWebRTCState("remote-stream-attached", {
              userId,
              trackCount: tracks.length,
              videoTracks: Array.isArray(videoTracks) ? videoTracks.length : 0,
              audioTracks: Array.isArray(audioTracks) ? audioTracks.length : 0,
              totalPeers: Object.keys(peersRef.current).length,
            });
          }
        } catch (error) {
          logWebRTCState("stream-attach-error", {
            userId,
            error: error.message,
          });
        }

        // Handle track ended - with null safety
        if (track && typeof track.addEventListener === "function") {
          track.addEventListener("ended", () => {
            try {
              logWebRTCState("remote-track-ended", {
                userId,
                trackId: track.id,
              });
              if (
                remoteStream &&
                typeof remoteStream.removeTrack === "function"
              ) {
                remoteStream.removeTrack(track);

                const remainingTracks = remoteStream.getTracks();
                if (
                  !remainingTracks ||
                  (Array.isArray(remainingTracks) &&
                    remainingTracks.length === 0)
                ) {
                  delete remoteStreamsRef.current[userId];
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = null;
                  }
                  logWebRTCState("remote-stream-cleared", { userId });
                }
              }
            } catch (error) {
              logWebRTCState("track-ended-handler-error", {
                userId,
                error: error.message,
              });
            }
          });
        } else if (track && track.onended !== undefined) {
          // Fallback for older browsers
          track.onended = () => {
            try {
              logWebRTCState("remote-track-ended", {
                userId,
                trackId: track.id,
              });
              if (
                remoteStream &&
                typeof remoteStream.removeTrack === "function"
              ) {
                remoteStream.removeTrack(track);
                const remainingTracks = remoteStream.getTracks();
                if (
                  !remainingTracks ||
                  (Array.isArray(remainingTracks) &&
                    remainingTracks.length === 0)
                ) {
                  delete remoteStreamsRef.current[userId];
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = null;
                  }
                }
              }
            } catch (error) {
              logWebRTCState("track-ended-handler-error", {
                userId,
                error: error.message,
              });
            }
          };
        }

        // Handle track mute/unmute - with null safety
        if (track) {
          if (typeof track.addEventListener === "function") {
            track.addEventListener("mute", () => {
              logWebRTCState("remote-track-muted", {
                userId,
                trackId: track.id,
                kind: track.kind,
              });
            });
            track.addEventListener("unmute", () => {
              logWebRTCState("remote-track-unmuted", {
                userId,
                trackId: track.id,
                kind: track.kind,
              });
            });
          } else if (track.onmute !== undefined) {
            track.onmute = () => {
              logWebRTCState("remote-track-muted", {
                userId,
                trackId: track.id,
                kind: track.kind,
              });
            };
            track.onunmute = () => {
              logWebRTCState("remote-track-unmuted", {
                userId,
                trackId: track.id,
                kind: track.kind,
              });
            };
          }
        }
      } catch (error) {
        // Ultimate fallback - never let ontrack crash
        logWebRTCState("ontrack-crash-prevented", {
          userId,
          error: error.message,
          stack: error.stack,
        });
        console.error("Critical error in ontrack handler:", error);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        logWebRTCState("ice-candidate-generated", {
          userId,
          candidate: event.candidate.candidate,
        });
        socket.emit("webrtc-ice-candidate", {
          roomId: consultation.roomId,
          candidate: event.candidate,
          to: userId,
        });
      } else {
        logWebRTCState("ice-gathering-complete", { userId });
      }
    };

    // Handle ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
      logWebRTCState("ice-gathering-state-change", {
        userId,
        state: peerConnection.iceGatheringState,
      });
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      logWebRTCState("ice-connection-state-change", { userId, state });

      if (state === "failed") {
        logWebRTCState("ice-connection-failed", { userId });
        setConnectionStatus("reconnecting");
        // ICE restart: create new offer/answer cycle (async handler)
        (async () => {
          try {
            peerConnection.restartIce();
            // If we're the initiator, create a new offer
            if (peerConnection.signalingState === "stable" || peerConnection.signalingState === "have-local-offer") {
              const offer = await peerConnection.createOffer({ iceRestart: true });
              await peerConnection.setLocalDescription(offer);
              const currentSocket = socketRef.current || socket;
              if (currentSocket && consultation?.roomId) {
                currentSocket.emit("webrtc-offer", {
                  roomId: consultation.roomId,
                  offer: offer,
                  to: userId,
                });
                logWebRTCState("ice-restart-offer-sent", { userId });
              }
            }
          } catch (error) {
            logWebRTCState("ice-restart-error", { userId, error: error.message });
            console.error("ICE restart error:", error);
          }
        })();
      } else if (state === "disconnected") {
        logWebRTCState("ice-connection-disconnected", { userId });
        setConnectionStatus("disconnected");
        setIsCallActive(false);
        // Don't close immediately, wait for reconnection attempt
      } else if (state === "connected" || state === "completed") {
        logWebRTCState("ice-connection-established", { userId, state });
        setConnectionStatus("connected");
      } else if (state === "checking") {
        setConnectionStatus("connecting");
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      logWebRTCState("connection-state-change", { userId, state });

      if (state === "failed") {
        logWebRTCState("connection-failed", { userId });
        setConnectionStatus("failed");
        setIsCallActive(false);
        // Try to reconnect with ICE restart (async handler)
        (async () => {
          try {
            peerConnection.restartIce();
            // If we're the initiator, create a new offer
            if (peerConnection.signalingState === "stable" || peerConnection.signalingState === "have-local-offer") {
              const offer = await peerConnection.createOffer({ iceRestart: true });
              await peerConnection.setLocalDescription(offer);
              const currentSocket = socketRef.current || socket;
              if (currentSocket && consultation?.roomId) {
                currentSocket.emit("webrtc-offer", {
                  roomId: consultation.roomId,
                  offer: offer,
                  to: userId,
                });
                logWebRTCState("connection-restart-offer-sent", { userId });
              }
            }
          } catch (error) {
            logWebRTCState("connection-restart-error", { userId, error: error.message });
            console.error("Connection restart error:", error);
          }
        })();
      } else if (state === "closed") {
        logWebRTCState("connection-closed", { userId });
        setIsCallActive(false);
        setConnectionStatus("disconnected");
        delete peersRef.current[userId];
        delete iceCandidateQueueRef.current[userId];
        delete connectionStateRef.current[userId];
      } else if (state === "connected") {
        logWebRTCState("connection-established", { userId });
        setConnectionStatus("connected");
        setIsCallActive(true);
      } else if (state === "connecting") {
        setConnectionStatus("connecting");
      }
    };

    // Handle signaling state changes
    peerConnection.onsignalingstatechange = () => {
      logWebRTCState("signaling-state-change", {
        userId,
        state: peerConnection.signalingState,
      });
    };

    // Handle errors
    peerConnection.onerror = (error) => {
      logWebRTCState("peer-connection-error", {
        userId,
        error: error.message || "Unknown error",
      });
      console.error("Peer connection error:", error);
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
      logWebRTCState("creating-offer", {
        userId,
        signalingState: peerConnection.signalingState,
      });

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(offer);
      logWebRTCState("offer-created", {
        userId,
        signalingState: peerConnection.signalingState,
        sdp: offer.sdp?.substring(0, 100),
      });

      socket.emit("webrtc-offer", {
        roomId: consultation.roomId,
        offer: offer,
        to: userId,
      });
    } catch (error) {
      logWebRTCState("offer-creation-error", { userId, error: error.message });
      console.error("Error creating offer:", error);
    }
  };

  const initializeTranscription = () => {
    // Check for secure context (required for Web Speech API in production)
    if (
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      console.warn("Web Speech API requires HTTPS in production");
      return;
    }

    // Check if SpeechRecognition is available
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      console.warn("Speech Recognition API not available in this browser");
      return;
    }

    // Don't reinitialize if already initialized
    if (recognitionRef.current) {
      return;
    }

    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        // TRANSCRIPTION OUTPUT - Handle both interim and final results correctly
        // Process all results from resultIndex to end
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          
          if (result.isFinal) {
            // Final results are complete and ready to send
            finalTranscript += transcript + " ";
          }
          // Note: Interim results are ignored - we only process final transcripts
        }

        // Only process final transcripts (interim results are for UI feedback only)
        if (finalTranscript.trim()) {
          // Use refs to avoid stale closures
          const currentConsultation = consultationRef.current;
          const currentUser = userRef.current;
          
          if (!currentConsultation?.roomId || !currentUser) {
            console.warn('[Transcription] Missing consultation or user, skipping');
            return;
          }

          const text = finalTranscript.trim();
          const now = Date.now();
          
          // Prevent duplicate rapid submissions (debounce within 2 seconds)
          if (text === lastTranscriptionTextRef.current && 
              text.length > 0 && 
              (now - lastTranscriptionTimestampRef.current) < 2000) {
            console.log('[Transcription] Duplicate text ignored:', text.substring(0, 30));
            return;
          }
          
          lastTranscriptionTextRef.current = text;
          lastTranscriptionTimestampRef.current = now;

          console.log(`[Transcription] Final transcript received: ${currentUser.role} - ${text.substring(0, 50)}...`);

          // A. OPTIMISTIC UI UPDATE - Show immediately in local UI
          const transcriptionEntry = {
            senderId: currentUser.id,
            senderRole: currentUser.role,
            text: text,
            timestamp: new Date(),
          };

          // Update UI immediately (optimistic update) - use functional update to avoid stale state
          setTranscription((prev) => {
            // Prevent duplicates in UI
            const isDuplicate = prev.some((existing) => {
              const timeDiff = Math.abs(
                new Date(existing.timestamp).getTime() - transcriptionEntry.timestamp.getTime()
              );
              return (
                existing.text === transcriptionEntry.text &&
                existing.senderRole === transcriptionEntry.senderRole &&
                timeDiff < 2000
              );
            });

            if (isDuplicate) {
              console.log('[Transcription] Duplicate entry in UI, skipping');
              return prev; // Already shown
            }

            const updated = [...prev, transcriptionEntry];
            
            // Auto-scroll to bottom
            setTimeout(() => {
              if (transcriptionEndRef.current) {
                transcriptionEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }, 100);
            
            return updated;
          });

          console.log(`[Transcription] Local UI updated: ${currentUser.role} - ${text.substring(0, 50)}...`);

          // C. SOCKET SYNC - Emit AFTER local UI update (for remote users)
          const currentSocket = socketRefForTranscription.current || socketRef.current || socket;
          if (currentSocket && currentSocket.connected) {
            currentSocket.emit('transcription-update', {
              roomId: currentConsultation.roomId,
              text: text,
              senderRole: currentUser.role,
            });
            console.log(`[Transcription] Sent to socket: ${currentUser.role} - ${text.substring(0, 50)}...`);
          } else {
            console.warn('[Transcription] Socket not connected, local text shown but not synced');
          }
        }
      };

      recognition.onerror = (event) => {
        console.error("[Transcription] Speech recognition error:", event.error);
        
        // ERROR HANDLING - Ignore "aborted" completely (it's normal when stopping/restarting)
        // Do NOT restart from onerror - only restart from onend
        if (event.error === 'aborted') {
          // "aborted" is normal when recognition stops/restarts - ignore it completely
          console.log('[Transcription] Aborted (normal, ignoring)');
          isRecognizingRef.current = false; // Reset flag
          return; // Do NOT restart from here
        }
        
        // Fatal errors - stop transcription completely
        const fatalErrors = ['not-allowed', 'service-not-allowed'];
        if (fatalErrors.includes(event.error)) {
          console.error(`[Transcription] Fatal error: ${event.error}. Stopping transcription.`);
          shouldBeActiveRef.current = false;
          if (isTranscribingRef.current) {
            setIsTranscribing(false);
            isTranscribingRef.current = false;
            isRecognizingRef.current = false;
          }
          return;
        }

        // Other recoverable errors - log but don't restart (onend will handle restart)
        console.warn(`[Transcription] Recoverable error: ${event.error}. Will restart on onend if active.`);
        isRecognizingRef.current = false; // Reset flag to allow restart from onend
      };

      recognition.onend = () => {
        // LIFECYCLE SAFETY - Auto-restart ONLY from onend with cooldown
        // Reset recognizing flag to allow restart
        isRecognizingRef.current = false;
        
        // Clear any existing restart timeout
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = null;
        }
        
        // Auto-restart if transcription should still be active
        // Use shouldBeActiveRef to avoid stale closures
        if (shouldBeActiveRef.current && recognitionRef.current && !isRecognizingRef.current) {
          // Cooldown: 500-800ms delay to prevent rapid restart loops
          const cooldown = 600; // 600ms cooldown
          
          restartTimeoutRef.current = setTimeout(() => {
            // Double-check conditions before restarting (avoid stale closures)
            if (shouldBeActiveRef.current && recognitionRef.current && !isRecognizingRef.current) {
              try {
                isRecognizingRef.current = true;
                recognitionRef.current.start();
                console.log('[Transcription] Auto-restarted after onend');
              } catch (e) {
                isRecognizingRef.current = false;
                // If start fails, it might already be starting - ignore the error
                if (e.name !== 'InvalidStateError') {
                  console.error('[Transcription] Failed to restart on end:', e);
                }
              }
            } else {
              console.log('[Transcription] Skipping restart - not active or already recognizing');
            }
            restartTimeoutRef.current = null;
          }, cooldown);
        } else {
          console.log('[Transcription] onend - not restarting (shouldBeActive:', shouldBeActiveRef.current, ')');
        }
      };

      recognition.onstart = () => {
        isRecognizingRef.current = true; // Mark as recognizing
        console.log('[Transcription] Recognition started');
      };

      recognitionRef.current = recognition;
      console.log('[Transcription] Initialized successfully');
    } catch (error) {
      console.error('[Transcription] Failed to initialize:', error);
    }
  };

  const startTranscription = () => {
    // Ensure recognition is initialized
    if (!recognitionRef.current) {
      initializeTranscription();
    }

    // LIFECYCLE SAFETY - Prevent double starts
    // Check both flags to ensure we don't start while already recognizing
    if (recognitionRef.current && !isTranscribingRef.current && !isRecognizingRef.current) {
      try {
        shouldBeActiveRef.current = true; // Set flag first
        isRecognizingRef.current = true; // Prevent double starts
        recognitionRef.current.start();
        setIsTranscribing(true);
        isTranscribingRef.current = true;
        console.log('[Transcription] Started by user');
      } catch (error) {
        isRecognizingRef.current = false;
        shouldBeActiveRef.current = false;
        console.error('[Transcription] Failed to start:', error);
        // If already started, just update state
        if (error.name === 'InvalidStateError') {
          setIsTranscribing(true);
          isTranscribingRef.current = true;
          isRecognizingRef.current = true;
          shouldBeActiveRef.current = true;
        }
      }
    } else {
      console.log('[Transcription] Already active or recognizing, skipping start');
    }
  };

  const stopTranscription = () => {
    // LIFECYCLE SAFETY - Only stop if user explicitly clicks Stop
    // Clear restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    shouldBeActiveRef.current = false; // Prevent auto-restart
    
    if (recognitionRef.current && isTranscribingRef.current) {
      try {
        recognitionRef.current.stop();
        setIsTranscribing(false);
        isTranscribingRef.current = false;
        isRecognizingRef.current = false; // Reset recognizing flag
        console.log('[Transcription] Stopped by user');
      } catch (error) {
        console.error('[Transcription] Failed to stop:', error);
        // Update state anyway
        setIsTranscribing(false);
        isTranscribingRef.current = false;
        isRecognizingRef.current = false;
      }
    }
  };

  // Transcription is now saved via Socket.IO, this function is no longer needed
  // but kept for backward compatibility if needed

  const sendMessage = async () => {
  const currentSocket = socketRef.current || socket;
  if (!currentSocket || !consultation) return;

  // ✅ validation
  if (!messageInput.trim() && !selectedFile) {
    alert("Please enter a message or select a file before sending.");
    return;
  }

  let fileData = null;

  // 1️⃣ Upload file first
  if (selectedFile) {
    const formData = new FormData();
    formData.append("file", selectedFile);

    const res = await api.post("/upload/chat-file", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    fileData = res.data;

    // ✅ CLEAR FILE STATE + INPUT
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // 2️⃣ Send chat message
  const messageData = {
    roomId: consultation.roomId,
    senderId: user.id,
    senderRole: user.role,
    message: messageInput,
    file: fileData,
    timestamp: new Date(),
  };

  currentSocket.emit("chat-message", messageData);

  setMessageInput("");
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
      setConnectionStatus("connecting");
      startTranscription();
    } catch (error) {
      console.error("Error starting consultation:", error);
      setConnectionStatus("error");
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
        stream.getTracks().forEach((track) => track.stop());
      });
      remoteStreamsRef.current = {};

      // Leave room
      if (socket && consultation?.roomId) {
        socket.emit("leave-room", consultation.roomId);
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

      navigate("/dashboard");
    } catch (error) {
      console.error("Error ending consultation:", error);
      cleanup();
      navigate("/dashboard");
    }
  };

  // Keep refs synchronized with state (avoid stale closures)
  useEffect(() => {
    consultationRef.current = consultation;
  }, [consultation]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
      // Stop transcription
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore errors when stopping during cleanup
        }
      }
      isTranscribingRef.current = false;
      isRecognizingRef.current = false;
      shouldBeActiveRef.current = false;
      
      // Clear restart timeout
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
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
        stream.getTracks().forEach((track) => track.stop());
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
          Consultation with{" "}
          {user.role === "patient"
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
            {!isCallActive && consultation.status === "scheduled" && (
              <button onClick={startConsultation} className="btn-start">
                Start Video Call
              </button>
            )}
            {isCallActive && (
              <>
                <button
                  onClick={toggleVideo}
                  className={`control-btn ${isVideoActive ? "active" : ""}`}
                >
                  {isVideoActive ? "📹" : "📹❌"} Video
                </button>
                <button
                  onClick={toggleAudio}
                  className={`control-btn ${isAudioActive ? "active" : ""}`}
                >
                  {isAudioActive ? "🎤" : "🎤❌"} Audio
                </button>
                <button
                  onClick={
                    isTranscribing ? stopTranscription : startTranscription
                  }
                  className={`control-btn ${isTranscribing ? "active" : ""}`}
                >
                  {isTranscribing ? "⏹️" : "🎙️"} Transcription
                </button>
              </>
            )}
          </div>
        </div>

        <div className="sidebar">
          <div className="chat-section">
            <h3>Chat</h3>
            <div className="messages-container" style={{height:"350px"}}>
  {messages.map((msg, idx) => (
    <div
      key={msg._id || `msg-${idx}-${msg.timestamp}`}
      className={`message ${
        msg.senderRole === user.role ? "own" : "other"
      }`}
    >
      <div className="message-header">
        <strong>
          {msg.senderRole === "patient" ? "Patient" : "Doctor"}
        </strong>
        <span className="timestamp">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* MESSAGE TEXT */}
      {msg.message && (
        <div className="message-text">{msg.message}</div>
      )}

      {/* FILE LINK (USING fileUrl & fileName) */}
      {msg.file && msg.file.fileUrl && (
        <div className="message-text">
          <a
        href={`${import.meta.env.VITE_API_URL.replace("/api", "")}${msg.file.fileUrl}`}
        target="_blank"
        rel="noopener noreferrer"
         >
  📎 {msg.file.fileName}
</a>
        </div>
      )}
    </div>
  ))}

  <div ref={messagesEndRef} />
</div>

            <div className="chat-input">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                disabled={!socketRef.current && !socket}
              />
              <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => setSelectedFile(e.target.files[0])}
            />


              <button
                onClick={sendMessage}
                className="btn-send"
                disabled={!socketRef.current && !socket}
              >
                Send
              </button>
            </div>
          </div>
         <div className="bg-black  rounded-lg p-4 mt-4" style={{backgroundColor:"#2A2A2A"}}>
  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2" style={{color:"#F8FFFF"}}>
    Medical Symptoms
  </h3>

  {medicalHistory.length === 0 ? (
    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
      Medical Symptoms is not provided by the patient.
    </p>
  ) : (
    <div className="flex flex-wrap gap-2">
      {medicalHistory.map((item, index) => (
        <span
          key={index}
          className="px-3 py-1 text-sm rounded-full 
                     bg-blue-100 text-blue-800 
                     dark:bg-blue-900 dark:text-blue-200"
        style={{    border: "2px solid white",borderRadius : "40px"}}
        >
          {item} 
        </span>
      ))}
    </div>
  )}
</div>

          <div className="transcription-section">
            <h3>Transcription</h3>
            <div className="transcription-container" style={{height:"350px"}}>
              {transcription.length === 0 ? (
                <p className="empty-transcription">
                  Transcription will appear here when enabled
                </p>
              ) : (
                transcription.map((entry, idx) => (
                  <div key={idx} className="transcription-entry">
                    <div className="transcription-header">
                      <strong>
                        {entry.senderRole === "patient" ? "Patient:" : "Doctor:"}
                      </strong>
                      <span>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="transcription-text">{entry.text}</div>
                  </div>
                ))
              )}
              <div ref={transcriptionEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Consultation;
