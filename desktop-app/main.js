const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const PrinterService = require('./services/printer');
const WebSocketClient = require('./services/websocket');
const ApiClient = require('./services/api');

// Set user data path to avoid permission issues
// This places cache and data in user's AppData folder instead of Program Files
const userDataPath = path.join(app.getPath('appData'), 'moretranz-printer-app');
app.setPath('userData', userDataPath);
app.setPath('cache', path.join(userDataPath, 'cache'));

// Keep a global reference of the window object
let mainWindow;
let loginWindow;
let printerService;
let wsClient;
let apiClient;

// Helper function to get config path (always in AppData)
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

// Check if authentication is needed
function needsAuthentication() {
  const fs = require('fs');
  const configPath = getConfigPath();
  
  try {
    if (!fs.existsSync(configPath)) {
      return true; // No config file - needs login
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Check if we have server URL and auth token
    if (!config.serverUrl || !config.authToken) {
      return true; // Missing credentials - needs login
    }
    
    return false; // Has config
  } catch (error) {
    console.error('Error checking config:', error);
    return true; // Error reading config - needs login
  }
}

// Create login window
function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 500,
    height: 650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    resizable: false,
    center: true,
    title: 'MoreTranz Printer - Login'
  });

  loginWindow.loadFile('login.html');
  
  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Optional: add an icon
    show: false, // Always start hidden
    autoHideMenuBar: true,
    skipTaskbar: false // Allow it in taskbar but minimize
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Show window only if configuration is incomplete OR first launch
  mainWindow.once('ready-to-show', () => {
    try {
      const fs = require('fs');
      const configPath = getConfigPath();
      const firstLaunchFlagPath = path.join(app.getPath('userData'), '.first-launch');
      
      const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
      
      // Check if config.json exists but is empty/incomplete
      const isConfigComplete = config.serverUrl && 
                              config.authToken && 
                              config.labelPrinter && 
                              config.bodyPrinter;
      
      // Check if this is the first launch after installation
      const isFirstLaunch = !fs.existsSync(firstLaunchFlagPath);
      
      // Show window if:
      // 1. Configuration is incomplete OR
      // 2. This is the first launch (to let user know app is running)
      if (!isConfigComplete || isFirstLaunch) {
        if (isFirstLaunch) {
          console.log('🎉 First launch - showing window');
          // Create flag file to mark that we've launched before
          fs.writeFileSync(firstLaunchFlagPath, new Date().toISOString());
        } else {
          console.log('⚠️ Configuration incomplete - showing window');
        }
        mainWindow.show();
      } else {
        console.log('✅ Configuration complete - running in background');
        // Keep window hidden but don't close - app runs in background
        // User can press Ctrl+Shift+P to show it again
      }
    } catch (error) {
      // If config.json doesn't exist or can't be read, show window
      console.log('⚠️ Configuration file not found - showing window');
      mainWindow.show();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Minimize to system tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      console.log('📦 Window hidden - app continues running in background');
    }
  });
}

// Initialize services
function initializeServices() {
  try {
    // Reload config to get latest changes
    const fs = require('fs');
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      console.error('❌ Config file not found');
      return;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Validate configuration
    if (!config.serverUrl || typeof config.serverUrl !== 'string' || config.serverUrl.trim() === '') {
      console.error('❌ Configuration incomplete - serverUrl is missing or empty');
      console.error('   Current serverUrl:', config.serverUrl);
      return;
    }
    
    if (!config.authToken || typeof config.authToken !== 'string' || config.authToken.trim() === '') {
      console.error('❌ Configuration incomplete - authToken is missing or empty');
      return;
    }
    
    if (!config.labelPrinter && !config.bodyPrinter) {
      console.warn('⚠️ No printers configured');
    }
    
    console.log('🚀 Initializing services...');
    console.log(`   Server: ${config.serverUrl}`);
    console.log(`   Label Printer: ${config.labelPrinter || 'Not set'}`);
    console.log(`   Body Printer: ${config.bodyPrinter || 'Not set'}`);
    
    // Disconnect existing WebSocket if any
    if (wsClient) {
      console.log('   Disconnecting existing WebSocket...');
      wsClient.disconnect();
    }
    
    // Initialize API client with refresh token support
    apiClient = new ApiClient(config.serverUrl, config.authToken, config.refreshToken);
    
    // Initialize printer service
    printerService = new PrinterService(config.labelPrinter, config.bodyPrinter);
    
    // Initialize WebSocket client
    wsClient = new WebSocketClient(config.serverUrl, config.authToken, {
      onConnect: () => {
        console.log('✅ WebSocket connected successfully');
      },
      onDisconnect: () => {
        console.log('🔌 WebSocket disconnected');
      },
      onAttachmentReady: async (attachmentData) => {
        console.log('📄 Attachment ready for printing:', attachmentData);
        
        try {
          // Download the file
          console.log(`   Downloading attachment ID: ${attachmentData.id}...`);
          const filePath = await apiClient.downloadAttachment(
            attachmentData.id,
            attachmentData.pdf_path ? 'pdf' : 'original'
          );
          
          if (!filePath) {
            console.error('❌ Failed to download attachment');
            return;
          }
          
          console.log(`   ✅ Downloaded to: ${filePath}`);
          
          // Determine which printer to use
          const isLabel = attachmentData.is_label || attachmentData.file_name.toLowerCase().includes('label');
          const printerName = isLabel ? config.labelPrinter : config.bodyPrinter;
          
          if (!printerName) {
            console.error(`❌ No printer configured for ${isLabel ? 'label' : 'body'} files`);
            return;
          }
          
          console.log(`   🖨️ Printing to: ${printerName} (${isLabel ? 'Label' : 'Body'} printer)`);
          
          // Print automatically
          const success = await printerService.printFile(filePath, printerName);
          
          if (success) {
            console.log(`✅ Successfully printed ${attachmentData.file_name}`);
          } else {
            console.error(`❌ Failed to print ${attachmentData.file_name}`);
          }
        } catch (error) {
          console.error('❌ Error processing attachment:', error);
          console.error(error.stack);
        }
      }
    });
    
    // Start WebSocket connection
    console.log('   Connecting WebSocket...');
    wsClient.connect();
    
  } catch (error) {
    console.error('❌ Error initializing services:', error);
    console.error(error.stack);
  }
}

// IPC Handlers for configuration UI
ipcMain.handle('get-config', () => {
  const fs = require('fs');
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return {};
});

ipcMain.handle('save-config', (event, config) => {
  const fs = require('fs');
  fs.writeFileSync(
    getConfigPath(),
    JSON.stringify(config, null, 2)
  );
  
  // Reinitialize services with new configuration
  console.log('📝 Configuration saved, reinitializing services...');
  setTimeout(() => {
    initializeServices();
  }, 500);
  
  return true;
});

ipcMain.handle('get-printers', async () => {
  try {
    if (!printerService) {
      // Initialize printer service if not already initialized
      printerService = new PrinterService(null, null);
    }
    const printers = await printerService.listPrinters();
    console.log(`Found ${printers.length} printers:`, printers.map(p => p.name));
    return printers;
  } catch (error) {
    console.error('Error getting printers:', error);
    return [];
  }
});

ipcMain.handle('test-connection', async (event, serverUrl, authToken) => {
  const testApi = new ApiClient(serverUrl, authToken);
  try {
    await testApi.testConnection();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle desktop login
ipcMain.handle('desktop-login', async (event, { email, password, serverUrl }) => {
  const axios = require('axios');
  const fs = require('fs');
  
  try {
    console.log(`🔐 Authenticating user: ${email} with server: ${serverUrl}`);
    
    // Call authentication API
    const response = await axios.post(`${serverUrl}/api/v1/desktop/authenticate`, {
      email,
      password
    });
    
    if (response.data.success && response.data.config) {
      const config = response.data.config;
      
      // Save config to file (in AppData)
      const configPath = getConfigPath();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      console.log('✅ Authentication successful, config saved');
      
      // Close login window
      if (loginWindow) {
        loginWindow.close();
        loginWindow = null;
      }
      
      // Create main window if it doesn't exist
      if (!mainWindow) {
        createWindow();
      } else {
        mainWindow.show();
      }
      
      // Initialize services with new config
      setTimeout(() => {
        initializeServices();
      }, 500);
      
      return { success: true };
    } else {
      throw new Error('Invalid response from server');
    }
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    const errorMessage = error.response?.data?.detail || error.message || 'Login failed';
    return { success: false, error: errorMessage };
  }
});

// Function to show window (if hidden)
function showWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    console.log('📱 Window shown');
  } else {
    createWindow();
  }
}

// App event handlers
app.whenReady().then(() => {
  // Check if authentication is needed
  if (needsAuthentication()) {
    console.log('🔐 Authentication required - showing login screen');
    createLoginWindow();
  } else {
    console.log('✅ Authentication exists - loading main window');
    createWindow();
    
    // Initialize services after window is ready
    setTimeout(() => {
      try {
        initializeServices();
      } catch (error) {
        console.error('❌ Failed to initialize services:', error);
        // Show error dialog
        if (mainWindow) {
          dialog.showErrorBox(
            'Initialization Error',
            `Failed to start printer service: ${error.message}\n\nPlease check your configuration.`
          );
          mainWindow.show();
        }
      }
    }, 1000);
  }
  
  // Register global shortcut to show window (Ctrl+Shift+P)
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    showWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
  if (wsClient) {
    wsClient.disconnect();
  }
});

// IPC handler to show window from renderer
ipcMain.handle('show-window', () => {
  showWindow();
  return true;
});

// Handle app updates (optional)
app.setLoginItemSettings({
  openAtLogin: true, // Auto-start on login
  path: app.getPath('exe')
});

