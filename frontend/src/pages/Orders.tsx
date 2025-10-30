import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  User, 
  Mail, 
  Package,
  Wifi,
  WifiOff,
  Eye,
  Trash2,
  Loader2,
  Play,
  Square,
  Search,
  X,
  Printer
} from 'lucide-react';
import { apiService, forceLogout } from '../services/api';
import websocketService, { OrderData } from '../services/websocket';
import printService, { AttachmentPrintData } from '../services/printService';

interface Order {
  id: number;
  po_number: string;
  order_type: string;
  requires_quality_check?: boolean;
  customer_name: string;
  delivery_address: string;
  committed_shipping_date: string;
  processed_time: string;
  status: string;
  folder_path: string;
  attachments?: Attachment[];
  print_jobs?: PrintJob[];
}

interface Attachment {
  id: number;
  file_name: string;
  file_type: string;
  sheet_type: string;
  sheet_number: number;
  print_status: string;
}

interface PrintJob {
  id: number;
  job_type: string;
  total_print_length: number;
  gang_sheets: number;
  status: string;
}

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; order: Order | null }>({ show: false, order: null });
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [printingOrders, setPrintingOrders] = useState<Set<number>>(new Set());
  const [printingAttachments, setPrintingAttachments] = useState<Set<number>>(new Set());
  
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    // Initial setup
    const init = async () => {
      // Test authentication first
      try {
        console.log('🔐 Testing authentication...');
        await apiService.testAuth();
        console.log('✅ Authentication test passed');
      } catch (err: any) {
        console.error('❌ Authentication test failed:', err);
        if (err.response?.status === 401) {
          console.log('🚨 Invalid token detected, clearing and redirecting to login');
          setError('Authentication failed. Please log in again.');
          forceLogout();
          return;
        }
      }
      
      // Fetch orders
      await fetchOrders();
      
      // Get initial processing status
      try {
        console.log('🔍 Fetching processing status...');
        const status = await apiService.getProcessingStatus();
        console.log('✅ Processing status received:', status.data);
        
        const isProcessing = status.data?.is_processing || false;
        setIsProcessing(isProcessing);
        
        // If processing is active, connect to WebSocket
        if (isProcessing) {
          websocketService.connect();
          setIsConnected(true);
        }
      } catch (err: any) {
        console.error('❌ Failed to get initial status:', err);
        console.error('Status error details:', {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data
        });
        // Don't fail the entire initialization if status check fails
        setIsProcessing(false);
      }
    };
    
    init();
    
    // Handle page visibility change (when user returns from login page)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, refetch data in case user was redirected to login
        fetchOrders();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    
    // Listen for WebSocket connection status
    websocketService.onConnect(() => {
      console.log('🔌 WebSocket connected in Orders');
      setIsConnected(true);
    });
    
    websocketService.onDisconnect(() => {
      console.log('🔌 WebSocket disconnected in Orders');
      setIsConnected(false);
    });
    
    // Listen for processing status updates
    websocketService.onStatusUpdate((status) => {
      console.log('📊 Status update received in Orders:', status);
      setIsProcessing(status.is_processing);
      
      // Don't reconnect WebSocket here - it's already connected and receiving updates
      // The WebSocket connection should persist regardless of processing status
    });
    
    // Set up WebSocket listener for attachment ready (automatic printing)
    websocketService.on('attachment_ready', (attachmentData: AttachmentPrintData) => {
      console.log('🖨️ Attachment ready for printing:', attachmentData);
      // Queue the attachment for automatic printing
      printService.queueAttachment(attachmentData);
    });

    // Set up WebSocket listener for new orders
    const handleNewOrder = (orderData: OrderData) => {
      console.log('📦 New order received via WebSocket:', orderData);
      
      // Convert WebSocket order data to our Order interface
      const newOrder: Order = {
        id: orderData.id,
        po_number: orderData.po_number,
        order_type: orderData.order_type,
        requires_quality_check: orderData.requires_quality_check,
        customer_name: orderData.customer_name,
        delivery_address: orderData.delivery_address,
        committed_shipping_date: orderData.committed_shipping_date || '',
        processed_time: orderData.processed_time || '',
        status: orderData.status,
        folder_path: orderData.folder_path,
        attachments: [],
        print_jobs: []
      };
      
      // Check if order already exists (prevent duplicates)
      setOrders(prev => {
        const existingOrder = prev.find(order => order.id === newOrder.id || order.po_number === newOrder.po_number);
        if (existingOrder) {
          console.log('⚠️ Order already exists, updating instead of adding:', newOrder.po_number);
          // Update existing order
          return prev.map(order => 
            order.id === newOrder.id || order.po_number === newOrder.po_number 
              ? { ...order, ...newOrder }
              : order
          );
        } else {
          // Add new order to the list
          return [newOrder, ...prev];
        }
      });
    };

    websocketService.onNewOrder(handleNewOrder);
    // When a new order arrives, refresh the full list so attachments and jobs are present
    websocketService.onNewOrder(async () => {
      try {
        await fetchOrders(searchTerm, currentPage);
      } catch (err) {
        console.error('Failed to refresh orders on websocket update', err);
      }
    });

    // Cleanup
    return () => {
      websocketService.off('new_order', handleNewOrder);
    };
  }, []);

  const fetchOrders = async (search?: string, page: number = 0) => {
    try {
      setSearchLoading(true);
      console.log('🔍 Fetching orders with params:', { search, page, skip: page * ITEMS_PER_PAGE, limit: ITEMS_PER_PAGE });
      
      const response = await apiService.getAllOrders(search, page * ITEMS_PER_PAGE, ITEMS_PER_PAGE);
      console.log('✅ Orders fetch successful:', response.data);
      
      setOrders(response.data || []);
      setError(null);
    } catch (err: any) {
      console.error('❌ Orders fetch error:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      });
      
      if (err.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
        forceLogout();
      } else if (err.response?.status === 403) {
        setError('Access denied. You do not have permission to view orders.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(`Failed to fetch orders: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(0);
    fetchOrders(searchTerm, 0);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setCurrentPage(0);
    fetchOrders('', 0);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchOrders(searchTerm, newPage);
  };

  const handlePrintOrder = async (orderId: number) => {
    setPrintingOrders(prev => new Set(prev).add(orderId));
    try {
      const response = await apiService.printOrderAttachments(orderId);
      if (response.data.status === 'Print job completed') {
        alert(`Print job sent for order ${response.data.po_number}`);
      } else {
        alert('Print job failed');
      }
    } catch (err) {
      alert('Failed to print attachments');
      console.error('Print error:', err);
    } finally {
      setPrintingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handlePrintAttachment = async (attachmentId: number) => {
    setPrintingAttachments(prev => new Set(prev).add(attachmentId));
    try {
      const response = await apiService.printAttachment(attachmentId);
      if (response.data.status === 'success') {
        alert(`Print job sent for ${response.data.file_name}`);
      } else {
        alert(`Print job failed: ${response.data.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Failed to print attachment');
      console.error('Print error:', err);
    } finally {
      setPrintingAttachments(prev => {
        const newSet = new Set(prev);
        newSet.delete(attachmentId);
        return newSet;
      });
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleViewOrder = async (order: Order) => {
    // Optimistically open with current data
    setSelectedOrder(order);
    try {
      const full = await apiService.getOrderById(order.id);
      if (full && full.data) {
        setSelectedOrder(full.data);
      }
    } catch (e) {
      console.error('Failed to load full order details', e);
    }
  };

  const handleDownloadFile = async (attachmentId: number, format: 'pdf' | 'png' | 'jpg' | 'jpeg' | 'gif' | 'bmp' | 'txt' | 'html' = 'pdf', fileType?: string) => {
    try {
      await apiService.downloadAttachment(attachmentId, format, fileType);
    } catch (error: any) {
      console.error('Download failed:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || 'Download failed';
      setError(errorMessage);
    }
  };

  const handleDeleteClick = (order: Order) => {
    setDeleteConfirm({ show: true, order });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.order) return;

    try {
      await apiService.deleteOrder(deleteConfirm.order.id);
      setOrders(prev => prev.filter(order => order.id !== deleteConfirm.order!.id));
      setDeleteConfirm({ show: false, order: null });
      setError(null);
    } catch (err) {
      setError('Failed to delete order');
      console.error('Delete error:', err);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, order: null });
  };

  if (loading) {
    return (
      <div className="loading">
        <Loader2 size={24} className="animate-spin" />
        <p>Loading orders...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#2c3e50' }}>Orders</h1>
        <div className="status-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            className={`status-dot ${isProcessing ? 'status-green' : 'status-gray'}`}
          />
          <span style={{ color: '#666', fontSize: '14px' }}>
            {isProcessing ? 'Processing Orders' : 'Processing Stopped'}
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
              <input
                type="text"
                placeholder="Search by PO number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={searchLoading}
              style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
            >
              {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          {error.includes('Authentication failed') && (
            <div style={{ marginTop: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={forceLogout}
                style={{ padding: '5px 10px', fontSize: '12px' }}
              >
                Clear Session & Login Again
              </button>
            </div>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '40px' }}>
            <Package size={48} style={{ color: '#95a5a6', marginBottom: '20px' }} />
            <h3 style={{ color: '#7f8c8d', marginBottom: '10px' }}>
              {searchTerm ? 'No Orders Found' : 'No Orders Found'}
            </h3>
            <p style={{ color: '#95a5a6' }}>
              {searchTerm 
                ? `No orders found matching "${searchTerm}". Try a different search term.`
                : 'Orders will appear here once email processing begins.'
              }
            </p>
            {searchTerm && (
              <button 
                className="btn btn-secondary" 
                onClick={handleClearSearch}
                style={{ marginTop: '10px' }}
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <FileText size={20} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
              Order History {searchTerm && `(Search: "${searchTerm}")`}
            </h2>
          </div>
          <div className="card-body" style={{ padding: '0' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Customer</th>
                  <th>Order Type</th>
                  <th>Quality Check</th>
                  <th>Processed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.po_number}</strong>
                    </td>
                    <td>
                      <div>
                        <User size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                        {order.customer_name}
                      </div>
                    </td>
                    <td>{order.order_type}</td>
                    <td>
                      <div style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        backgroundColor: order.requires_quality_check ? '#fff3cd' : '#d1ecf1',
                        color: order.requires_quality_check ? '#856404' : '#0c5460',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {order.requires_quality_check ? 'Yes' : 'No'}
                      </div>
                    </td>
                    <td>
                      <div>
                        <Calendar size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                        {formatDate(order.processed_time)}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleViewOrder(order)}
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                        >
                          <Eye size={14} style={{ marginRight: '4px' }} />
                          View
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handlePrintOrder(order.id)}
                          disabled={printingOrders.has(order.id)}
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                        >
                          {printingOrders.has(order.id) ? (
                            <Loader2 size={14} className="animate-spin" style={{ marginRight: '4px' }} />
                          ) : (
                            <Printer size={14} style={{ marginRight: '4px' }} />
                          )}
                          {printingOrders.has(order.id) ? 'Printing...' : 'Print All'}
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDeleteClick(order)}
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                        >
                          <Trash2 size={14} style={{ marginRight: '4px' }} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '30px',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto',
            width: '90%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#2c3e50' }}>Order Details - {selectedOrder.po_number}</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => handlePrintOrder(selectedOrder.id)}
                  disabled={printingOrders.has(selectedOrder.id)}
                  style={{ padding: '5px 10px' }}
                >
                  {printingOrders.has(selectedOrder.id) ? (
                    <Loader2 size={16} className="animate-spin" style={{ marginRight: '4px' }} />
                  ) : (
                    <Printer size={16} style={{ marginRight: '4px' }} />
                  )}
                  {printingOrders.has(selectedOrder.id) ? 'Printing...' : 'Print All'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedOrder(null)}
                  style={{ padding: '5px 10px' }}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="row">
              <div className="col-6">
                <div className="form-group">
                  <label className="form-label">Customer Address</label>
                  <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                    <User size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    {selectedOrder.customer_name}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Order Type</label>
                  <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                    <Package size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    {selectedOrder.order_type}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Quality Check Required</label>
                  <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      padding: '6px 12px', 
                      borderRadius: '4px',
                      backgroundColor: selectedOrder.requires_quality_check ? '#fff3cd' : '#d1ecf1',
                      color: selectedOrder.requires_quality_check ? '#856404' : '#0c5460',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      {selectedOrder.requires_quality_check ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Shipping Date</label>
                  <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                    <Calendar size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    {formatDate(selectedOrder.committed_shipping_date)}
                  </div>
                </div>
              </div>

              <div className="col-6">
                <div className="form-group">
                  <label className="form-label">Email Body</label>
                  <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px', whiteSpace: 'pre-line' }}>
                    <Mail size={16} style={{ marginRight: '8px', verticalAlign: 'top' }} />
                    {selectedOrder.delivery_address}
                  </div>
                </div>


                <div className="form-group">
                  <label className="form-label">Processed Time</label>
                  <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                    <Calendar size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    {formatDate(selectedOrder.processed_time)}
                  </div>
                </div>
              </div>
            </div>

            {/* Print Jobs */}
            {selectedOrder.print_jobs && selectedOrder.print_jobs.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ marginBottom: '15px', color: '#2c3e50' }}>Print Jobs</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Job Type</th>
                      <th>Print Length</th>
                      <th>Gang Sheets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.print_jobs.map((job) => (
                      <tr key={job.id}>
                        <td>{job.job_type}</td>
                        <td>{job.total_print_length} inches</td>
                        <td>{job.gang_sheets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Attachments */}
            {selectedOrder.attachments && selectedOrder.attachments.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ marginBottom: '15px', color: '#2c3e50' }}>Attachments</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Sheet Type</th>
                      <th>Sheet #</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.attachments.map((attachment) => (
                      <tr key={attachment.id}>
                        <td style={{ verticalAlign: 'middle' }}>
                          {attachment.file_name}
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          {attachment.sheet_type}
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          #{attachment.sheet_number}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {/* Only show PDF button for files that can be converted to PDF (not PNG) */}
                            {attachment.file_type !== 'png' && (
                              <button
                                className="btn btn-primary"
                                onClick={() => handleDownloadFile(attachment.id, 'pdf')}
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                              >
                                <Download size={14} style={{ marginRight: '4px' }} />
                                PDF
                              </button>
                            )}
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleDownloadFile(attachment.id, attachment.file_type as any || 'png', attachment.file_type)}
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              <Download size={14} style={{ marginRight: '4px' }} />
                              Original
                            </button>
                            <button
                              className="btn btn-info"
                              onClick={() => handlePrintAttachment(attachment.id)}
                              disabled={printingAttachments.has(attachment.id)}
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              {printingAttachments.has(attachment.id) ? (
                                <Loader2 size={14} className="animate-spin" style={{ marginRight: '4px' }} />
                              ) : (
                                <Printer size={14} style={{ marginRight: '4px' }} />
                              )}
                              {printingAttachments.has(attachment.id) ? 'Printing...' : 'Print'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && deleteConfirm.order && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal" style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#e74c3c' }}>
              <Trash2 size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Delete Order
            </h3>
            <p style={{ marginBottom: '20px', color: '#555' }}>
              Are you sure you want to delete order <strong>{deleteConfirm.order.po_number}</strong>?
            </p>
            <p style={{ marginBottom: '25px', color: '#777', fontSize: '14px' }}>
              This action cannot be undone. All associated data (attachments, print jobs, logs) will also be deleted.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={handleDeleteCancel}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                style={{ padding: '8px 16px' }}
              >
                <Trash2 size={14} style={{ marginRight: '4px' }} />
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
