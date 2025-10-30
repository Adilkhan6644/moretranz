const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ApiClient {
  constructor(serverUrl, authToken, refreshToken = null) {
    this.baseURL = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    this.authToken = authToken;
    this.refreshToken = refreshToken;
    this.tempDir = path.join(os.tmpdir(), 'moretranz-prints');
    this.isRefreshing = false;
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      console.log('🔄 Refreshing access token...');
      const response = await axios.post(`${this.baseURL}/api/v1/auth/refresh`, {
        refresh_token: this.refreshToken
      });

      const { access_token, refresh_token } = response.data;
      this.authToken = access_token;
      this.refreshToken = refresh_token;

      // Update config.json with new tokens
      this.updateConfigFile(access_token, refresh_token);

      console.log('✅ Token refreshed successfully');
      return access_token;
    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      throw error;
    }
  }

  /**
   * Update config.json file with new tokens
   */
  updateConfigFile(newAuthToken, newRefreshToken) {
    try {
      const { app } = require('electron');
      const configPath = path.join(app.getPath('userData'), 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config.authToken = newAuthToken;
        config.refreshToken = newRefreshToken;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('✅ Config file updated with new tokens');
      }
    } catch (error) {
      console.error('⚠️ Failed to update config file:', error.message);
    }
  }

  /**
   * Make API request with automatic token refresh on 401
   */
  async makeRequest(method, url, options = {}) {
    try {
      const config = {
        method,
        url,
        headers: this.getHeaders(),
        ...options
      };
      return await axios(config);
    } catch (error) {
      // If 401 and we have a refresh token, try to refresh and retry
      if (error.response && error.response.status === 401 && this.refreshToken && !this.isRefreshing) {
        try {
          this.isRefreshing = true;
          await this.refreshAccessToken();
          this.isRefreshing = false;

          // Retry the original request with new token
          const config = {
            method,
            url,
            headers: this.getHeaders(),
            ...options
          };
          return await axios(config);
        } catch (refreshError) {
          this.isRefreshing = false;
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * Test connection to API
   */
  async testConnection() {
    try {
      // Try to get current user info as a connection test
      const response = await this.makeRequest('get', `${this.baseURL}/api/v1/auth/me`);
      return response.data;
    } catch (error) {
      // If /me endpoint doesn't exist, try orders endpoint
      try {
        const response = await this.makeRequest('get', `${this.baseURL}/api/v1/orders/?limit=1`);
        return { success: true };
      } catch (err) {
        throw new Error(`Connection test failed: ${error.message}`);
      }
    }
  }

  /**
   * Download attachment file
   * @param {number} attachmentId - Attachment ID
   * @param {string} format - 'pdf' or 'original'
   * @returns {Promise<string>} Path to downloaded file
   */
  async downloadAttachment(attachmentId, format = 'pdf') {
    try {
      const url = `${this.baseURL}/api/v1/orders/attachments/${attachmentId}/download?format=${format}`;
      
      const response = await this.makeRequest('get', url, {
        responseType: 'arraybuffer'
      });

      // Get filename from Content-Disposition header or use default
      let filename = `attachment_${attachmentId}.pdf`;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Save file to temp directory
      const filePath = path.join(this.tempDir, filename);
      fs.writeFileSync(filePath, Buffer.from(response.data));

      console.log(`✅ Downloaded file: ${filename} (${Math.round(response.data.byteLength / 1024)}KB)`);
      return filePath;

    } catch (error) {
      console.error(`❌ Download error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ApiClient;
