export interface WebSocketMessage {
  type: 'new_order' | 'status_update' | 'attachment_ready';
  data: any;
}

export interface OrderData {
  id: number;
  po_number: string;
  order_type: string;
  requires_quality_check?: boolean;
  customer_name: string;
  delivery_address: string;
  committed_shipping_date: string | null;
  processed_time: string | null;
  status: string;
  folder_path: string;
}

export interface StatusData {
  status: string;
  is_processing: boolean;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Function[]> = new Map();
  private connectListeners: Function[] = [];
  private disconnectListeners: Function[] = [];
  private connectionRequested = false;

  connect(): void {
    // If already connected or connecting, don't create a new connection
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('⚠️ WebSocket already connected or connecting');
      return;
    }

    // If connection was already requested, don't create another one
    if (this.connectionRequested) {
      console.log('⚠️ WebSocket connection already requested');
      return;
    }

    this.connectionRequested = true;

    // If there's an existing socket in any other state, close it first
    if (this.ws) {
      console.log('🔄 Closing existing WebSocket before creating new connection');
      this.ws.close();
      this.ws = null;
    }

    // Use WebSocket URL based on environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Uses current host (handles localhost and production)
    const wsUrl = `${protocol}//${host}/ws`;
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      this.reconnectAttempts = 0;
      this.connectionRequested = false; // Reset the flag on successful connection
      this.connectListeners.forEach(listener => listener());
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', message);
        this.notifyListeners(message.type, message.data);
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      this.connectionRequested = false; // Reset the flag on disconnect
      this.disconnectListeners.forEach(listener => listener());
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  disconnect(): void {
    if (this.ws) {
      // Remove all event listeners before closing
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      
      // Close the connection
      this.ws.close();
      this.ws = null;
      
      // Clear reconnection state
      this.reconnectAttempts = 0;
      this.connectionRequested = false;
      
      console.log('🔌 WebSocket disconnected and cleaned up');
    }
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Connection event listeners
  onConnect(callback: Function): void {
    this.connectListeners.push(callback);
  }

  onDisconnect(callback: Function): void {
    this.disconnectListeners.push(callback);
  }

  // Convenience methods for specific events
  onNewOrder(callback: (order: OrderData) => void): void {
    this.on('new_order', callback);
  }

  onStatusUpdate(callback: (status: StatusData) => void): void {
    this.on('status_update', callback);
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;
