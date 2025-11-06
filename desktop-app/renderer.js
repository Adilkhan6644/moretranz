const { ipcRenderer } = require('electron');

// Load configuration
async function loadConfig() {
  try {
    const config = await ipcRenderer.invoke('get-config');
    document.getElementById('serverUrl').value = config.serverUrl || '';
    document.getElementById('authToken').value = config.authToken || '';
    document.getElementById('labelPrinter').value = config.labelPrinter || '';
    document.getElementById('bodyPrinter').value = config.bodyPrinter || '';
    document.getElementById('downloadPath').value = config.downloadPath || '';
    document.getElementById('autoStart').checked = config.autoStart !== false;
    
    // If server URL and token are already set, show success message
    if (config.serverUrl && config.authToken) {
      showStatus('✅ Configuration loaded! Just select your printers below.', 'success');
    }
  } catch (error) {
    showStatus('Error loading configuration', 'error');
  }
}

// Load printer list
async function loadPrinters() {
  try {
    console.log('Loading printers...');
    const printers = await ipcRenderer.invoke('get-printers');
    console.log('Printers received:', printers);
    
    const labelSelect = document.getElementById('labelPrinter');
    const bodySelect = document.getElementById('bodyPrinter');
    
    // Clear existing options
    labelSelect.innerHTML = '<option value="">Select a printer...</option>';
    bodySelect.innerHTML = '<option value="">Select a printer...</option>';
    
    if (!printers || printers.length === 0) {
      labelSelect.innerHTML = '<option value="">No printers found</option>';
      bodySelect.innerHTML = '<option value="">No printers found</option>';
      showStatus('No printers detected. Make sure printers are installed in Windows Settings.', 'error');
      return;
    }
    
    // Add printers
    printers.forEach(printer => {
      const option = document.createElement('option');
      option.value = printer.name;
      option.textContent = `${printer.name}${printer.isDefault ? ' (Default)' : ''}`;
      
      labelSelect.appendChild(option.cloneNode(true));
      bodySelect.appendChild(option.cloneNode(true));
    });
    
    console.log(`Loaded ${printers.length} printers`);
    showStatus(`✅ Found ${printers.length} printer(s)`, 'success');
    
    // Restore saved selections after a short delay
    setTimeout(() => {
      loadConfig();
    }, 100);
  } catch (error) {
    console.error('Error loading printers:', error);
    showStatus('Error loading printers: ' + error.message, 'error');
    const labelSelect = document.getElementById('labelPrinter');
    const bodySelect = document.getElementById('bodyPrinter');
    labelSelect.innerHTML = '<option value="">Error loading printers</option>';
    bodySelect.innerHTML = '<option value="">Error loading printers</option>';
  }
}

// Test connection
async function testConnection() {
  const serverUrl = document.getElementById('serverUrl').value;
  const authToken = document.getElementById('authToken').value;
  
  if (!serverUrl || !authToken) {
    showStatus('Please enter server URL and auth token first', 'error');
    return;
  }
  
  showStatus('Testing connection...', 'success');
  
  try {
    const result = await ipcRenderer.invoke('test-connection', serverUrl, authToken);
    if (result.success) {
      showStatus('✅ Connection successful!', 'success');
    } else {
      showStatus('❌ Connection failed: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('❌ Connection failed: ' + error.message, 'error');
  }
}

// Browse for download folder
async function browseFolder() {
  try {
    const path = await ipcRenderer.invoke('browse-folder');
    if (path) {
      document.getElementById('downloadPath').value = path;
    }
  } catch (error) {
    showStatus('❌ Error selecting folder: ' + error.message, 'error');
  }
}

// Save configuration
async function saveConfig(event) {
  event.preventDefault();
  
  const config = {
    serverUrl: document.getElementById('serverUrl').value,
    authToken: document.getElementById('authToken').value,
    labelPrinter: document.getElementById('labelPrinter').value,
    bodyPrinter: document.getElementById('bodyPrinter').value,
    downloadPath: document.getElementById('downloadPath').value,
    autoStart: document.getElementById('autoStart').checked
  };
  
  try {
    await ipcRenderer.invoke('save-config', config);
    showStatus('✅ Configuration saved! Restarting services...', 'success');
    
    // Reload after a moment
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    showStatus('❌ Error saving configuration: ' + error.message, 'error');
  }
}

// Show status message
function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type} show`;
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 5000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadPrinters();
  
  document.getElementById('testBtn').addEventListener('click', testConnection);
  document.getElementById('browseBtn').addEventListener('click', browseFolder);
  document.getElementById('configForm').addEventListener('submit', saveConfig);
});

