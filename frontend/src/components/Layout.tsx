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
  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/orders', label: 'Orders', icon: FileText },
    { path: '/email-config', label: 'Email Config', icon: Mail },
  ];

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
            {!isAuthed && (
              <li className="nav-item">
                <Link to="/login" className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}>
                  <Settings size={18} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
                  Login
                </Link>
              </li>
            )}
          </ul>
        </nav>
        {isAuthed && (
          <div style={{ marginTop: 'auto', padding: '12px' }}>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { apiService.logout(); window.location.href = '/login'; }}>
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
