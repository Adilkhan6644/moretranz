import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAuthToken } from '../services/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Check for token immediately
    const checkAuth = () => {
      try {
        const authToken = getAuthToken();
        console.log('🔐 ProtectedRoute: Auth token check:', authToken ? 'Present' : 'Missing');
        setToken(authToken);
        setIsChecking(false);
      } catch (error) {
        console.error('❌ ProtectedRoute: Error checking auth token:', error);
        setToken(null);
        setIsChecking(false);
      }
    };

    // Check immediately, no delay needed
    checkAuth();
    
    // Add a timeout as a safety net
    const timeout = setTimeout(() => {
      if (isChecking) {
        console.warn('⚠️ ProtectedRoute: Auth check timeout, assuming no token');
        setIsChecking(false);
        setToken(null);
      }
    }, 5000); // 5 second timeout
    
    return () => clearTimeout(timeout);
  }, [isChecking]);

  // Show loading while checking authentication
  if (isChecking) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)'
      }}>
        <div style={{ 
          color: '#e2e8f0', 
          fontSize: '16px',
          textAlign: 'center'
        }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!token) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
