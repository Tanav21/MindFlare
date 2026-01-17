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
  FaCalendarTimes,
  FaInfoCircle
} from 'react-icons/fa';

const ITEMS_PER_PAGE = 12;

const Dashboard = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

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

  /* PAGINATION */
  const totalPages = Math.ceil(appointments.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAppointments = appointments.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

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
              {paginatedAppointments.length === 0 ? (
                <div className="empty-state">
                  <FaCalendarTimes size={40} />
                  <p>No appointments yet. Book your first consultation!</p>
                </div>
              ) : (
                paginatedAppointments.map((appointment) => (
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
                      {new Date(appointment.appointmentDate).toLocaleString()}
                    </p>

                    {/* ✅ STATUS UPDATED (ICON + TEXT OUTSIDE, PILL ONLY VALUE) */}
                    <p className="date">
                      <FaInfoCircle /> Status:
                      <span
                        className={`status status-${appointment.status}`}
                        style={{ marginLeft: 2 }}
                      >
                        {appointment.status}
                      </span>
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
                        className="btn-secondary-consult"
                      >
                        <FaVideo />
                        Start Consultation
                      </button>
                    )}
                    {appointment.status === 'completed' && (
                      <button
                        onClick={() =>
                          navigate(`/consultation-report/${appointment._id}`)
                        }
                        className="btn-secondary"
                      >
                        <FaInfoCircle />
                        Show Consultation Details
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
              {paginatedAppointments.length === 0 ? (
                <div className="empty-state">
                  <FaCalendarTimes size={40} />
                  <p>No appointments scheduled yet.</p>
                </div>
              ) : (
                paginatedAppointments.map((appointment) => (
                  <div key={appointment._id} className="appointment-card">
                    <h3>
                      {appointment.patientId?.firstName}{' '}
                      {appointment.patientId?.lastName}
                    </h3>

                    <p className="specialty">{appointment.specialty}</p>

                    <p className="date">
                      <FaCalendarAlt />{' '}
                      {new Date(appointment.appointmentDate).toLocaleString()}
                    </p>

                    {/* ✅ STATUS UPDATED HERE TOO */}
                    <p className="date">
                      <FaInfoCircle /> Status:
                      <span
                        className={`status status-${appointment.status}`}
                        style={{ marginLeft: 8 }}
                      >
                        {appointment.status}
                      </span>
                    </p>

                    {appointment.status === 'confirmed' && (
                      <button
                        onClick={() =>
                          navigate(`/consultation/${appointment._id}`)
                        }
                        className="btn-secondary-consult"
                      >
                        <FaVideo />
                        Start Consultation
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="pagination-container">
            <button
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              ‹ Prev
            </button>

            <div className="pagination-pages">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  className={`pagination-page ${
                    currentPage === i + 1 ? 'active' : ''
                  }`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              className="pagination-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
