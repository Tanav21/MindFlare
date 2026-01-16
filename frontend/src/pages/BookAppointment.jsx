import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserMd, FaBriefcase, FaDollarSign, FaStar, FaCalendarAlt } from 'react-icons/fa';
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
    if (selectedSpecialization) fetchDoctors();
  }, [selectedSpecialization]);

  const fetchSpecializations = async () => {
    try {
      const response = await api.get('/doctors/specializations');
      setSpecializations(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await api.get(
        `/doctors?specialization=${selectedSpecialization}&isAvailable=true`
      );
      setDoctors(response.data);
    } catch (error) {
      console.error(error);
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
        <p className="step-indicator">Step 1 of 3 • Choose Doctor & Time</p>

        <div className="booking-form">
          <div className="form-group">
            <label>Select Specialty</label>
            <select
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
                  <p className="empty-state">🩺 No doctors available</p>
                ) : (
                  doctors.map((doctor) => (
                    <div
                      key={doctor._id}
                      className={`doctor-card ${
                        selectedDoctor?._id === doctor._id ? 'selected' : ''
                      }`}
                      onClick={() => setSelectedDoctor(doctor)}
                    >
                      <div className="doctor-avatar">
                        {doctor.firstName[0]}
                        {doctor.lastName[0]}
                      </div>

                      <h3 className="doctor-name">
                        <FaUserMd className="doctor-icon" />
                               Dr. {doctor.firstName} {doctor.lastName}
                          </h3>


                      <p className="specialization">{doctor.specialization}</p>

                      {doctor.bio && <p className="bio">{doctor.bio}</p>}

                      <div className="doctor-info">
                        <span>
                          <FaBriefcase /> {doctor.experience} yrs
                        </span>
                        <span className="fee">
                          <FaDollarSign /> ${doctor.consultationFee}
                        </span>
                        {doctor.rating > 0 && (
                          <span>
                            <FaStar /> {doctor.rating.toFixed(1)}
                          </span>
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
              <label className="label-with-icon">
                <FaCalendarAlt className="label-icon" />
                 Select Date & Time
              </label>

              <input
                type="datetime-local"
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
              <p><strong>Doctor:</strong> Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</p>
              <p><strong>Specialty:</strong> {selectedDoctor.specialization}</p>
              <p><strong>Date & Time:</strong> {new Date(appointmentDate).toLocaleString()}</p>
              <p><strong>Fee:</strong> ${selectedDoctor.consultationFee}</p>

              <button
                onClick={handleBookAppointment}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Booking...' : 'Proceed to Payment'}
              </button>

              <p className="trust-text">🔒 Secure & HIPAA Compliant</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookAppointment;
