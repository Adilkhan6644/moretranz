const WebSocket = require('ws');

class WebSocketClient {
  constructor(serverUrl, authToken, callbacks = {}) {
    if (!serverUrl || typeof serverUrl !== 'string' || serverUrl.trim() === '') {
      throw new Error('Server URL is required and cannot be empty');
    }
    
    // Ensure serverUrl doesn't end with /
    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    
    // Convert http/https to ws/wss
    let wsUrl;
    if (cleanUrl.startsWith('http://')) {
      wsUrl = cleanUrl.replace(/^http:/, 'ws:');
    } else if (cleanUrl.startsWith('https://')) {
      wsUrl = cleanUrl.replace(/^https:/, 'wss:');
    } else if (cleanUrl.startsWith('ws://') || cleanUrl.startsWith('wss://')) {
      wsUrl = cleanUrl;
    } else {
      // Default to ws:// if no protocol specified
      wsUrl = `ws://${cleanUrl}`;
    }
    
    this.wsUrl = `${wsUrl}/ws`;
    this.authToken = authToken;
    this.ws = null;
    this.reconnectInterval = 5000; // 5 seconds
    this.maxReconnectAttempts = Infinity; // Keep trying forever
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.callbacks = callbacks;
    
    console.log(`📡 WebSocket URL constructed: ${this.wsUrl}`);
  }

  connect() {
    try {
      // Validate WebSocket URL before attempting connection
      if (!this.wsUrl) {
        throw new Error('WebSocket URL is undefined or empty');
      }
      
      if (!this.wsUrl.startsWith('ws://') && !this.wsUrl.startsWith('wss://')) {
        throw new Error(`Invalid WebSocket URL: "${this.wsUrl}". Must start with ws:// or wss://`);
      }
      
      console.log(`🔌 Connecting to WebSocket: ${this.wsUrl}`);
      
      if (!this.authToken || this.authToken.trim() === '') {
        console.warn('⚠️ No auth token provided for WebSocket connection');
      }
      
      this.ws = new WebSocket(this.wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        if (this.callbacks.onConnect) {
          this.callbacks.onConnect();
        }
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        console.error('   URL attempted:', this.wsUrl);
        console.error('   Full error:', error);
      });

      this.ws.on('close', () => {
        console.log('🔌 WebSocket disconnected');
        this.isConnected = false;
        
        if (this.callbacks.onDisconnect) {
          this.callbacks.onDisconnect();
        }

        // Attempt to reconnect
        this.attemptReconnect();
      });

    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      this.attemptReconnect();
    }
  }

  handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'attachment_ready':
        console.log('📄 Received attachment_ready:', data);
        if (this.callbacks.onAttachmentReady) {
          this.callbacks.onAttachmentReady(data);
        }
        break;

      case 'new_order':
        console.log('📦 New order received:', data);
        if (this.callbacks.onNewOrder) {
          this.callbacks.onNewOrder(data);
        }
        break;

      case 'status_update':
        console.log('📊 Status update:', data);
        if (this.callbacks.onStatusUpdate) {
          this.callbacks.onStatusUpdate(data);
        }
        break;

      default:
        console.log('📨 Unknown message type:', type);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  send(message) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send message');
    }
  }
}

module.exports = WebSocketClient;

