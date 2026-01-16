# Setup Instructions

## Prerequisites

1. **Node.js** (v18 or higher) and npm
2. **PostgreSQL** database (local or remote)
3. **Stripe Account** (for payment processing)

## Step-by-Step Setup

### 1. Install Dependencies

From the root directory, run:
```bash
npm run install:all
```

This will install dependencies for both frontend and backend.

### 2. Database Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE mindflare_telehealth;
```

2. Update the `DATABASE_URL` in `backend/.env`:
```
DATABASE_URL="postgresql://username:password@localhost:5432/mindflare_telehealth?schema=public"
```

3. Run Prisma migrations:
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

4. Seed the database with specialties:
```bash
npm run seed
```

### 3. Environment Variables

#### Backend (`backend/.env`)
Create `backend/.env` from `backend/.env.example` and fill in:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mindflare_telehealth?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

#### Frontend (`frontend/.env.local`)
Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

### 4. Stripe Setup

1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Stripe Dashboard
3. Add the **Secret Key** to `backend/.env` as `STRIPE_SECRET_KEY`
4. Add the **Publishable Key** to `frontend/.env.local` as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
5. For webhooks (optional, for production):
   - Set up a webhook endpoint in Stripe Dashboard pointing to `http://your-domain.com/api/payments/webhook`
   - Add the webhook secret to `backend/.env` as `STRIPE_WEBHOOK_SECRET`

### 5. Run the Application

From the root directory:
```bash
npm run dev
```

This starts both:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### 6. Create Your First Account

1. Navigate to http://localhost:3000
2. Click "Sign Up"
3. Register as either a Patient or Doctor
4. If registering as a Doctor, provide your specialty and license number

## Testing the Application

### As a Patient:
1. Register/Login
2. Book a consultation (select specialty, date/time, amount)
3. Complete payment via Stripe test card: `4242 4242 4242 4242`
4. Join the consultation when scheduled
5. Use video call, chat, and transcription features

### As a Doctor:
1. Register/Login as a Doctor
2. View consultations assigned to you
3. Join consultations and interact with patients

## Stripe Test Cards

For testing payments, use these test card numbers:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- Use any future expiry date and any 3-digit CVC

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify DATABASE_URL is correct
- Check database exists and user has permissions

### Stripe Payment Issues
- Verify API keys are correct
- Ensure you're using test keys (sk_test_... and pk_test_...)
- Check browser console for errors

### Video Call Issues
- Ensure microphone and camera permissions are granted
- Check browser supports WebRTC (Chrome, Firefox, Safari, Edge)
- Verify Socket.IO connection is established

### Transcription Issues
- Transcription uses Web Speech API (browser-dependent)
- Works best in Chrome/Edge
- May require HTTPS in production

## Production Deployment

Before deploying to production:

1. **Security**:
   - Change JWT_SECRET to a strong random string
   - Use production Stripe keys
   - Enable HTTPS
   - Set up proper CORS origins

2. **Database**:
   - Use a managed PostgreSQL service
   - Set up database backups
   - Configure connection pooling

3. **Environment**:
   - Set NODE_ENV=production
   - Update FRONTEND_URL to production domain
   - Configure Stripe webhooks for production

4. **HIPAA Compliance**:
   - Review data encryption at rest and in transit
   - Implement audit logging
   - Set up proper access controls
   - Consider using HIPAA-compliant hosting

## Support

For issues or questions, check:
- Backend logs: Check terminal running `npm run dev:backend`
- Frontend logs: Check browser console and terminal running `npm run dev:frontend`
- Database: Check Prisma Studio with `npx prisma studio`
