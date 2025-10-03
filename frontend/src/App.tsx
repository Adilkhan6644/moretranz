import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import EmailConfig from './pages/EmailConfig';
import Orders from './pages/Orders';
import './App.css';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/email-config" element={<EmailConfig />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;