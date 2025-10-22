import React from 'react';
import { getAuthToken, apiService } from '../services/api';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  FileText, 
  Settings, 
  Mail,
  Activity
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const isAuthed = !!getAuthToken();
  const isLoginPage = location.pathname === '/login';
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/orders', label: 'Orders', icon: FileText },
    { path: '/email-config', label: 'Email Config', icon: Mail },
  ];

  // For login page, don't show sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="layout">
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-header">
          <h1>MoreTranz Order Processor</h1>
        </div>
        <nav>
          <ul className="sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <li key={item.path} className="nav-item">
                  <Link 
                    to={item.path} 
                    className={`nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={18} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {isAuthed && (
          <div style={{ marginTop: 'auto', padding: '12px' }}>
            <button 
              className="btn btn-secondary" 
              style={{ width: '100%' }} 
              onClick={async () => { 
                try {
                  console.log('🚪 Logout button clicked');
                  await apiService.logout();
                  console.log('🔄 Redirecting to login...');
                  // Small delay to ensure token clearing takes effect
                  setTimeout(() => {
                    window.location.href = '/login';
                  }, 100);
                } catch (error) {
                  console.error('❌ Logout error:', error);
                  // Force redirect even if logout fails
                  window.location.href = '/login';
                }
              }}
            >
              Logout
            </button>
          </div>
        )}
      </aside>
      
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
