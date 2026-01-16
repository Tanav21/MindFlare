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
      setError('Failed to load appointment details');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (tokenResult, buyer) => {
    if (tokenResult.errors) {
      setError('Card tokenization failed. Please check your card details.');
      console.error('Tokenization errors:', tokenResult.errors);
      return;
    }

    try {
      // Process payment on backend
      // tokenResult.token is the card token (sourceId)
      // tokenResult.verificationToken is the buyer verification token (if available)
      const response = await api.post('/payments/process-payment', {
        appointmentId: appointmentId,
        cardData: {
          sourceId: tokenResult.token,
          verificationToken: tokenResult.verificationToken || tokenResult.token,
        },
      });

      if (response.data.success) {
        navigate('/dashboard');
      } else {
        setError(response.data.message || 'Payment failed. Please try again.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          'Payment processing failed. Please try again.';
      setError(errorMessage);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!appointment) {
    return <div className="error">Appointment not found</div>;
  }

  const applicationId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
  const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID;

  if (!applicationId || !locationId) {
    return (
      <div className="payment-page">
        <div className="payment-container">
          <div className="error-message">
            Square payment configuration missing. Please configure VITE_SQUARE_APPLICATION_ID and VITE_SQUARE_LOCATION_ID in your .env file.
          </div>
        </div>
      </div>
    );
  }

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
          {error && <div className="error-message">{error}</div>}
          <PaymentForm
            applicationId={applicationId}
            locationId={locationId}
            cardTokenizeResponseReceived={handlePaymentSuccess}
            createVerificationDetails={() => {
              try {
                // Ensure amount is a valid number and format to 2 decimal places
                const amountValue = parseFloat(appointment.amount);
                if (isNaN(amountValue) || amountValue <= 0) {
                  throw new Error('Invalid appointment amount');
                }
                const amount = amountValue.toFixed(2);
                
                // Get user data with fallbacks to ensure all fields are present and valid
                const firstName = (profile?.firstName || 'Patient').trim();
                const lastName = (profile?.lastName || 'User').trim();
                const email = (user?.email || 'patient@example.com').trim();
                // Phone must be numeric only, remove any non-numeric characters
                let phone = (profile?.phone || '5555555555').replace(/\D/g, '');
                if (!phone || phone.length < 10) {
                  phone = '5555555555'; // Default if invalid
                }
                const addressStreet = (profile?.address?.street || '123 Main St').trim();
                const city = (profile?.address?.city || 'Anytown').trim();
                const state = (profile?.address?.state || 'CA').trim();
                const countryCode = (profile?.address?.country || 'US').trim().toUpperCase();
                let postalCode = (profile?.address?.zipCode || '12345').trim();
                // Ensure postal code is valid format (at least 5 digits for US)
                if (!/^\d{5,10}$/.test(postalCode)) {
                  postalCode = '12345';
                }
                
                // Return verification details in the exact format Square requires
                const verificationDetails = {
                  total: {
                    amount: amount,
                    currencyCode: 'USD',
                  },
                  intent: 'CHARGE',
                  billingContact: {
                    givenName: firstName,
                    familyName: lastName,
                    email: email,
                    phone: phone,
                    addressLines: [addressStreet],
                    city: city,
                    state: state,
                    countryCode: countryCode,
                    postalCode: postalCode,
                  },
                };
                
                console.log('Square verification details:', verificationDetails);
                return verificationDetails;
              } catch (error) {
                console.error('Error creating verification details:', error);
                // Return minimal valid structure as fallback
                return {
                  total: {
                    amount: parseFloat(appointment.amount || 0).toFixed(2),
                    currencyCode: 'USD',
                  },
                  intent: 'CHARGE',
                  billingContact: {
                    givenName: 'Patient',
                    familyName: 'User',
                    email: 'patient@example.com',
                    phone: '5555555555',
                    addressLines: ['123 Main St'],
                    city: 'Anytown',
                    state: 'CA',
                    countryCode: 'US',
                    postalCode: '12345',
                  },
                };
              }
            }}
          >
            <div className="card-section">
              <CreditCard />
              <p className="card-hint">
                Test Card: 4111 1111 1111 1111 | Exp: Any future date | CVV: Any 3 digits
              </p>
            </div>
          </PaymentForm>
        </div>
      </div>
    </div>
  );
};

export default Payment;
