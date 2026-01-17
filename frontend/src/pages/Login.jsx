import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (response) => {
    setError('');
    setGoogleLoading(true);

    try {
      // Google Sign-In callback can receive either:
      // 1. A string (credential) directly
      // 2. An object with { credential: string }
      let credential;
      if (typeof response === 'string') {
        credential = response;
      } else if (response && response.credential) {
        credential = response.credential;
      } else {
        throw new Error('Invalid response from Google Sign-In');
      }

      // Validate credential is a JWT-like string
      if (!credential || typeof credential !== 'string' || !credential.includes('.')) {
        throw new Error('Invalid credential format received from Google');
      }

      const role = 'patient';
      await loginWithGoogle(credential, role);
      navigate('/dashboard');
    } catch (err) {
      console.error('Google Sign-In error:', err);
      setError(err.response?.data?.message || err.message || 'Google login failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    if (!googleClientId) {
      console.warn('Google Client ID not configured. Google Sign-In will not work.');
      return;
    }

    // Initialize Google Sign-In when the library loads
    const initializeGoogleSignIn = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        // Configure Google Sign-In with callback
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleSignIn,
        });

        // Render the button (this avoids FedCM issues)
        if (window.google.accounts.id.renderButton) {
          window.google.accounts.id.renderButton(
            document.getElementById('google-signin-button'),
            {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'signin_with',
              locale: 'en',
            }
          );
        }
      }
    };

    // Wait for Google script to load
    if (window.google && window.google.accounts) {
      initializeGoogleSignIn();
    } else {
      const interval = setInterval(() => {
        if (window.google && window.google.accounts) {
          initializeGoogleSignIn();
          clearInterval(interval);
        }
      }, 100);

      setTimeout(() => clearInterval(interval), 10000);
    }

    // Cleanup
    return () => {
      const button = document.getElementById('google-signin-button');
      if (button) {
        button.innerHTML = '';
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoogleButtonClick = () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    if (!googleClientId) {
      setError('Google Sign-In is not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file.');
      return;
    }

    // The button click is handled by Google's rendered button
    // But we can also trigger programmatically if needed
    if (window.google && window.google.accounts && window.google.accounts.id) {
      setGoogleLoading(true);
      window.google.accounts.id.prompt();
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">

        {/* 🔐 Login Icon */}
        <div className="login-icon">
          🔐
        </div>

        <h1>Welcome Back</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        {/* Google Sign-In Button Container */}
        <div id="google-signin-button" style={{ width: '100%', marginBottom: '20px' }}></div>

        {/* Fallback Custom Button (if Google button doesn't render) */}
        <button
          onClick={handleGoogleButtonClick}
          disabled={googleLoading || loading}
          className="btn-google"
          type="button"
          style={{ display: 'none' }}
          id="google-fallback-button"
        >
          {googleLoading ? (
            'Signing in...'
          ) : (
            <>
              <svg
                className="google-icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <p className="register-link">
          Don&apos;t have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
