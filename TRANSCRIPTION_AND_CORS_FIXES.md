# Transcription and CORS Fixes

## Issues Fixed

### 1. **CORS Error - Preflight Request Failure**
**Problem:** 
- `Access to XMLHttpRequest at 'http://192.168.1.10:5000/api/auth/login' from origin 'http://localhost:5173' has been blocked by CORS policy`
- Preflight requests were not being handled properly

**Solution:**
- Updated CORS middleware to use a function-based origin check
- Added support for localhost variations and LAN IPs in development
- Added explicit preflight handling with `app.options('*', cors())`
- Allows requests from both `localhost:5173` and LAN IP addresses

**Backend Changes (`backend/index.js`):**
```javascript
// Now supports:
- http://localhost:5173
- http://127.0.0.1:5173
- http://192.168.x.x:5173 (LAN IPs in development)
- Custom URLs from FRONTEND_URL env variable
```

### 2. **Transcription Not Working - Real-Time Updates**
**Problem:**
- Transcription was using API calls instead of Socket.IO
- No real-time updates between doctor and patient
- Transcription entries not properly labeled

**Solution:**
- Switched from REST API to Socket.IO for real-time transcription
- Both doctor and patient see all transcription entries in one panel
- Proper labeling with "Doctor:" and "Patient:" prefixes
- Auto-scroll to latest transcription entry
- Duplicate prevention

## Implementation Details

### Frontend Changes (`frontend/src/pages/Consultation.jsx`)

1. **Socket.IO Transcription Listener**
   - Added `transcription-update` socket event listener
   - Receives real-time transcription from server
   - Updates state for both doctor and patient
   - Prevents duplicate entries

2. **Web Speech API Integration**
   - Sends transcription via Socket.IO instead of REST API
   - Auto-restarts on errors (no-speech, audio-capture)
   - Continuous recognition with interim results

3. **UI Updates**
   - Added `transcriptionEndRef` for auto-scroll
   - Proper labeling: "Doctor:" and "Patient:"
   - Loads existing transcription from database on mount
   - Auto-scrolls to bottom when new entries arrive

### Backend Changes (`backend/index.js`)

1. **CORS Configuration**
   ```javascript
   // Function-based origin check
   origin: (origin, callback) => {
     if (!origin) return callback(null, true); // Allow no-origin requests
     if (frontendUrls.includes(origin)) return callback(null, true);
     // Development: allow localhost and LAN IPs
     if (process.env.NODE_ENV !== 'production') {
       // Pattern matching for localhost variations
     }
   }
   ```

2. **Transcription Socket Handler**
   - Validates incoming transcription data
   - Saves to MongoDB with proper schema
   - Broadcasts to all users in the room
   - Proper error handling and logging

3. **Preflight Request Handling**
   ```javascript
   app.options('*', cors()); // Handle all preflight requests
   ```

## Transcription Schema

The transcription is stored in MongoDB with the following structure:
```javascript
{
  senderId: String,      // User ID or socket ID
  senderRole: String,    // 'doctor' or 'patient'
  text: String,          // Transcribed text
  timestamp: Date        // When it was transcribed
}
```

## How It Works

1. **User speaks** → Web Speech API captures audio
2. **Speech recognized** → Frontend sends via Socket.IO `transcription-update` event
3. **Server receives** → Validates, saves to MongoDB
4. **Server broadcasts** → Sends to all users in the room via Socket.IO
5. **All users receive** → Updates transcription panel in real-time
6. **UI updates** → Shows "Doctor:" or "Patient:" label with timestamp

## Testing Checklist

- [x] CORS allows requests from localhost:5173
- [x] CORS allows requests from LAN IP (192.168.x.x:5173)
- [x] Preflight requests handled correctly
- [x] Transcription works for doctor
- [x] Transcription works for patient
- [x] Both see each other's transcriptions in real-time
- [x] Transcription saved to MongoDB
- [x] Transcription loads from database on page refresh
- [x] Auto-scroll works
- [x] Duplicate prevention works
- [x] Proper labeling (Doctor:/Patient:)

## Environment Variables

**Backend (`.env`):**
```env
FRONTEND_URL=http://localhost:5173,http://192.168.1.10:5173
# Or for production:
FRONTEND_URL=https://your-domain.com
```

**Frontend (`.env`):**
```env
VITE_API_URL=http://192.168.1.10:5000/api
# Or use VITE_SOCKET_URL for Socket.IO
VITE_SOCKET_URL=http://192.168.1.10:5000
```

## Notes

- Transcription requires HTTPS in production (or localhost for development)
- Web Speech API is browser-dependent (Chrome/Edge recommended)
- Both doctor and patient must have transcription enabled to see each other's speech
- Transcription is stored in MongoDB and can be used later with Google Gemini for medical summaries
