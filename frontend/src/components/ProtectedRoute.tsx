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
    // Check for token with a small delay to ensure localStorage is available
    const checkAuth = () => {
      const authToken = getAuthToken();
      setToken(authToken);
      setIsChecking(false);
    };

    // Small delay to ensure localStorage is ready
    const timer = setTimeout(checkAuth, 100);
    return () => clearTimeout(timer);
  }, []);

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
