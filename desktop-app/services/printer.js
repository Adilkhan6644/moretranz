const printer = require('pdf-to-printer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class PrinterService {
  constructor(defaultLabelPrinter, defaultBodyPrinter) {
    this.defaultLabelPrinter = defaultLabelPrinter || null;
    this.defaultBodyPrinter = defaultBodyPrinter || null;
  }

  /**
   * List all available printers using Windows PowerShell
   * More reliable than pdf-to-printer on Windows
   */
  async listPrintersWindows() {
    try {
      // Use PowerShell with execution policy bypass to avoid policy restrictions
      // -ExecutionPolicy Bypass allows the command to run even if execution policy is restricted
      const command = 'powershell -ExecutionPolicy Bypass -Command "Get-Printer | Select-Object Name, PrinterStatus | ConvertTo-Json"';
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 1024 * 1024,
        timeout: 10000 // 10 second timeout
      });
      
      // PowerShell often writes to stderr even on success, so check stdout first
      if (!stdout || stdout.trim() === '') {
        if (stderr && stderr.includes('ExecutionPolicy')) {
          console.warn('PowerShell execution policy issue, trying fallback method');
        } else if (stderr) {
          console.warn('PowerShell warning:', stderr);
        }
        return await this.listPrintersFallback();
      }

      let printers;
      try {
        const output = stdout.trim();
        // Remove any BOM or leading characters
        const cleanOutput = output.replace(/^\uFEFF/, '');
        printers = JSON.parse(cleanOutput);
      } catch (parseError) {
        console.error('Error parsing printer JSON:', parseError.message);
        console.error('Raw output (first 200 chars):', stdout.substring(0, 200));
        return await this.listPrintersFallback();
      }

      // Handle case where only one printer exists (returns object, not array)
      const printerList = Array.isArray(printers) ? printers : [printers];
      
      // Filter out null/undefined entries and ensure Name exists
      const validPrinters = printerList.filter(p => p && p.Name && typeof p.Name === 'string');
      
      if (validPrinters.length === 0) {
        console.warn('No valid printers found in PowerShell output, trying fallback');
        return await this.listPrintersFallback();
      }
      
      return validPrinters.map(p => ({
        name: p.Name.trim(),
        isDefault: false, // We'll check this separately
        status: p.PrinterStatus || 'unknown'
      }));
    } catch (error) {
      console.error('Error listing printers via PowerShell:', error.message);
      // Fallback to pdf-to-printer
      return await this.listPrintersFallback();
    }
  }

  /**
   * Fallback method using pdf-to-printer
   */
  async listPrintersFallback() {
    try {
      const printers = await printer.getPrinters();
      return printers.map(p => ({
        name: p.name,
        isDefault: p.isDefault || false,
        status: p.status || 'unknown'
      }));
    } catch (error) {
      console.error('Error listing printers (fallback):', error);
      return [];
    }
  }

  /**
   * Get default printer using Windows PowerShell
   */
  async getDefaultPrinterWindows() {
    try {
      // Use WMI/CIM to get default printer with execution policy bypass
      const command = 'powershell -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_Printer -Filter \\"Default = $true\\").Name"';
      const { stdout } = await execAsync(command, { timeout: 5000 });
      const defaultPrinter = stdout.trim();
      if (defaultPrinter && defaultPrinter !== '') {
        return defaultPrinter;
      }
      return null;
    } catch (error) {
      // Fallback: try alternative method
      try {
        const altCommand = 'powershell -ExecutionPolicy Bypass -Command "Get-WmiObject -Class Win32_Printer -Filter Default=$true | Select-Object -ExpandProperty Name"';
        const { stdout } = await execAsync(altCommand, { timeout: 5000 });
        const defaultPrinter = stdout.trim();
        if (defaultPrinter && defaultPrinter !== '') {
          return defaultPrinter;
        }
        return null;
      } catch (altError) {
        console.warn('Could not determine default printer:', altError.message);
        return null;
      }
    }
  }

  /**
   * List all available printers
   */
  async listPrinters() {
    if (process.platform === 'win32') {
      const printers = await this.listPrintersWindows();
      
      // Mark default printer (non-blocking - if it fails, just continue without marking)
      try {
        const defaultPrinter = await this.getDefaultPrinterWindows();
        if (defaultPrinter) {
          return printers.map(p => ({
            ...p,
            isDefault: p.name === defaultPrinter
          }));
        }
      } catch (error) {
        // If getting default printer fails, just continue without marking
        console.warn('Could not determine default printer, continuing without it');
      }
      
      return printers;
    } else {
      // For Mac/Linux, use pdf-to-printer
      return await this.listPrintersFallback();
    }
  }

  /**
   * Get default printer
   */
  async getDefaultPrinter() {
    if (process.platform === 'win32') {
      return await this.getDefaultPrinterWindows();
    } else {
      try {
        const defaultPrinter = await printer.getDefaultPrinter();
        return defaultPrinter || null;
      } catch (error) {
        console.error('Error getting default printer:', error);
        return null;
      }
    }
  }

  /**
   * Verify that a printer exists and is available
   * @param {string} printerName - Name of printer to verify
   * @returns {Promise<boolean>} True if printer exists
   */
  async verifyPrinterExists(printerName) {
    try {
      const printers = await this.listPrinters();
      // Case-insensitive matching (Windows printer names can vary)
      const found = printers.find(p => 
        p.name.toLowerCase() === printerName.toLowerCase() ||
        p.name === printerName
      );
      return !!found;
    } catch (error) {
      console.warn('Could not verify printer existence:', error.message);
      return true; // Assume it exists if we can't verify
    }
  }

  /**
   * Find the exact printer name (case-sensitive match)
   * @param {string} printerName - Name to find (may be case-insensitive)
   * @returns {Promise<string|null>} Exact printer name or null
   */
  async findExactPrinterName(printerName) {
    try {
      const printers = await this.listPrinters();
      // Try exact match first
      let found = printers.find(p => p.name === printerName);
      if (found) return found.name;
      
      // Try case-insensitive match
      found = printers.find(p => p.name.toLowerCase() === printerName.toLowerCase());
      if (found) {
        console.log(`⚠️ Printer name case mismatch: "${printerName}" -> "${found.name}"`);
        return found.name;
      }
      
      return null;
    } catch (error) {
      console.warn('Could not find exact printer name:', error.message);
      return printerName; // Return original if we can't verify
    }
  }

  /**
   * Print a PDF file to specified printer
   * @param {string} filePath - Path to PDF file
   * @param {string} printerName - Name of printer (optional, uses default if not specified)
   * @returns {Promise<boolean>} Success status
   */
  async printFile(filePath, printerName = null) {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return false;
      }

      // If no printer specified, use default
      if (!printerName) {
        printerName = await this.getDefaultPrinter();
        if (!printerName) {
          console.error('No printer specified and no default printer found');
          return false;
        }
      }

      // Verify printer exists and get exact name (handles case sensitivity)
      const exactPrinterName = await this.findExactPrinterName(printerName);
      if (!exactPrinterName) {
        console.error(`❌ Printer not found: "${printerName}"`);
        console.error('   Available printers:', (await this.listPrinters()).map(p => p.name).join(', '));
        return false;
      }

      // Use exact printer name for printing
      const finalPrinterName = exactPrinterName;

      // Print options
      const options = {
        printer: finalPrinterName,
        silent: true, // Don't show print dialog
        pages: '1-', // Print all pages
        copies: 1
      };

      console.log(`🖨️ Printing ${path.basename(filePath)} to "${finalPrinterName}"...`);

      // Print the file with timeout
      const printPromise = printer.print(filePath, options);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Print timeout after 30 seconds')), 30000)
      );
      
      await Promise.race([printPromise, timeoutPromise]);
      
      console.log(`✅ Successfully printed to "${finalPrinterName}"`);
      return true;

    } catch (error) {
      console.error(`❌ Print error: ${error.message}`);
      console.error(`   File: ${path.basename(filePath)}`);
      console.error(`   Printer: ${printerName}`);
      
      // Provide helpful error message
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        console.error('   💡 Tip: The printer may have been renamed or removed. Please reconfigure in settings.');
      } else if (error.message.includes('timeout')) {
        console.error('   💡 Tip: The printer may be offline or busy. Check printer status.');
      }
      
      return false;
    }
  }

  /**
   * Print based on file type (label vs document)
   */
  async printByType(filePath, isLabel = false) {
    const printerName = isLabel ? this.defaultLabelPrinter : this.defaultBodyPrinter;
    return await this.printFile(filePath, printerName);
  }
}

module.exports = PrinterService;

