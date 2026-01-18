# MindFlare Telehealth - Features Documentation

## Overview

MindFlare Telehealth is a comprehensive web application that enables remote healthcare consultations with all the features required for a modern telehealth platform.

## Core Features

### 1. ✅ Instant Health Consultation
- **Video Calling**: Real-time video consultations using WebRTC technology
- **Peer-to-Peer Connection**: Direct connection between patient and doctor
- **High Quality**: Clear audio and video for effective consultations
- **Controls**: Mute/unmute audio, turn video on/off, end call functionality

### 2. ✅ Patient Information Capture
- **Registration System**: Complete patient registration with:
  - Personal information (name, email, phone, date of birth)
  - Medical history
  - Allergies
  - Role-based registration (Patient/Doctor)
- **Doctor Registration**: Additional fields for doctors:
  - Specialty selection
  - License number
  - Professional bio
- **Secure Storage**: All PHI data stored securely in PostgreSQL database

### 3. ✅ Specialty Selection & Booking
- **Specialty Management**: Pre-configured medical specialties:
  - General Practice
  - Cardiology
  - Dermatology
  - Pediatrics
  - Psychiatry
  - Orthopedics
  - Neurology
  - Gynecology
  - Ophthalmology
  - ENT
- **Appointment Booking**: 
  - Select specialty
  - Choose date and time
  - Set consultation fee
  - Automatic room ID generation for video calls

### 4. ✅ Payment Processing
- **Stripe Integration**: Secure payment processing before consultation
- **Payment Flow**:
  1. Patient books consultation
  2. Redirected to payment page
  3. Enter card details (Stripe Elements)
  4. Payment processed securely
  5. Consultation unlocked after successful payment
- **Payment Status Tracking**: Real-time payment status updates
- **Webhook Support**: Server-side payment confirmation via Stripe webhooks

### 5. ✅ PHI Data Security & Privacy
- **Encryption**: 
  - Passwords hashed with bcrypt
  - JWT tokens for authentication
  - HTTPS-ready (for production)
- **Access Control**:
  - Role-based authentication (Patient/Doctor/Admin)
  - Consultation access restricted to participants only
  - Secure API endpoints with authentication middleware
- **Data Privacy**:
  - PHI data stored securely in database
  - No exposure of sensitive data in API responses
  - Secure session management

### 6. ✅ Real-time Chat
- **In-App Messaging**: Chat functionality during consultations
- **Socket.IO Integration**: Real-time bidirectional communication
- **Message History**: All messages saved to database for future reference
- **User Identification**: Clear indication of sender (patient/doctor)
- **Timestamps**: Message timestamps for record keeping

### 7. ✅ Transcription Service
- **Live Transcription**: Real-time speech-to-text conversion
- **Web Speech API**: Browser-based transcription service
- **Dialect/Accent Support**: Helps overcome communication barriers
- **Transcription Storage**: Saved to consultation record for future reference
- **Toggle Control**: Start/stop transcription as needed

## Technical Architecture

### Frontend
- **Framework**: Next.js 14 (React)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation
- **Video**: Simple-Peer (WebRTC wrapper)
- **Real-time**: Socket.IO Client
- **Payments**: Stripe React components

### Backend
- **Framework**: Express.js (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens
- **Real-time**: Socket.IO
- **Payments**: Stripe API
- **Security**: bcrypt for password hashing

### Database Schema
- **Users**: Patient and doctor accounts
- **Specialties**: Medical specialties
- **Consultations**: Appointment records
- **Messages**: Chat messages
- **Payments**: Payment transactions

## User Flows

### Patient Flow
1. Register/Login → Dashboard
2. Book Consultation → Select specialty, date/time, amount
3. Payment → Enter card details, complete payment
4. Join Consultation → Video call, chat, transcription
5. View History → Past consultations and records

### Doctor Flow
1. Register/Login → Dashboard
2. View Consultations → See assigned consultations
3. Join Consultation → Video call with patient
4. Access Records → View consultation history and notes

## Security Features

- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ Role-based access control
- ✅ Secure API endpoints
- ✅ CORS configuration
- ✅ Input validation with Zod
- ✅ SQL injection prevention (Prisma ORM)
- ✅ XSS protection (React default)

## Future Enhancements

Potential additions for production:
- Email notifications
- SMS reminders
- File upload (prescriptions, reports)
- Prescription management
- Appointment reminders
- Doctor availability calendar
- Rating and review system
- Multi-language support
- Mobile app (React Native)
- Advanced transcription with AI
- Screen sharing during calls
- Recording consultations (with consent)