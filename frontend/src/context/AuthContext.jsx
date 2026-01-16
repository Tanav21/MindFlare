import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    let timeoutId;
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await api.get('/auth/me', { signal: controller.signal });
      if (timeoutId) clearTimeout(timeoutId);
      
      setUser(response.data.user);
      setProfile(response.data.profile);
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        console.error('Request timeout - backend may not be running on', import.meta.env.VITE_API_URL || 'http://localhost:5000/api');
      } else {
        console.error('Error fetching user:', error);
      }
      // Clear invalid token
      localStorage.removeItem('token');
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
    setProfile(response.data.profile);
    return response.data;
  };

  const registerPatient = async (userData) => {
    const response = await api.post('/auth/register/patient', userData);
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
    setProfile(response.data.patient);
    return response.data;
  };

  const registerDoctor = async (userData) => {
    const response = await api.post('/auth/register/doctor', userData);
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
    setProfile(response.data.doctor);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        registerPatient,
        registerDoctor,
        logout,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
