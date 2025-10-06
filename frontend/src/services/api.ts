import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Auth token helpers ---
const TOKEN_KEY = 'auth_token';

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Attach token to requests
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      setAuthToken(null);
      // Soft redirect without importing router (works in SPA)
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath !== '/login') {
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
      }
    }
    return Promise.reject(err);
  }
);

export interface EmailConfig {
  email_address: string;
  email_password: string;
  imap_server: string;
  allowed_senders: string;
  max_age_days: number;
  sleep_time: number;
}

export interface Order {
  id: number;
  po_number: string;
  order_type: string;
  customer_name: string;
  delivery_address: string;
  committed_shipping_date: string;
  processed_time: string;
  status: string;
  folder_path: string;
  attachments?: Attachment[];
  print_jobs?: PrintJob[];
}

export interface Attachment {
  id: number;
  file_name: string;
  file_type: string;
  sheet_type: string;
  sheet_number: number;
  print_status: string;
}

export interface PrintJob {
  id: number;
  job_type: string;
  total_print_length: number;
  gang_sheets: number;
  status: string;
}

export const apiService = {
  // Auth
  async login(username: string, password: string) {
    const form = new URLSearchParams();
    form.append('grant_type', 'password');
    form.append('username', username);
    form.append('password', password);
    const response = await api.post('/auth/login', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const token = response.data?.access_token as string | undefined;
    if (token) setAuthToken(token);
    return response;
  },

  logout() {
    setAuthToken(null);
  },

  async register(username: string, password: string, fullName?: string) {
    const response = await api.post('/auth/register', { username, password, full_name: fullName });
    return response;
  },

  // Email Configuration
  async getEmailConfig() {
    const response = await api.get('/config/email');
    return response;
  },

  async updateEmailConfig(config: EmailConfig) {
    const response = await api.put('/config/email', config);
    return response;
  },

  // Order Processing
  async startProcessing() {
    const response = await api.post('/orders/start-processing');
    return response;
  },

  async stopProcessing() {
    const response = await api.post('/orders/stop-processing');
    return response;
  },

  async getProcessingStatus() {
    // This endpoint doesn't exist yet, but we can simulate it
    try {
      const response = await api.get('/orders/processing-status');
      return response;
    } catch (error) {
      // Return a mock response for now
      return { data: { is_running: false } };
    }
  },

  // Orders
  async getAllOrders(search?: string, skip: number = 0, limit: number = 100) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    
    const response = await api.get(`/orders/?${params.toString()}`);
    return response;
  },

  async getLatestOrder() {
    const response = await api.get('/orders/latest');
    return response;
  },

  async getOrderById(id: number) {
    const response = await api.get(`/orders/${id}`);
    return response;
  },

  async deleteOrder(id: number) {
    const response = await api.delete(`/orders/${id}`);
    return response;
  },

  async downloadAttachment(attachmentId: number, format: 'pdf' | 'original' = 'pdf') {
    // Create a direct download link
    const downloadUrl = `${API_BASE_URL}/orders/attachments/${attachmentId}/download?format=${format}`;
    
    // Create a temporary link element and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = ''; // Let the server determine the filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Printer Configuration (if needed)
  async getPrinterConfig() {
    try {
      const response = await api.get('/config/printer');
      return response;
    } catch (error) {
      return { data: { body_printer: 'BodyPrinter', attachment_printer: 'AttachmentPrinter' } };
    }
  },

  async updatePrinterConfig(config: any) {
    const response = await api.put('/config/printer', config);
    return response;
  },
};

export default apiService;
