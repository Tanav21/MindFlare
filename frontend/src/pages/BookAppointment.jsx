import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './BookAppointment.css';

const BookAppointment = () => {
  const navigate = useNavigate();
  const [specializations, setSpecializations] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSpecializations();
  }, []);

  useEffect(() => {
    if (selectedSpecialization) {
      fetchDoctors();
    }
  }, [selectedSpecialization]);

  const fetchSpecializations = async () => {
    try {
      const response = await api.get('/doctors/specializations');
      setSpecializations(response.data);
    } catch (error) {
      console.error('Error fetching specializations:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await api.get(
        `/doctors?specialization=${selectedSpecialization}&isAvailable=true`
      );
      setDoctors(response.data);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedDoctor || !appointmentDate) {
      setError('Please select a doctor and appointment date');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/appointments', {
        doctorId: selectedDoctor._id,
        specialty: selectedDoctor.specialization,
        appointmentDate: new Date(appointmentDate).toISOString(),
      });

      // Navigate to payment page
      navigate(`/payment/${response.data.appointment._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="book-appointment">
      <div className="book-appointment-container">
        <h1>Book Appointment</h1>
        <div className="booking-form">
          <div className="form-group">
            <label htmlFor="specialization">Select Specialty</label>
            <select
              id="specialization"
              value={selectedSpecialization}
              onChange={(e) => {
                setSelectedSpecialization(e.target.value);
                setSelectedDoctor(null);
              }}
            >
              <option value="">Choose a specialty</option>
              {specializations.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>

          {selectedSpecialization && (
            <div className="form-group">
              <label>Select Doctor</label>
              <div className="doctors-list">
                {doctors.length === 0 ? (
                  <p>No doctors available for this specialty</p>
                ) : (
                  doctors.map((doctor) => (
                    <div
                      key={doctor._id}
                      className={`doctor-card ${
                        selectedDoctor?._id === doctor._id ? 'selected' : ''
                      }`}
                      onClick={() => setSelectedDoctor(doctor)}
                    >
                      <h3>
                        Dr. {doctor.firstName} {doctor.lastName}
                      </h3>
                      <p className="specialization">{doctor.specialization}</p>
                      {doctor.bio && <p className="bio">{doctor.bio}</p>}
                      <div className="doctor-info">
                        <span>Experience: {doctor.experience} years</span>
                        <span className="fee">
                          Fee: ${doctor.consultationFee}
                        </span>
                        {doctor.rating > 0 && (
                          <span>Rating: {doctor.rating.toFixed(1)}/5</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {selectedDoctor && (
            <div className="form-group">
              <label htmlFor="appointmentDate">Select Date & Time</label>
              <input
                type="datetime-local"
                id="appointmentDate"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          {selectedDoctor && appointmentDate && (
            <div className="booking-summary">
              <h3>Booking Summary</h3>
              <p>
                <strong>Doctor:</strong> Dr. {selectedDoctor.firstName}{' '}
                {selectedDoctor.lastName}
              </p>
              <p>
                <strong>Specialty:</strong> {selectedDoctor.specialization}
              </p>
              <p>
                <strong>Date & Time:</strong>{' '}
                {new Date(appointmentDate).toLocaleString()}
              </p>
              <p>
                <strong>Consultation Fee:</strong> ${selectedDoctor.consultationFee}
              </p>
              <button
                onClick={handleBookAppointment}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Booking...' : 'Proceed to Payment'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookAppointment;
