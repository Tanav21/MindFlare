# Quick Network Setup Guide

## 🚀 Quick Start (3 Steps)

### Step 1: Find Your LAN IP
```bash
# Run this helper script
node get-lan-ip.js

# Or manually:
# Windows: ipconfig
# macOS/Linux: ifconfig
```

### Step 2: Update Environment Files

**backend/.env:**
```env
HOST=0.0.0.0
PORT=5000
FRONTEND_URL=http://YOUR_LAN_IP:5173
# Example: FRONTEND_URL=http://192.168.1.100:5173
```

**frontend/.env:**
```env
VITE_API_URL=http://YOUR_LAN_IP:5000/api
# Example: VITE_API_URL=http://192.168.1.100:5000/api
```

### Step 3: Start Servers

**Backend:**
```bash
cd backend
npm start
# Should show: Server running on http://0.0.0.0:5000
```

**Frontend:**
```bash
cd frontend
npm run dev
# Vite is already configured to allow network access
# Should show: Network: http://YOUR_LAN_IP:5173
```

## ✅ Done!

Access from other devices:
- **Frontend:** `http://YOUR_LAN_IP:5173`
- **Backend API:** `http://YOUR_LAN_IP:5000`

## 🔧 TURN Server (For Cross-Network WebRTC)

The code already includes free TURN servers. For production, configure your own:

**frontend/.env:**
```env
VITE_TURN_SERVER=turn:your-turn-server.com:3478
VITE_TURN_USERNAME=your_username
VITE_TURN_CREDENTIAL=your_password
```

See `NETWORK_SETUP.md` for detailed instructions.
