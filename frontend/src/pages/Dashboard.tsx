import React, { useState, useEffect } from 'react';
import { Play, Square, Activity, Mail, FileText, AlertCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { apiService } from '../services/api';
import websocketService, { OrderData, StatusData } from '../services/websocket';

interface DashboardStats {
  totalOrders: number;
  processingOrders: number;
  completedOrders: number;
  failedOrders: number;
  isProcessing: boolean;
}
const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    processingOrders: 0,
    completedOrders: 0,
    failedOrders: 0,
    isProcessing: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<'start' | 'stop' | null>(null);

  useEffect(() => {
    // Initial setup
    const init = async () => {
      await fetchDashboardData();
      
      // Get initial processing status
      try {
        const status = await apiService.getProcessingStatus();
        const isProcessing = status.data?.is_processing || false;
        setStats(prev => ({ ...prev, isProcessing }));
        
        // If processing is active, connect to WebSocket
        if (isProcessing) {
          websocketService.connect();
        }
      } catch (err) {
        console.error('Failed to get initial status:', err);
      }
    };
    
    init();
    
    // Set up WebSocket listeners
    const handleNewOrder = (order: OrderData) => {
      console.log('📦 New order received via WebSocket:', order);
      // Refresh dashboard data to get accurate counts
      fetchDashboardData();
    };

    const handleStatusUpdate = (status: StatusData) => {
      console.log('📊 Status update received via WebSocket:', status);
      setStats(prev => ({
        ...prev,
        isProcessing: status.is_processing
      }));
      
      // Connect or disconnect WebSocket based on processing status
      if (status.is_processing) {
        websocketService.connect();
      } else {
        websocketService.disconnect();
      }
    };

    websocketService.onNewOrder(handleNewOrder);
    websocketService.onStatusUpdate(handleStatusUpdate);

    // Cleanup
    return () => {
      websocketService.off('new_order', handleNewOrder);
      websocketService.off('status_update', handleStatusUpdate);
      websocketService.disconnect();
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [ordersResponse, processingStatus] = await Promise.all([
        apiService.getAllOrders(),
        apiService.getProcessingStatus()
      ]);

      const orders = ordersResponse.data || [];
      const isProcessing = processingStatus.data?.is_processing || false;
      
      // Update WebSocket connection based on processing status
      if (isProcessing) {
        websocketService.connect();
      } else {
        websocketService.disconnect();
      }

      const stats: DashboardStats = {
        totalOrders: orders.length,
        processingOrders: orders.filter((o: any) => o.status === 'processing').length,
        completedOrders: orders.filter((o: any) => o.status === 'completed').length,
        failedOrders: orders.filter((o: any) => o.status === 'failed').length,
        isProcessing
      };

      setStats(stats);
      setError(null);
    } catch (err) {
      setError('Failed to fetch dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartProcessing = async () => {
    try {
      setProcessingAction('start');
      setError(null); // Clear any previous errors
      
      const response = await apiService.startProcessing();
      
      // Connect WebSocket immediately after starting
      websocketService.connect();
      
      // Give the background task a moment to start before checking status
      setTimeout(() => {
        fetchDashboardData();
        setProcessingAction(null);
      }, 1000);
    } catch (err: any) {
      // Extract error message from API response
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to start processing';
      setError(errorMessage);
      setProcessingAction(null);
      websocketService.disconnect(); // Ensure WebSocket is disconnected on error
    }
  };
  interface handleStopProcessingProps {
    className:string;
    disabled:boolean;
    style:React.CSSProperties;
    onClick:() => void;
    children:React.ReactNode;
    onMouseEnter:() => void;
    onMouseLeave:() => void;
    onMouseDown:() => void;
  }
  const handleStopProcessing = async () => {
    try {
      setProcessingAction('stop');
      await apiService.stopProcessing();
      
      // Disconnect WebSocket immediately after stopping
      websocketService.disconnect();
      
      // Give the stop command a moment to take effect before checking status
      setTimeout(() => {
        fetchDashboardData();
        setProcessingAction(null);
      }, 1000);
    } catch (err) {
      setError('Failed to stop processing');
      setProcessingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <Loader2 size={40} className="animate-spin" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: '30px', color: '#2c3e50' }}>Dashboard</h1>
      
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          {error}
        </div>
      )}

      {/* Control Panel */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Email Processing Control</h2>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div 
                style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  backgroundColor: stats.isProcessing ? '#27ae60' : '#95a5a6' 
                }} 
              />
              <span style={{ fontWeight: '500' }}>
                Status: {stats.isProcessing ? 'Processing' : 'Stopped'}
              </span>
            </div>
            
            {stats.isProcessing ? (
              <button 
                className="btn btn-danger"
                onClick={handleStopProcessing}
                disabled={processingAction === 'stop'}
                style={{ minWidth: '150px' }}
              >
                {processingAction === 'stop' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Square size={16} style={{ marginRight: '8px' }} />
                    Stop Processing
                  </>
                )}
              </button>
            ) : (
              <button 
                className="btn btn-success"
                onClick={handleStartProcessing}
                disabled={processingAction === 'start'}
                style={{ minWidth: '150px' }}
              >
                {processingAction === 'start' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play size={16} style={{ marginRight: '8px' }} />
                    Start Processing
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.totalOrders}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-number" style={{ color: '#f39c12' }}>
            {stats.processingOrders}
          </div>
          <div className="stat-label">Processing</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-number" style={{ color: '#27ae60' }}>
            {stats.completedOrders}
          </div>
          <div className="stat-label">Completed</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-number" style={{ color: '#e74c3c' }}>
            {stats.failedOrders}
          </div>
          <div className="stat-label">Failed</div>
        </div>
      </div>

      {/* System Status */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">System Status</h2>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-6">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <Mail size={20} style={{ marginRight: '10px', color: '#3498db' }} />
                <span>Email Monitoring: <strong>{stats.isProcessing ? 'Active' : 'Inactive'}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <FileText size={20} style={{ marginRight: '10px', color: '#3498db' }} />
                <span>PDF Conversion: <strong>Ready</strong></span>
              </div>
            </div>
            <div className="col-6">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <Activity size={20} style={{ marginRight: '10px', color: '#3498db' }} />
                <span>Database: <strong>Connected</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <AlertCircle size={20} style={{ marginRight: '10px', color: '#3498db' }} />
                <span>System Health: <strong>Good</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
