import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PaymentForm, CreditCard } from 'react-square-web-payments-sdk';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './Payment.css';

const Payment = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAppointment();
  }, []);

  const fetchAppointment = async () => {
    try {
      const response = await api.get(`/appointments/${appointmentId}`);
      setAppointment(response.data.appointment);
    } catch (error) {
      console.error('Error fetching appointment:', error);
      setError('Failed to load appointment details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (tokenResult, buyer) => {
    console.log('Card tokenization result:', {
      token: tokenResult.token ? tokenResult.token.substring(0, 10) + '...' : 'missing',
      hasErrors: !!tokenResult.errors,
      errors: tokenResult.errors,
      verificationToken: tokenResult.verificationToken ? 'present' : 'missing'
    });

    if (tokenResult.errors) {
      const errorMessages = tokenResult.errors.map(err => err.message || err.type).join(', ');
      setError(`Card tokenization failed: ${errorMessages}`);
      console.error('Tokenization errors:', tokenResult.errors);
      setProcessing(false);
      return;
    }

    if (!tokenResult.token) {
      setError('Failed to process card. Please try again.');
      setProcessing(false);
      return;
    }

    setProcessing(true);
    setError('');

    try {
      // Process payment on backend
      const response = await api.post('/payments/process-payment', {
        appointmentId: appointmentId,
        cardData: {
          sourceId: tokenResult.token,
          verificationToken: tokenResult.verificationToken || null,
        },
      });

      console.log('Payment response:', response.data);

      if (response.data.success) {
        // Payment successful
        navigate('/dashboard', { 
          state: { 
            message: 'Payment completed successfully! Your appointment is confirmed.' 
          } 
        });
      } else {
        // Payment failed
        const errorMsg = response.data.error || response.data.message || 'Payment failed. Please try again.';
        setError(errorMsg);
        setProcessing(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
      
      // Extract error message
      let errorMessage = 'Payment processing failed. Please try again.';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.errors) {
        // Handle Square error array
        const errors = Array.isArray(err.response.data.errors) 
          ? err.response.data.errors 
          : [err.response.data.errors];
        errorMessage = errors.map(e => e.detail || e.code || e.message || 'Payment error').join(', ');
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="payment-page">
        <div className="payment-container">
          <div className="loading">Loading appointment details...</div>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="payment-page">
        <div className="payment-container">
          <div className="error-message">
            Appointment not found. Please check the appointment ID and try again.
          </div>
        </div>
      </div>
    );
  }

  const applicationId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
  const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID;

  if (!applicationId || !locationId) {
    return (
      <div className="payment-page">
        <div className="payment-container">
          <div className="error-message">
            <h3>Configuration Error</h3>
            <p>Square payment gateway is not configured. Please ensure the following environment variables are set:</p>
            <ul>
              <li>VITE_SQUARE_APPLICATION_ID</li>
              <li>VITE_SQUARE_LOCATION_ID</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Prepare verification details with proper fallbacks
 const getVerificationDetails = () => {
  return {
    intent: 'CHARGE',
    total: {
      amount: Number(appointment.amount).toFixed(2),
      currencyCode: 'USD',
    },
    billingContact: {
      givenName: 'John',
      familyName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+15555555555',
      addressLines: ['123 Main St'],
      city: 'San Francisco',
      state: 'CA',
      countryCode: 'US',
      postalCode: '94103',
    },
  };
};

  return (
    <div className="payment-page">
      <div className="payment-container">
        <h1>Complete Payment</h1>
        <div className="appointment-info">
          <h3>Appointment Details</h3>
          <p>
            <strong>Doctor:</strong> Dr. {appointment.doctorId?.firstName}{' '}
            {appointment.doctorId?.lastName}
          </p>
          <p>
            <strong>Specialty:</strong> {appointment.specialty}
          </p>
          <p>
            <strong>Date:</strong>{' '}
            {new Date(appointment.appointmentDate).toLocaleString()}
          </p>
        </div>
        <div className="payment-form">
          <div className="payment-amount">
            <h2>Payment Amount</h2>
            <p className="amount">${appointment.amount}</p>
          </div>
          
          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}

          {processing && (
            <div className="processing-message">
              Processing payment... Please do not close this page.
            </div>
          )}

          <PaymentForm
  applicationId={applicationId}
  locationId={locationId}
  cardTokenizeResponseReceived={handlePaymentSuccess}
>
            <div className="card-section">
              <CreditCard />
              <p className="card-hint">
                <strong>Test Card:</strong> 4111 1111 1111 1111 | <strong>Exp:</strong> Any future date | <strong>CVV:</strong> Any 3 digits | <strong>ZIP:</strong> Any 5 digits
              </p>
            </div>
          </PaymentForm>
        </div>
      </div>
    </div>
  );
};

export default Payment;
