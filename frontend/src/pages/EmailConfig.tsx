import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Mail, Shield, Clock, Users } from 'lucide-react';
import { apiService } from '../services/api';

interface EmailConfig {
  email_address: string;
  email_password: string;
  imap_server: string;
  allowed_senders: string;
  max_age_days: number;
  sleep_time: number;
}

const EmailConfig: React.FC = () => {
  const [config, setConfig] = useState<EmailConfig>({
    email_address: '',
    email_password: '',
    imap_server: 'imap.gmail.com',
    allowed_senders: '',
    max_age_days: 10,
    sleep_time: 5
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await apiService.getEmailConfig();
      setConfig(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load email configuration');
      console.error('Config fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiService.updateEmailConfig(config);
      setSuccess('Email configuration saved successfully!');
    } catch (err) {
      setError('Failed to save email configuration');
      console.error('Config save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof EmailConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="loading">
        <RefreshCw size={24} />
        <p>Loading email configuration...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: '30px', color: '#2c3e50' }}>Email Configuration</h1>
      
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Mail size={20} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
            Email Settings
          </h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSave}>
            <div className="row">
              <div className="col-6">
                <div className="form-group">
                  <label className="form-label">
                    <Mail size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    value={config.email_address}
                    onChange={(e) => handleInputChange('email_address', e.target.value)}
                    placeholder="your-email@gmail.com"
                    required
                  />
                  <small style={{ color: '#7f8c8d', fontSize: '12px' }}>
                    The email address that will receive order emails
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Shield size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    App Password
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    value={config.email_password}
                    onChange={(e) => handleInputChange('email_password', e.target.value)}
                    placeholder="Your Gmail App Password"
                    required
                  />
                  <small style={{ color: '#7f8c8d', fontSize: '12px' }}>
                    Use Gmail App Password, not your regular password
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">IMAP Server</label>
                  <input
                    type="text"
                    className="form-control"
                    value={config.imap_server}
                    onChange={(e) => handleInputChange('imap_server', e.target.value)}
                    placeholder="imap.gmail.com"
                    required
                  />
                </div>
              </div>

              <div className="col-6">
                <div className="form-group">
                  <label className="form-label">
                    <Users size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Allowed Senders
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={config.allowed_senders}
                    onChange={(e) => handleInputChange('allowed_senders', e.target.value)}
                    placeholder="sender1@gmail.com, sender2@gmail.com"
                    required
                  />
                  <small style={{ color: '#7f8c8d', fontSize: '12px' }}>
                    Comma-separated list of email addresses allowed to send orders
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Clock size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Max Email Age (days)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={config.max_age_days}
                    onChange={(e) => handleInputChange('max_age_days', parseInt(e.target.value))}
                    min="1"
                    max="30"
                    required
                  />
                  <small style={{ color: '#7f8c8d', fontSize: '12px' }}>
                    Only process emails newer than this many days
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">Sleep Time (seconds)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={config.sleep_time}
                    onChange={(e) => handleInputChange('sleep_time', parseInt(e.target.value))}
                    min="1"
                    max="60"
                    required
                  />
                  <small style={{ color: '#7f8c8d', fontSize: '12px' }}>
                    Time to wait between email checks
                  </small>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '30px', textAlign: 'right' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={fetchConfig}
                style={{ marginRight: '10px' }}
              >
                <RefreshCw size={16} style={{ marginRight: '8px' }} />
                Reset
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                <Save size={16} style={{ marginRight: '8px' }} />
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Help Section */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Setup Instructions</h2>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-6">
              <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Gmail Setup</h4>
              <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                <li>Enable 2-Factor Authentication on your Gmail account</li>
                <li>Generate an App Password for this application</li>
                <li>Use the App Password (not your regular password)</li>
                <li>Keep IMAP enabled in Gmail settings</li>
              </ol>
            </div>
            <div className="col-6">
              <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Security Notes</h4>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                <li>Only trusted email addresses should be in allowed senders</li>
                <li>App passwords are safer than regular passwords</li>
                <li>Regularly review and update allowed senders list</li>
                <li>Monitor the system for any unauthorized access</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailConfig;
