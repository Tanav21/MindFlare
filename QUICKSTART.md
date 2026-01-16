# Quick Start Guide

## Prerequisites

1. **MongoDB**: Install MongoDB locally or use MongoDB Atlas (free tier available)
2. **Node.js**: Version 14 or higher
3. **Stripe Account**: Sign up at https://stripe.com (free test account)

## Step-by-Step Setup

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file (copy from .env.example)
# Edit .env with your MongoDB URI and Stripe keys

# Start MongoDB (if running locally)
# Windows: net start MongoDB
# Mac/Linux: mongod

# Start the backend server
npm run dev
```

Backend will run on `http://localhost:5000`

### 2. Frontend Setup

```bash
# Open a new terminal
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env file
# Add:
# VITE_API_URL=http://localhost:5000/api
# VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here

# Start the frontend server
npm run dev
```

Frontend will run on `http://localhost:5173`

### 3. Test the Application

1. **Register as Patient**:
   - Go to http://localhost:5173/register
   - Select "Patient"
   - Fill in the form and register

2. **Register as Doctor** (optional, for testing):
   - Go to http://localhost:5173/register
   - Select "Doctor"
   - Fill in the form (use any license number for testing)

3. **Book Appointment**:
   - Login as patient
   - Click "Book New Appointment"
   - Select specialty and doctor
   - Choose date/time
   - Proceed to payment

4. **Test Payment**:
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any CVC

5. **Start Consultation**:
   - After payment, appointment will be confirmed
   - Click "Start Consultation" when ready
   - Enable video/audio
   - Test chat and transcription features

## Environment Variables

### Backend (.env)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/telehealth
JWT_SECRET=your_super_secret_jwt_key_change_this
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
NODE_ENV=development
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

## Important Notes

1. **MongoDB**: Make sure MongoDB is running before starting the backend
2. **Stripe Keys**: Get your test keys from https://dashboard.stripe.com/test/apikeys
3. **Video Calling**: Current implementation uses basic WebRTC. For production, you'll need:
   - Signaling server (Socket.io can be used)
   - STUN/TURN servers for NAT traversal
   - Consider using services like Twilio, Agora, or Daily.co
4. **Transcription**: Uses Web Speech API (browser-based). For production, consider:
   - Google Cloud Speech-to-Text
   - AWS Transcribe
   - Azure Speech Services
5. **HTTPS**: Web Speech API requires HTTPS in production
6. **Security**: Change JWT_SECRET in production and use secure MongoDB connection strings

## Troubleshooting

### Backend won't start
- Check if MongoDB is running
- Verify PORT is not in use
- Check .env file exists and has correct values

### Frontend can't connect to backend
- Verify backend is running on port 5000
- Check VITE_API_URL in frontend .env
- Check CORS settings in backend

### Payment not working
- Verify Stripe keys are correct
- Check browser console for errors
- Ensure you're using test keys, not live keys

### Video not working
- Allow camera/microphone permissions in browser
- Check browser console for errors
- Try different browser (Chrome recommended)

### Transcription not working
- Web Speech API requires HTTPS (except localhost)
- Check browser compatibility (Chrome/Edge recommended)
- Allow microphone permissions

## Next Steps

1. Set up production MongoDB (MongoDB Atlas)
2. Configure production Stripe account
3. Set up proper WebRTC signaling and TURN servers
4. Implement production-grade transcription service
5. Add email notifications
6. Implement appointment reminders
7. Add file upload for medical documents
8. Implement prescription management
9. Add review/rating system
10. Set up monitoring and logging
