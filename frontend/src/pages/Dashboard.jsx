import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './Dashboard.css';

/* ICONS */
import {
  FaStethoscope,
  FaCalendarPlus,
  FaCalendarAlt,
  FaVideo,
  FaMoneyBillWave,
  FaCalendarTimes
} from 'react-icons/fa';

const Dashboard = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const response = await api.get('/appointments');
      setAppointments(response.data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      {/* NAVBAR */}
      <nav className="dashboard-nav">
        <h1 className="brand">
          <FaStethoscope className="brand-icon" />
          Telehealth Platform
        </h1>

        <div className="nav-actions">
          <span>Welcome, {profile?.firstName || user?.email}</span>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        {/* PATIENT VIEW */}
        {user?.role === 'patient' && (
          <>
            <div className="dashboard-header">
              <h2>Your Appointments</h2>
              <button
                onClick={() => navigate('/book-appointment')}
                className="btn-primary"
              >
                <FaCalendarPlus style={{ marginRight: 8 }} />
                Book New Appointment
              </button>
            </div>

            <div className="appointments-grid">
              {appointments.length === 0 ? (
                <div className="empty-state">
                  <FaCalendarTimes size={40} />
                  <p>No appointments yet. Book your first consultation!</p>
                </div>
              ) : (
                appointments.map((appointment) => (
                  <div key={appointment._id} className="appointment-card">
                    <h3>
                      Dr. {appointment.doctorId?.firstName}{' '}
                      {appointment.doctorId?.lastName}
                    </h3>

                    <p className="specialty">
                      {appointment.doctorId?.specialization}
                    </p>

                    <p className="date">
                      <FaCalendarAlt />{' '}
                      {new Date(
                        appointment.appointmentDate
                      ).toLocaleString()}
                    </p>

                    {/* ✅ STATUS TEXT UPDATED HERE */}
                    <p className={`status status-${appointment.status}`}>
                      Status:{' '}
                      {appointment.status.charAt(0).toUpperCase() +
                        appointment.status.slice(1)}
                    </p>

                    <p className="payment-status">
                      <FaMoneyBillWave /> Payment:{' '}
                      {appointment.paymentStatus}
                    </p>

                    {appointment.status === 'confirmed' && (
                      <button
                        onClick={() =>
                          navigate(`/consultation/${appointment._id}`)
                        }
                        className="btn-secondary"
                      >
                        <FaVideo style={{ marginRight: 8 }} />
                        Start Consultation
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* DOCTOR VIEW */}
        {user?.role === 'doctor' && (
          <>
            <div className="dashboard-header">
              <h2>Your Appointments</h2>
            </div>

            <div className="appointments-grid">
              {appointments.length === 0 ? (
                <div className="empty-state">
                  <FaCalendarTimes size={40} />
                  <p>No appointments scheduled yet.</p>
                </div>
              ) : (
                appointments.map((appointment) => (
                  <div key={appointment._id} className="appointment-card">
                    <h3>
                      {appointment.patientId?.firstName}{' '}
                      {appointment.patientId?.lastName}
                    </h3>

                    <p className="specialty">
                      {appointment.specialty}
                    </p>

                    <p className="date">
                      <FaCalendarAlt />{' '}
                      {new Date(
                        appointment.appointmentDate
                      ).toLocaleString()}
                    </p>

                    {/* ✅ STATUS TEXT UPDATED HERE */}
                    <p className={`status status-${appointment.status}`}>
                      Status:{' '}
                      {appointment.status.charAt(0).toUpperCase() +
                        appointment.status.slice(1)}
                    </p>

                    {appointment.status === 'confirmed' && (
                      <button
                        onClick={() =>
                          navigate(`/consultation/${appointment._id}`)
                        }
                        className="btn-secondary"
                      >
                        <FaVideo style={{ marginRight: 8 }} />
                        Start Consultation
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
