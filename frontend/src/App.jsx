import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import BookAppointment from './pages/BookAppointment';
import Payment from './pages/Payment';
import Consultation from './pages/Consultation';
import './App.css';
import ConsultationReport from './pages/ConsultationReport';

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/dashboard" replace /> : <Register />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/book-appointment"
        element={
          <ProtectedRoute requireRole="patient">
            <BookAppointment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment/:appointmentId"
        element={
          <ProtectedRoute requireRole="patient">
            <Payment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consultation/:appointmentId"
        element={
          <ProtectedRoute>
            <Consultation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consultation-report/:id"
        element={
          <ProtectedRoute>
            <ConsultationReport />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/" 
        element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} 
      />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
