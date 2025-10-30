/**
 * Electron Builder After Install Hook
 * Automatically configures app with user's config.json from Downloads
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async function(context) {
  console.log('📦 Running after-install hook...');
  
  // This runs after installation
  // Try to find config.json in Downloads folder
  const downloadsPath = path.join(os.homedir(), 'Downloads');
  const configDownloadPath = path.join(downloadsPath, 'config.json');
  
  if (fs.existsSync(configDownloadPath)) {
    try {
      // Get app data directory
      const appDataPath = process.env.APPDATA || 
                         (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : 
                          path.join(os.homedir(), '.config'));
      
      const appName = 'moretranz-printer-app';
      const configPath = path.join(appDataPath, appName, 'config.json');
      
      // Create directory if it doesn't exist
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Copy config from Downloads to app directory
      const downloadedConfig = JSON.parse(fs.readFileSync(configDownloadPath, 'utf8'));
      fs.writeFileSync(configPath, JSON.stringify(downloadedConfig, null, 2));
      
      console.log('✅ Auto-configured app with downloaded config.json');
      
      // Optionally delete downloaded config
      // fs.unlinkSync(configDownloadPath);
    } catch (error) {
      console.warn('⚠️ Could not auto-configure:', error.message);
    }
  }
};

