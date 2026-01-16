# Environment Variables Setup

This document contains all the required environment variables for the Telehealth Solution project with demo values.

## Backend `.env` File

Create a file named `.env` in the `backend` directory with the following content:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
# For local MongoDB: mongodb://localhost:27017/telehealth
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/telehealth
MONGODB_URI=mongodb://localhost:27017/telehealth

# JWT Secret Key (Change this in production!)
# Generate a secure random string for production use
JWT_SECRET=demo_jwt_secret_key_change_this_in_production_use_random_string

# Square Payment Configuration
# Get your credentials from: https://developer.squareup.com/apps
# Sign up for a Square Developer account to get sandbox credentials
SQUARE_APPLICATION_ID=sandbox-sq0idb-XXXXXXXXXXXXXXXXXXXXXXXX
SQUARE_ACCESS_TOKEN=sandbox-sq0atb-XXXXXXXXXXXXXXXXXXXXXXXX
SQUARE_LOCATION_ID=LID_DEMO_LOCATION_123456789
SQUARE_ENVIRONMENT=sandbox
SQUARE_WEBHOOK_SECRET=demo_webhook_secret_key_for_square_webhooks

# Frontend URL (for CORS and Socket.io)
FRONTEND_URL=http://localhost:5173
```

## Frontend `.env` File

Create a file named `.env` in the `frontend` directory with the following content:

```env
# API Configuration
# Backend API URL (without /api suffix, it's added in api.js)
VITE_API_URL=http://localhost:5000/api

# Square Payment Configuration
# Get your credentials from: https://developer.squareup.com/apps
# These should match the Square credentials in backend/.env
VITE_SQUARE_APPLICATION_ID=sandbox-sq0idb-XXXXXXXXXXXXXXXXXXXXXXXX
VITE_SQUARE_LOCATION_ID=LID_DEMO_LOCATION_123456789
```

## How to Get Square Credentials

1. **Sign up for Square Developer Account**
   - Go to https://developer.squareup.com
   - Create a free developer account

2. **Create a Square Application**
   - Navigate to the Developer Dashboard
   - Click "New Application"
   - Fill in application details

3. **Get Sandbox Credentials**
   - In your application dashboard, go to "Credentials"
   - Copy the following:
     - **Application ID** → `SQUARE_APPLICATION_ID` and `VITE_SQUARE_APPLICATION_ID`
     - **Access Token** → `SQUARE_ACCESS_TOKEN` (backend only)
     - **Location ID** → `SQUARE_LOCATION_ID` and `VITE_SQUARE_LOCATION_ID`

4. **Test Environment**
   - Use "Sandbox" environment for testing
   - Set `SQUARE_ENVIRONMENT=sandbox` in backend `.env`
   - For production, use `SQUARE_ENVIRONMENT=production` and production credentials

## Square Test Cards

For testing payments in sandbox mode, use these test card numbers:

- **Success**: `4111 1111 1111 1111`
- **Decline**: `4000 0000 0000 0002`
- **Insufficient Funds**: `4000 0000 0000 9995`

For all test cards:
- **Expiry Date**: Any future date (e.g., 12/25)
- **CVV**: Any 3 digits (e.g., 123)
- **ZIP Code**: Any 5 digits (e.g., 12345)

## Important Notes

1. **Never commit `.env` files to version control** - They are already in `.gitignore`

2. **Change demo values in production**:
   - Use strong, random JWT_SECRET
   - Use production MongoDB connection string
   - Use production Square credentials
   - Set NODE_ENV=production

3. **Security**:
   - Keep your `SQUARE_ACCESS_TOKEN` secret (backend only)
   - Application ID and Location ID can be public (used in frontend)
   - Never expose access tokens in frontend code

4. **Environment Variables**:
   - Backend uses `process.env.VARIABLE_NAME`
   - Frontend uses `import.meta.env.VITE_VARIABLE_NAME` (must start with `VITE_`)

## Quick Setup Commands

### Backend
```bash
cd backend
# Create .env file with the content above
npm install
npm run dev
```

### Frontend
```bash
cd frontend
# Create .env file with the content above
npm install
npm run dev
```

## Troubleshooting

- **Payment not working?** Check that Square credentials match in both backend and frontend `.env` files
- **CORS errors?** Verify `FRONTEND_URL` in backend `.env` matches your frontend URL
- **Database connection failed?** Ensure MongoDB is running and `MONGODB_URI` is correct
- **Square SDK errors?** Verify all Square environment variables are set correctly
