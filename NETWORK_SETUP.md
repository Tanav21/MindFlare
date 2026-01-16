# Network Setup for Cross-Device Access

This guide explains how to configure the application to work across multiple devices on your local network.

## Problem

By default, the backend binds to `localhost`, which only allows connections from the same machine. To access the application from other devices (phones, tablets, other computers), you need to:

1. Bind backend to `0.0.0.0` (all network interfaces)
2. Use your LAN IP address instead of `localhost`
3. Configure TURN servers for WebRTC cross-network connections

## Step 1: Find Your LAN IP Address

### Windows
```powershell
ipconfig
# Look for "IPv4 Address" under your active network adapter
# Example: 192.168.1.100
```

### macOS/Linux
```bash
ifconfig
# or
ip addr show
# Look for inet address (not 127.0.0.1)
# Example: 192.168.1.100
```

### Alternative (All Platforms)
```bash
# Run this in terminal to get your LAN IP
node -e "const os=require('os');const nets=os.networkInterfaces();for(const name of Object.keys(nets)){for(const net of nets[name]){if(net.family==='IPv4'&&!net.internal){console.log(net.address);break;}}}"
```

## Step 2: Update Backend Configuration

### Backend `.env` File

Update `backend/.env`:

```env
# Server Configuration
PORT=5000
HOST=0.0.0.0  # Bind to all interfaces
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/telehealth

# JWT Secret Key
JWT_SECRET=your_secret_key

# Frontend URL - Replace YOUR_LAN_IP with your actual LAN IP
# Example: FRONTEND_URL=http://192.168.1.100:5173
FRONTEND_URL=http://YOUR_LAN_IP:5173

# Optional: Allow multiple frontend URLs (comma-separated)
# FRONTEND_URL=http://localhost:5173,http://192.168.1.100:5173
```

**Important:** Replace `YOUR_LAN_IP` with your actual LAN IP address (e.g., `192.168.1.100`).

## Step 3: Update Frontend Configuration

### Frontend `.env` File

Update `frontend/.env`:

```env
# API Configuration - Replace YOUR_LAN_IP with your actual LAN IP
# Example: VITE_API_URL=http://192.168.1.100:5000/api
VITE_API_URL=http://YOUR_LAN_IP:5000/api

# Socket URL (optional, defaults to VITE_API_URL without /api)
# VITE_SOCKET_URL=http://YOUR_LAN_IP:5000

# TURN Server Configuration (for WebRTC cross-network)
# Option 1: Use free public TURN servers (default, may have rate limits)
# No configuration needed

# Option 2: Use your own TURN server
# VITE_TURN_SERVER=turn:your-turn-server.com:3478
# VITE_TURN_USERNAME=your_username
# VITE_TURN_CREDENTIAL=your_password

# Option 3: Use Metered.ca free TURN (already configured in code)
# No additional configuration needed
```

**Important:** Replace `YOUR_LAN_IP` with your actual LAN IP address.

## Step 4: Start Vite with Network Access

By default, Vite only binds to localhost. To allow network access:

### Option 1: Command Line Flag
```bash
cd frontend
npm run dev -- --host
```

### Option 2: Update `vite.config.js`
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow network access
    port: 5173,
  },
})
```

## Step 5: Access from Other Devices

1. **Start Backend:**
   ```bash
   cd backend
   npm start
   ```
   Should show: `Server running on http://0.0.0.0:5000`

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev -- --host
   ```
   Should show: `Local: http://localhost:5173` and `Network: http://YOUR_LAN_IP:5173`

3. **Access from Other Devices:**
   - Open browser on phone/tablet/other computer
   - Navigate to: `http://YOUR_LAN_IP:5173`
   - Example: `http://192.168.1.100:5173`

## Step 6: TURN Server Configuration (For WebRTC)

WebRTC requires TURN servers when devices are on different networks (different WiFi, mobile data, etc.).

### Free TURN Server Options

1. **Metered.ca (Already Configured)**
   - Free tier available
   - Already added to code
   - May have rate limits

2. **Twilio STUN/TURN**
   - Free tier: 10,000 minutes/month
   - Sign up at: https://www.twilio.com/stun-turn

3. **Xirsys**
   - Free tier available
   - Sign up at: https://xirsys.com/

### Using Twilio TURN (Recommended for Production)

1. Sign up for Twilio account
2. Get TURN credentials from Twilio Console
3. Update `frontend/.env`:
   ```env
   VITE_TURN_SERVER=turn:global.turn.twilio.com:3478?transport=udp
   VITE_TURN_USERNAME=your_twilio_username
   VITE_TURN_CREDENTIAL=your_twilio_credential
   ```

### Using Your Own TURN Server

If you want to host your own TURN server using coturn:

```bash
# Install coturn
sudo apt-get install coturn  # Ubuntu/Debian
brew install coturn          # macOS

# Configure /etc/turnserver.conf
listening-port=3478
realm=yourdomain.com
user=username:password

# Start coturn
sudo systemctl start coturn
```

Then update `frontend/.env`:
```env
VITE_TURN_SERVER=turn:YOUR_SERVER_IP:3478
VITE_TURN_USERNAME=username
VITE_TURN_CREDENTIAL=password
```

## Troubleshooting

### Backend Not Accessible from Other Devices

1. **Check Firewall:**
   ```bash
   # Windows: Allow port 5000 in Windows Firewall
   # macOS: System Preferences > Security > Firewall
   # Linux: sudo ufw allow 5000
   ```

2. **Verify Binding:**
   - Backend should show: `Server running on http://0.0.0.0:5000`
   - If it shows `localhost`, check `HOST` in `.env`

3. **Test Backend:**
   ```bash
   # From another device, test:
   curl http://YOUR_LAN_IP:5000
   # Should return: {"message":"Telehealth API Server is running"}
   ```

### Frontend Not Accessible

1. **Check Vite Host:**
   - Must use `--host` flag or configure in `vite.config.js`
   - Should show "Network: http://YOUR_LAN_IP:5173"

2. **Check CORS:**
   - Backend `FRONTEND_URL` must include your LAN IP
   - Can include multiple URLs: `http://localhost:5173,http://YOUR_LAN_IP:5173`

### WebRTC Not Connecting Across Networks

1. **Check TURN Server:**
   - Open browser console
   - Look for `[WebRTC] turn-server-configured` or `using-public-turn-servers`
   - If using public TURN, may hit rate limits

2. **Test Connection:**
   - Same network: Should work with STUN only
   - Different networks: Requires TURN server

3. **Verify ICE Candidates:**
   - Check browser console for ICE candidate logs
   - Should see both host and relay candidates

## Quick Setup Script

Create a file `get-lan-ip.js` in project root:

```javascript
const os = require('os');
const nets = os.networkInterfaces();

console.log('\n=== Network Configuration ===\n');
console.log('Your LAN IP addresses:');
for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    if (net.family === 'IPv4' && !net.internal) {
      console.log(`  ${name}: ${net.address}`);
      console.log(`\nBackend URL: http://${net.address}:5000`);
      console.log(`Frontend URL: http://${net.address}:5173`);
      console.log(`\nUpdate backend/.env:`);
      console.log(`FRONTEND_URL=http://${net.address}:5173`);
      console.log(`\nUpdate frontend/.env:`);
      console.log(`VITE_API_URL=http://${net.address}:5000/api\n`);
    }
  }
}
```

Run: `node get-lan-ip.js`

## Security Notes

⚠️ **Important for Production:**

1. **Never expose to public internet without:**
   - HTTPS/SSL certificates
   - Proper authentication
   - Rate limiting
   - Firewall rules

2. **LAN access is for development/testing only**

3. **For production deployment:**
   - Use a proper hosting service (AWS, Heroku, etc.)
   - Set up domain name with SSL
   - Use production TURN servers
   - Implement proper security measures
