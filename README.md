# Telehealth Solution for access to Healthcare from anywhere (Use Case 2) - MERN Stack
<h3>Team MindFlare</h3>
<br />
<h4>Demo Video : <a href="https://drive.google.com/file/d/1NJhia69FLdut2MVN-Wf1YLT5gH0qfrnJ/view?usp=sharing" target="_blank">Video Link</a></h4>

<h4>Problem Statement</h4>
<p> Post pandemic, world has changed significantly. Quick access to quality, affordable and reliable healthcare from anywhere is the need of the hour. People are confined in remote locations in their homes and hence there is an urgent need to come up with a digitally enabled solution</p>

<h4>Solution</h4>
A comprehensive telehealth platform that enables remote healthcare consultations with video calling, real-time chat, payment processing, and transcription services.

## Features

1. **User Authentication**
   - Patient and Doctor registration/login
   - Secure JWT-based authentication
   - Role-based access control

2. **Appointment Management**
   - Browse doctors by specialty
   - Book appointments with preferred doctors
   - View appointment history

3. **Payment Integration**
   - Square payment processing
   - Secure payment before consultation
   - Payment status tracking

4. **Video Consultation**
   - WebRTC-based video calling
   - Audio/video controls
   - Real-time consultation experience

5. **Real-time Chat**
   - Socket.io-powered chat during consultations
   - Message history
   - Secure communication

6. **Transcription Service**
   - Web Speech API integration
   - Real-time transcription during consultations
   - Overcome dialect/accent challenges
   - Transcription history

7. **PHI Data Security**
   - Encrypted data storage
   - Secure API endpoints
   - HIPAA-compliant data handling

## Tech Stack

### Backend
- Node.js & Express.js
- MongoDB & Mongoose
- Socket.io (Real-time communication)
- Square (Payment processing)
- JWT (Authentication)
- bcryptjs (Password hashing)

### Frontend
- React.js
- React Router
- Socket.io Client
- Square Web Payments SDK
- Web Speech API
- WebRTC

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Square Developer account (for payment processing)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/telehealth
JWT_SECRET=your_jwt_secret_key_here_change_in_production
SQUARE_APPLICATION_ID=sandbox-sq0idb-XXXXXXXXXXXXXXXXXXXXXXXX
SQUARE_ACCESS_TOKEN=sandbox-sq0atb-XXXXXXXXXXXXXXXXXXXXXXXX
SQUARE_LOCATION_ID=LID_DEMO_LOCATION_123456789
SQUARE_ENVIRONMENT=sandbox
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

4. Start the server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SQUARE_APPLICATION_ID=sandbox-sq0idb-XXXXXXXXXXXXXXXXXXXXXXXX
VITE_SQUARE_LOCATION_ID=LID_DEMO_LOCATION_123456789
```

4. Start the development server:
```bash
npm run dev
```

## Usage

1. **Register/Login**: Create an account as a patient or doctor
2. **Book Appointment**: Patients can browse doctors by specialty and book appointments
3. **Make Payment**: Complete payment before consultation begins
4. **Start Consultation**: Join video call at scheduled time
5. **Chat & Transcription**: Use chat and transcription features during consultation

## Project Structure

```
MindFlare/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Patient.js
│   │   ├── Doctor.js
│   │   ├── Appointment.js
│   │   └── Consultation.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── appointments.js
│   │   ├── doctors.js
│   │   ├── payments.js
│   │   └── consultations.js
│   ├── middleware/
│   │   └── auth.js
│   ├── utils/
│   │   └── generateToken.js
│   └── index.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── README.md
```

## Security Features

- Password hashing with bcryptjs
- JWT token authentication
- Protected API routes
- Secure payment processing
- Encrypted data storage
- PHI data protection

## API Endpoints

### Authentication
- `POST /api/auth/register/patient` - Register patient
- `POST /api/auth/register/doctor` - Register doctor
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Appointments
- `POST /api/appointments` - Create appointment
- `GET /api/appointments` - Get appointments
- `GET /api/appointments/:id` - Get appointment by ID

### Doctors
- `GET /api/doctors` - Get all doctors
- `GET /api/doctors/specializations` - Get specializations
- `GET /api/doctors/:id` - Get doctor by ID

### Payments
- `POST /api/payments/create-intent` - Create payment intent
- `POST /api/payments/confirm` - Confirm payment

### Consultations
- `GET /api/consultations/room/:roomId` - Get consultation
- `POST /api/consultations/:roomId/start` - Start consultation
- `POST /api/consultations/:roomId/end` - End consultation
- `POST /api/consultations/:roomId/transcription` - Add transcription

## Notes

- Ensure MongoDB is running before starting the backend
- Configure Square credentials for payment processing (get from Square Developer Dashboard)
- For production, update JWT_SECRET and use secure MongoDB connection
- Web Speech API requires HTTPS in production
- WebRTC may require TURN/STUN servers for production deployment
- Square test card: 4111 1111 1111 1111 (any future expiry, any CVV)

## License

ISC
