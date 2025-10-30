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
      // Use PowerShell to get printer list
      const command = 'powershell -Command "Get-Printer | Select-Object Name, PrinterStatus | ConvertTo-Json"';
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 });
      
      if (stderr && !stdout) {
        console.error('PowerShell error:', stderr);
        return await this.listPrintersFallback();
      }

      if (!stdout || stdout.trim() === '') {
        console.warn('No printer output from PowerShell');
        return await this.listPrintersFallback();
      }

      let printers;
      try {
        printers = JSON.parse(stdout.trim());
      } catch (parseError) {
        console.error('Error parsing printer JSON:', parseError);
        console.error('Raw output:', stdout);
        return await this.listPrintersFallback();
      }

      // Handle case where only one printer exists (returns object, not array)
      const printerList = Array.isArray(printers) ? printers : [printers];
      
      // Filter out null/undefined entries
      const validPrinters = printerList.filter(p => p && p.Name);
      
      return validPrinters.map(p => ({
        name: p.Name.trim(),
        isDefault: false, // We'll check this separately
        status: p.PrinterStatus || 'unknown'
      }));
    } catch (error) {
      console.error('Error listing printers via PowerShell:', error);
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
      // Use WMI/CIM to get default printer
      const command = 'powershell -Command "(Get-CimInstance Win32_Printer -Filter \\"Default = $true\\").Name"';
      const { stdout } = await execAsync(command);
      const defaultPrinter = stdout.trim();
      return defaultPrinter || null;
    } catch (error) {
      // Fallback: try alternative method
      try {
        const altCommand = 'powershell -Command "Get-WmiObject -Class Win32_Printer -Filter Default=$true | Select-Object -ExpandProperty Name"';
        const { stdout } = await execAsync(altCommand);
        const defaultPrinter = stdout.trim();
        return defaultPrinter || null;
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

      // Print options
      const options = {
        printer: printerName,
        silent: true, // Don't show print dialog
        pages: '1-', // Print all pages
        copies: 1
      };

      console.log(`🖨️ Printing ${path.basename(filePath)} to ${printerName}...`);

      // Print the file
      await printer.print(filePath, options);
      
      console.log(`✅ Successfully printed to ${printerName}`);
      return true;

    } catch (error) {
      console.error(`❌ Print error: ${error.message}`);
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

