const express = require('express');
const router = express.Router();
const { Client, Environment } = require('square');
const { auth, requireRole } = require('../middleware/auth');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' 
    ? Environment.Production 
    : Environment.Sandbox,
});

// @route   POST /api/payments/create-payment
// @desc    Create payment for appointment
// @access  Private (Patient)
router.post('/create-payment', auth, requireRole('patient'), async (req, res) => {
  try {
    const { appointmentId, sourceId, verificationToken } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const patient = await Patient.findOne({ userId: req.user.userId });
    if (appointment.patientId.toString() !== patient._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (appointment.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Payment already completed' });
    }

    // Convert amount to cents (Square uses cents)
    const amount = Math.round(appointment.amount * 100);

    // Create payment request
    const requestBody = {
      sourceId: sourceId,
      idempotencyKey: `${appointmentId}-${Date.now()}`,
      amountMoney: {
        amount: amount,
        currency: 'USD',
      },
      verificationToken: verificationToken,
      note: `Payment for appointment ${appointmentId}`,
    };

    const { result, statusCode } = await squareClient.paymentsApi.createPayment(requestBody);

    if (statusCode !== 200 || result.payment?.status !== 'COMPLETED') {
      return res.status(400).json({ 
        message: 'Payment failed', 
        error: result.errors || 'Unknown error' 
      });
    }

    // Update appointment with payment ID
    appointment.paymentIntentId = result.payment.id;
    appointment.paymentStatus = 'paid';
    appointment.status = 'confirmed';
    await appointment.save();

    res.json({
      message: 'Payment completed successfully',
      payment: {
        id: result.payment.id,
        status: result.payment.status,
      },
      appointment,
    });
  } catch (error) {
    console.error('Square payment error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message || 'Payment processing failed' 
    });
  }
});

// @route   POST /api/payments/process-payment
// @desc    Process payment with card details (server-side)
// @access  Private (Patient)
router.post('/process-payment', auth, requireRole('patient'), async (req, res) => {
  try {
    const { appointmentId, cardData } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const patient = await Patient.findOne({ userId: req.user.userId });
    if (appointment.patientId.toString() !== patient._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (appointment.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Payment already completed' });
    }

    // Convert amount to cents
    const amount = Math.round(appointment.amount * 100);

    // Create card payment
    const requestBody = {
      sourceId: cardData.sourceId,
      idempotencyKey: `${appointmentId}-${Date.now()}`,
      amountMoney: {
        amount: amount,
        currency: 'USD',
      },
      locationId: process.env.SQUARE_LOCATION_ID,
      verificationToken: cardData.verificationToken,
      note: `Payment for appointment ${appointmentId}`,
    };

    const { result, statusCode } = await squareClient.paymentsApi.createPayment(requestBody);

    if (statusCode !== 200) {
      return res.status(400).json({ 
        message: 'Payment failed', 
        errors: result.errors || 'Unknown error' 
      });
    }

    // Update appointment
    appointment.paymentIntentId = result.payment?.id;
    
    if (result.payment?.status === 'COMPLETED') {
      appointment.paymentStatus = 'paid';
      appointment.status = 'confirmed';
    }
    
    await appointment.save();

    res.json({
      success: result.payment?.status === 'COMPLETED',
      payment: result.payment,
      appointment,
    });
  } catch (error) {
    console.error('Square payment error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message || 'Payment processing failed' 
    });
  }
});

// @route   GET /api/payments/appointment/:appointmentId
// @desc    Get payment details for appointment
// @access  Private (Patient)
router.get('/appointment/:appointmentId', auth, requireRole('patient'), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const patient = await Patient.findOne({ userId: req.user.userId });
    if (appointment.patientId.toString() !== patient._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    res.json({
      amount: appointment.amount,
      paymentStatus: appointment.paymentStatus,
      paymentIntentId: appointment.paymentIntentId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/payments/webhook
// @desc    Square webhook handler
// @access  Public (Square)
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const signature = req.headers['x-square-signature'];
    const webhookSecret = process.env.SQUARE_WEBHOOK_SECRET;

    // Verify webhook signature (Square provides signature verification)
    // For production, implement proper signature verification
    
    const event = req.body;
    
    if (event.type === 'payment.updated' && event.data?.object?.payment) {
      const payment = event.data.object.payment;
      
      if (payment.status === 'COMPLETED') {
        const appointment = await Appointment.findOne({
          paymentIntentId: payment.id,
        });

        if (appointment) {
          appointment.paymentStatus = 'paid';
          appointment.status = 'confirmed';
          await appointment.save();
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
