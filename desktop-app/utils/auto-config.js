/**
 * Auto-configuration utility
 * Automatically configures the desktop app with user credentials
 */

const fs = require('fs');
const path = require('path');

/**
 * Check if config.json is in the same directory as the installer download
 * and automatically copy it to the app directory
 */
function loadConfigFromDownload() {
  try {
    // Common download locations
    const downloadPaths = [
      path.join(require('os').homedir(), 'Downloads', 'config.json'),
      path.join(process.cwd(), 'config.json'),
      path.join(__dirname, '..', 'config.json')
    ];

    for (const downloadPath of downloadPaths) {
      if (fs.existsSync(downloadPath)) {
        const { app } = require('electron');
        const configPath = path.join(app.getPath('userData'), 'config.json');
        const downloadedConfig = JSON.parse(fs.readFileSync(downloadPath, 'utf8'));
        
        // Merge with existing config (preserve printer selections)
        let existingConfig = {};
        if (fs.existsSync(configPath)) {
          try {
            existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          } catch (e) {
            // Ignore if can't read existing
          }
        }

        // Merge: Use downloaded for server/auth, keep existing for printers
        const mergedConfig = {
          serverUrl: downloadedConfig.serverUrl || existingConfig.serverUrl || '',
          authToken: downloadedConfig.authToken || existingConfig.authToken || '',
          labelPrinter: existingConfig.labelPrinter || downloadedConfig.labelPrinter || '',
          bodyPrinter: existingConfig.bodyPrinter || downloadedConfig.bodyPrinter || '',
          autoStart: downloadedConfig.autoStart !== undefined ? downloadedConfig.autoStart : (existingConfig.autoStart !== undefined ? existingConfig.autoStart : true)
        };

        // Save merged config
        fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2));
        console.log('✅ Auto-loaded configuration from download');

        // Optionally delete downloaded config file
        // fs.unlinkSync(downloadPath);

        return mergedConfig;
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not auto-load config from download:', error.message);
  }
  
  return null;
}

/**
 * Check if config file exists, create default if not
 */
function ensureConfigExists() {
  const { app } = require('electron');
  const configPath = path.join(app.getPath('userData'), 'config.json');
  
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      serverUrl: '',
      authToken: '',
      labelPrinter: '',
      bodyPrinter: '',
      autoStart: true
    };
    
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('📝 Created default config.json');
    return defaultConfig;
  }
  
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('❌ Error reading config.json:', error);
    return null;
  }
}

module.exports = {
  loadConfigFromDownload,
  ensureConfigExists
};

