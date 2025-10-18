import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #dfe6ee',
  outline: 'none',
  background: '#fff',
};

const labelStyle: React.CSSProperties = { fontSize: 13, color: '#5b6b7b', marginBottom: 6, display: 'block' };

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the page they were trying to access
  const from = (location.state as any)?.from?.pathname || '/orders';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        try {
          await apiService.register(email, password, fullName);
          console.log('Registration successful');
        } catch (registerErr: any) {
          console.error('Registration error:', registerErr);
          console.error('Error response:', registerErr.response);
          console.error('Error data:', registerErr.response?.data);
          
          if (registerErr.response?.status === 400 && registerErr.response?.data?.detail === 'Email already registered') {
            setError('This email is already registered. Please sign in instead.');
          } else if (registerErr.response?.status === 422) {
            setError('Invalid data provided. Please check your email format and try again.');
          } else {
            setError('Sign up failed. Please try again.');
          }
          return;
        }
      }
      
      try {
        const loginResponse = await apiService.login(email, password);
        console.log('Login successful, response:', loginResponse);
        console.log('Navigating to:', from);
        console.log('Current location:', location.pathname);
        navigate(from, { replace: true });
        console.log('Navigation called');
      } catch (loginErr: any) {
        console.error('Login error:', loginErr);
        setError(mode === 'signup' ? 'Account created but login failed. Please try signing in.' : 'Invalid credentials');
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)', padding: 20 }}>
      <div style={{ width: 380, maxWidth: '94vw', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '26px 26px 10px 26px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ margin: 0, color: '#e2e8f0', fontWeight: 600 }}>{mode === 'login' ? 'Welcome back' : 'Create an account'}</h2>
          <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: 13 }}>MoreTranz Order Processor</p>
        </div>
        <form onSubmit={submit} style={{ padding: 26 }}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>
          )}
          {mode === 'signup' && (
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Full Name</label>
              <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required={mode==='signup'} />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
          </div>
          <div className="form-group" style={{ marginBottom: 6 }}>
            <label style={labelStyle}>Password</label>
            <input type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 12 }}>
            {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign in' : 'Sign up')}
          </button>
          <div style={{ marginTop: 14, textAlign: 'center', color: '#cbd5e1', fontSize: 13 }}>
            {mode === 'login' ? (
              <span>Don’t have an account? <button type="button" className="btn btn-link" onClick={() => setMode('signup')}>Create one</button></span>
            ) : (
              <span>Already have an account? <button type="button" className="btn btn-link" onClick={() => setMode('login')}>Sign in</button></span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

