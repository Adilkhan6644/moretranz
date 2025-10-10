import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Mail, Shield, Clock, Users, CheckCircle2, XCircle, Download, FolderOpen } from 'lucide-react';
import { apiService } from '../services/api';

interface EmailConfig {
  email_address: string;
  email_password: string;
  imap_server: string;
  allowed_senders: string;
  max_age_days: number;
  sleep_time: number;
  auto_download_enabled: boolean;
  download_path?: string;
}

const Config: React.FC = () => {
  const [config, setConfig] = useState<EmailConfig>({
    email_address: '',
    email_password: '',
    imap_server: 'imap.gmail.com',
    allowed_senders: '',
    max_age_days: 10,
    sleep_time: 5,
    auto_download_enabled: false,
    download_path: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{valid: boolean, message: string} | null>(null);

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

  const handleValidateCredentials = async () => {
    if (!config.email_address || !config.email_password) {
      setValidationResult({
        valid: false,
        message: 'Please enter both email address and password'
      });
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      const response = await apiService.validateEmailCredentials(
        config.email_address,
        config.email_password,
        config.imap_server
      );
      setValidationResult(response.data);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Failed to validate credentials';
      setValidationResult({
        valid: false,
        message: errorMessage
      });
    } finally {
      setValidating(false);
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
      setValidationResult(null); // Clear validation result after successful save
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || 'Failed to save email configuration';
      setError(errorMessage);
      console.error('Config save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof EmailConfig, value: string | number | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectPath = () => {
    // For web browsers, we can't directly access the file system for security reasons
    // We'll use a more user-friendly modal instead of the basic prompt
    const currentPath = config.download_path || 'C:\\Downloads\\MoreTranz\\Attachments';
    
    // Create a more sophisticated dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;
    
    dialog.innerHTML = `
      <div style="
        background: white;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        max-width: 500px;
        width: 90%;
        font-family: Arial, sans-serif;
      ">
        <h3 style="margin-top: 0; color: #333;">📁 Set Download Path</h3>
        <p style="color: #666; margin-bottom: 20px;">
          Enter the folder path where attachments will be saved:
        </p>
        <input type="text" id="pathInput" value="${currentPath}" style="
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 5px;
          font-size: 14px;
          margin-bottom: 15px;
        " />
        <div style="margin-bottom: 15px;">
          <strong>Examples:</strong><br/>
          • <code>C:\\Downloads\\MoreTranz\\Attachments</code><br/>
          • <code>D:\\MyFiles\\Orders</code><br/>
          • <code>/home/user/downloads</code>
        </div>
        <div style="text-align: right;">
          <button id="cancelBtn" style="
            background: #f5f5f5;
            border: 1px solid #ddd;
            padding: 10px 20px;
            margin-right: 10px;
            border-radius: 5px;
            cursor: pointer;
          ">Cancel</button>
          <button id="okBtn" style="
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
          ">OK</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    const pathInput = dialog.querySelector('#pathInput') as HTMLInputElement;
    const okBtn = dialog.querySelector('#okBtn') as HTMLButtonElement;
    const cancelBtn = dialog.querySelector('#cancelBtn') as HTMLButtonElement;
    
    pathInput.focus();
    pathInput.select();
    
    const cleanup = () => {
      document.body.removeChild(dialog);
    };
    
    okBtn.onclick = () => {
      const newPath = pathInput.value.trim();
      if (newPath) {
        setConfig(prev => ({ ...prev, download_path: newPath }));
      }
      cleanup();
    };
    
    cancelBtn.onclick = cleanup;
    
    // Close on escape key
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', handleKeyPress);
      } else if (e.key === 'Enter') {
        okBtn.click();
        document.removeEventListener('keydown', handleKeyPress);
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
  };

  if (loading) {
    return (
      <div className="loading">
        <RefreshCw size={24} />
        <p>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: '30px', color: '#2c3e50' }}>Configuration</h1>
      
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

            {/* Auto-Download Settings */}
            <div className="row">
              <div className="col-12">
                <div style={{ 
                  border: '1px solid #e9ecef', 
                  borderRadius: '8px', 
                  padding: '20px', 
                  marginTop: '20px',
                  backgroundColor: '#f8f9fa'
                }}>
                  <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '18px' }}>
                    <Download size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Auto-Download Settings
                  </h3>
                  
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        id="auto_download_enabled"
                        checked={config.auto_download_enabled}
                        onChange={(e) => handleInputChange('auto_download_enabled', e.target.checked)}
                        style={{ marginRight: '10px', transform: 'scale(1.2)' }}
                      />
                      <label htmlFor="auto_download_enabled" style={{ margin: 0, cursor: 'pointer' }}>
                        Automatically download attachments to local PC
                      </label>
                    </div>
                    <small style={{ color: '#7f8c8d', fontSize: '12px', marginLeft: '30px' }}>
                      When enabled, all processed attachments will be automatically saved to the specified folder
                    </small>
                  </div>

                  {config.auto_download_enabled && (
                    <div className="form-group">
                      <label className="form-label">
                        <FolderOpen size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                        Download Path
                      </label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                          type="text"
                          className="form-control"
                          value={config.download_path || ''}
                          onChange={(e) => handleInputChange('download_path', e.target.value)}
                          placeholder="C:\Downloads\MoreTranz\Attachments"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={handleSelectPath}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          <FolderOpen size={16} style={{ marginRight: '5px' }} />
                          Set Path
                        </button>
                      </div>
                      <small style={{ color: '#7f8c8d', fontSize: '12px' }}>
                        Enter the full path to a folder where attachments will be automatically saved.<br/>
                        <strong>Tip:</strong> You can copy the path from Windows Explorer by right-clicking in the address bar.
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Validation Result */}
            {validationResult && (
              <div 
                className={`alert ${validationResult.valid ? 'alert-success' : 'alert-error'}`}
                style={{ marginTop: '20px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {validationResult.valid ? (
                    <CheckCircle2 size={16} style={{ marginRight: '8px' }} />
                  ) : (
                    <XCircle size={16} style={{ marginRight: '8px' }} />
                  )}
                  {validationResult.message}
                </div>
              </div>
            )}

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
                type="button"
                className="btn btn-outline"
                onClick={handleValidateCredentials}
                disabled={validating || !config.email_address || !config.email_password}
                style={{ marginRight: '10px' }}
              >
                <Shield size={16} style={{ marginRight: '8px' }} />
                {validating ? 'Validating...' : 'Test Credentials'}
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

export default Config;
