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
// Track processed attachments to prevent duplicate printing
const processedAttachments = new Set();

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
      console.log('🔐 No config file found - authentication required');
      return true; // No config file - needs login
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Check if we have server URL and auth token
    if (!config.serverUrl || !config.authToken) {
      console.log('🔐 Config exists but missing credentials - authentication required');
      return true; // Missing credentials - needs login
    }
    
    console.log('✅ Valid config found - authentication not required');
    return false; // Has config
  } catch (error) {
    console.error('❌ Error checking config:', error);
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
    show: true, // Always show login window
    title: 'MoreTranz Printer - Login',
    alwaysOnTop: true, // Force on top initially
    focusable: true,
    skipTaskbar: false
  });

  loginWindow.loadFile('login.html');
  
  // Show window when ready - ALWAYS show login window
  loginWindow.once('ready-to-show', () => {
    console.log('📱 Login window ready - showing now');
    loginWindow.show();
    loginWindow.focus();
    // Force bring to front and keep on top briefly
    loginWindow.setAlwaysOnTop(true);
    setTimeout(() => {
      if (loginWindow) {
        loginWindow.setAlwaysOnTop(false);
        loginWindow.focus(); // Refocus after removing always on top
      }
    }, 1000);
  });
  
  // Multiple fallbacks to ensure window shows
  setTimeout(() => {
    if (loginWindow && !loginWindow.isVisible()) {
      console.log('📱 Login window fallback #1 - showing now');
      loginWindow.show();
      loginWindow.focus();
      loginWindow.setAlwaysOnTop(true);
      setTimeout(() => {
        if (loginWindow) {
          loginWindow.setAlwaysOnTop(false);
        }
      }, 500);
    }
  }, 500);
  
  setTimeout(() => {
    if (loginWindow && !loginWindow.isVisible()) {
      console.log('📱 Login window fallback #2 - showing now');
      loginWindow.show();
      loginWindow.focus();
      loginWindow.setAlwaysOnTop(true);
      setTimeout(() => {
        if (loginWindow) {
          loginWindow.setAlwaysOnTop(false);
        }
      }, 500);
    }
  }, 2000);
  
  loginWindow.on('closed', () => {
    loginWindow = null;
    // If login window closes and no main window, show main window
    if (!mainWindow) {
      createWindow();
    }
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
    show: false, // Always start hidden (will be shown by ready-to-show handler)
    autoHideMenuBar: true,
    skipTaskbar: false, // Allow it in taskbar but minimize
    alwaysOnTop: false, // Don't force on top
    focusable: true // Make sure window can receive focus
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
      // Note: downloadPath is optional - printing can work without it
      const isConfigComplete = config.serverUrl && 
                              config.authToken && 
                              config.labelPrinter && 
                              config.bodyPrinter;
      
      // Check if this is the first launch after installation
      const isFirstLaunch = !fs.existsSync(firstLaunchFlagPath);
      
      // ALWAYS show window on first launch, regardless of config status
        if (isFirstLaunch) {
          console.log('🎉 First launch - showing window');
          // Create flag file to mark that we've launched before
        try {
          fs.writeFileSync(firstLaunchFlagPath, new Date().toISOString());
        } catch (err) {
          console.warn('Could not write first launch flag:', err);
        }
        // Force show and focus the window
        mainWindow.show();
        mainWindow.focus();
        // Also bring to front
        if (mainWindow.setAlwaysOnTop) {
          mainWindow.setAlwaysOnTop(true);
          setTimeout(() => mainWindow.setAlwaysOnTop(false), 100);
        }
      } else if (!isConfigComplete) {
        // Show window if configuration is incomplete
        console.log('⚠️ Configuration incomplete - showing window');
        mainWindow.show();
        mainWindow.focus();
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
    console.log(`   Download Path: ${config.downloadPath || 'Not set (attachments will not be saved)'}`);
    
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
        
        // Create unique key for this attachment to prevent duplicate processing
        // Use attachment ID as primary key (it's unique in database)
        // Add order_id and file_name as additional uniqueness factors
        const attachmentId = attachmentData.id;
        const orderId = attachmentData.order_id || 'unknown';
        const fileName = attachmentData.file_name || 'unknown';
        const attachmentKey = `${attachmentId}_${orderId}_${fileName}`;
        
        // Also check by attachment ID alone (most reliable)
        const attachmentIdKey = `id_${attachmentId}`;
        
        // Check if we've already processed this attachment (by ID or full key)
        if (processedAttachments.has(attachmentIdKey) || processedAttachments.has(attachmentKey)) {
          console.log(`   ⏭️ Skipping duplicate attachment: ${fileName} (ID: ${attachmentId}, Order: ${orderId})`);
          console.log(`   📋 Already processed - preventing duplicate print`);
          return;
        }
        
        // Mark as processed immediately to prevent race conditions
        // Store both keys for maximum protection
        processedAttachments.add(attachmentIdKey);
        processedAttachments.add(attachmentKey);
        
        console.log(`   ✅ New attachment detected: ${fileName} (ID: ${attachmentId})`);
        
        // Clean up old entries (keep last 2000 to prevent memory issues)
        // We store 2 keys per attachment, so 2000 entries = 1000 attachments
        if (processedAttachments.size > 2000) {
          // Remove oldest 100 entries (50 attachments)
          const entriesToRemove = Array.from(processedAttachments).slice(0, 100);
          entriesToRemove.forEach(key => processedAttachments.delete(key));
          console.log(`   🧹 Cleaned up ${entriesToRemove.length} old entries from processed attachments cache`);
        }
        
        try {
          // Download the file
          // Always download original format for PNG/images to preserve them as images
          // Only use PDF format for PDF files or when printing is needed
          const fileType = attachmentData.file_type || '';
          const isImage = ['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(fileType.toLowerCase());
          
          // For images, always download original; for PDFs, use PDF if available
          const downloadFormat = isImage ? 'original' : (attachmentData.pdf_path ? 'pdf' : 'original');
          console.log(`   Downloading attachment ID: ${attachmentData.id} (format: ${downloadFormat}, file type: ${fileType})...`);
          const tempFilePath = await apiClient.downloadAttachment(
            attachmentData.id,
            downloadFormat
          );
          
          if (!tempFilePath) {
            console.error('❌ Failed to download attachment');
            // Remove from processed set so it can be retried
            processedAttachments.delete(attachmentIdKey);
            processedAttachments.delete(attachmentKey);
            return;
          }
          
          console.log(`   ✅ Downloaded to: ${tempFilePath}`);
          
          // Save to configured download path if configured
          let finalFilePath = tempFilePath; // Default to temp file for printing
          if (config.downloadPath && config.downloadPath.trim() !== '') {
            try {
              const fs = require('fs');
              const path = require('path');
              
              // Get PO number from attachment data (sanitize for folder name)
              const poNumber = attachmentData.po_number || `PO_${attachmentData.order_id || 'unknown'}`;
              const sanitizedPONumber = poNumber.replace(/[<>:"/\\|?*]/g, '_'); // Remove invalid folder name characters
              
              // Create folder structure: {downloadPath}/{PO_number}/
              const poFolder = path.join(config.downloadPath, sanitizedPONumber);
              
              // Create folder if it doesn't exist
              if (!fs.existsSync(poFolder)) {
                fs.mkdirSync(poFolder, { recursive: true });
                console.log(`   📁 Created folder: ${poFolder}`);
              }
              
              // Copy file to PO folder
              // Use the actual downloaded file's name (which has correct extension)
              // This ensures PNG files are saved as PNG, PDF files as PDF
              const downloadedFileName = path.basename(tempFilePath);
              const originalFileName = attachmentData.file_name || downloadedFileName;
              
              // Determine the correct file extension based on what we actually downloaded
              const downloadedExt = path.extname(downloadedFileName).toLowerCase();
              const originalExt = path.extname(originalFileName).toLowerCase();
              
              // Use the downloaded file's extension (it matches the actual file type)
              // If we downloaded as PDF, use .pdf; if original, use original extension
              let finalFileName;
              if (downloadedExt && downloadedExt !== originalExt) {
                // Downloaded format differs from original (e.g., PNG converted to PDF)
                const nameWithoutExt = path.basename(originalFileName, originalExt);
                finalFileName = nameWithoutExt + downloadedExt;
              } else {
                // Use original filename (formats match)
                finalFileName = originalFileName;
              }
              
              // If no extension, try to infer from file type
              if (!path.extname(finalFileName)) {
                const fileType = attachmentData.file_type || '';
                if (fileType) {
                  finalFileName = finalFileName + '.' + fileType.toLowerCase();
                }
              }
              
              const sanitizedFileName = finalFileName.replace(/[<>:"/\\|?*]/g, '_'); // Sanitize filename
              finalFilePath = path.join(poFolder, sanitizedFileName);
              
              // Copy file from temp to final location
              fs.copyFileSync(tempFilePath, finalFilePath);
              console.log(`   💾 Saved attachment to: ${finalFilePath}`);
              
              // Verify file was saved correctly
              if (fs.existsSync(finalFilePath)) {
                const stats = fs.statSync(finalFilePath);
                console.log(`   ✅ File verified: ${Math.round(stats.size / 1024)}KB`);
              } else {
                console.error(`   ⚠️ Warning: File was not saved correctly`);
              }
            } catch (saveError) {
              console.error('⚠️ Failed to save file to download path:', saveError.message);
              console.error('   Using temp file for printing only');
              // Continue with temp file for printing
            }
          }
          
          // Check if file is PDF before printing (only PDFs should auto-print)
          // IMPORTANT: Check the ACTUAL downloaded file extension, not just metadata
          const fileExtension = path.extname(tempFilePath).toLowerCase();
          const actualFileType = fileExtension.substring(1); // Remove the dot
          
          // Only print if the actual downloaded file is a PDF
          // Don't rely on pdf_path or file_type metadata - check the real file
          const isPdf = fileExtension === '.pdf';
          
          if (!isPdf) {
            console.log(`   ⏭️ Skipping print - ${attachmentData.file_name} is not a PDF (actual file type: ${actualFileType || 'unknown'})`);
            console.log(`   ✅ File saved but not printed (only PDFs are auto-printed)`);
            return;
          }
          
          // Determine which printer to use
          const isLabel = attachmentData.is_label || attachmentData.file_name.toLowerCase().includes('label');
          const printerName = isLabel ? config.labelPrinter : config.bodyPrinter;
          
          if (!printerName) {
            console.error(`❌ No printer configured for ${isLabel ? 'label' : 'body'} files`);
            // Still save the file even if printing fails
            return;
          }
          
          console.log(`   🖨️ Printing PDF to: ${printerName} (${isLabel ? 'Label' : 'Body'} printer)`);
          
          // Print automatically (use temp file for printing to avoid locking saved file)
          const success = await printerService.printFile(tempFilePath, printerName);
          
          if (success) {
            console.log(`✅ Successfully printed ${attachmentData.file_name} (once)`);
          } else {
            console.error(`❌ Failed to print ${attachmentData.file_name}`);
          }
        } catch (error) {
          console.error('❌ Error processing attachment:', error);
          console.error(error.stack);
          // Remove from processed set on error so it can be retried
          processedAttachments.delete(attachmentIdKey);
          processedAttachments.delete(attachmentKey);
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

ipcMain.handle('browse-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select folder for saving attachments'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
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
  try {
  // Check if authentication is needed
    const needsAuth = needsAuthentication();
    console.log('🔐 Authentication check:', needsAuth ? 'Required' : 'Not required');
    
    if (needsAuth) {
    console.log('🔐 Authentication required - showing login screen');
    createLoginWindow();
      
      // Ensure login window is visible and on top
      if (loginWindow) {
        setTimeout(() => {
          if (loginWindow) {
            loginWindow.show();
            loginWindow.focus();
            loginWindow.moveTop();
            // Force bring to front
            if (loginWindow.setAlwaysOnTop) {
              loginWindow.setAlwaysOnTop(true);
              setTimeout(() => loginWindow.setAlwaysOnTop(false), 500);
            }
            console.log('✅ Login window should now be visible');
          }
        }, 100);
      }
  } else {
    console.log('✅ Authentication exists - loading main window');
    createWindow();
      
      // Ensure main window is visible on first launch
      // Wait for window to be ready before trying to show it
      const fs = require('fs');
      const firstLaunchFlagPath = path.join(app.getPath('userData'), '.first-launch');
      const isFirstLaunch = !fs.existsSync(firstLaunchFlagPath);
      
      // Force show window on first launch (backup to the ready-to-show handler)
      if (isFirstLaunch && mainWindow) {
        // Additional fallback: Show window after a delay if it's first launch
        setTimeout(() => {
          if (mainWindow && !mainWindow.isVisible()) {
            console.log('📱 Showing window (fallback for first launch)');
            mainWindow.show();
            mainWindow.focus();
          }
        }, 2500);
      }
    
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
            mainWindow.focus();
          }
        }
      }, 1000);
    }
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    // Show error dialog even if window creation fails
    dialog.showErrorBox(
      'Application Error',
      `Failed to start MoreTranz Printer: ${error.message}\n\nPlease contact support.`
    );
  }
  
  // Register global shortcut to show window (Ctrl+Shift+P)
  // Wait a bit to ensure app is fully ready before registering shortcut
  setTimeout(() => {
    try {
      const registered = globalShortcut.register('CommandOrControl+Shift+P', () => {
        console.log('⌨️ Global shortcut pressed - showing window');
    showWindow();
  });
      
      if (registered) {
        console.log('✅ Global shortcut registered: Ctrl+Shift+P');
      } else {
        console.warn('⚠️ Failed to register global shortcut');
      }
    } catch (error) {
      console.error('❌ Error registering global shortcut:', error);
    }
  }, 500);

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

