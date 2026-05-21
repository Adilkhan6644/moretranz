/**
 * Client-side print service for automatic printing
 * Prints files to user's local printers via browser
 */

import { getAuthToken } from './api';

export interface AttachmentPrintData {
  id: number;
  order_id: number;
  file_name: string;
  file_type: string;
  sheet_type: string;
  sheet_number: number;
  pdf_path?: string | null;
  is_label: boolean;
}

class PrintService {
  private printQueue: AttachmentPrintData[] = [];
  private isPrinting = false;
  private printDelay = 500; // Delay between prints in ms

  /**
   * Print an attachment automatically
   * Downloads the file and triggers browser print dialog
   */
  async printAttachment(attachment: AttachmentPrintData): Promise<boolean> {
    try {
      console.log(`🖨️ Starting print job for: ${attachment.file_name}`);
      console.log(`   Type: ${attachment.is_label ? 'Label' : 'Document'}`);

      // Determine which format to use (PDF preferred for labels, or original)
      const format = attachment.pdf_path ? 'pdf' : 'original';

      // Download the file as a blob
      const blob = await this.downloadFile(attachment.id, format);
      if (!blob) {
        console.error('❌ Failed to download file for printing');
        return false;
      }

      // Create a blob URL
      const url = window.URL.createObjectURL(blob);
      
      // Print the file
      const success = await this.printBlob(url, attachment);

      // Clean up
      window.URL.revokeObjectURL(url);

      if (success) {
        console.log(`✅ Print job completed: ${attachment.file_name}`);
      } else {
        console.error(`❌ Print job failed: ${attachment.file_name}`);
      }

      return success;
    } catch (error) {
      console.error('❌ Error printing attachment:', error);
      return false;
    }
  }

  /**
   * Download file from server as blob (for printing)
   */
  private async downloadFile(attachmentId: number, format: string = 'pdf'): Promise<Blob | null> {
    try {
      const token = getAuthToken();
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const formatParam = format === 'pdf' ? 'pdf' : 'original';
      // Use relative URL if apiUrl is empty (for production)
      const url = apiUrl 
        ? `${apiUrl}/api/v1/orders/attachments/${attachmentId}/download?format=${formatParam}`
        : `/api/v1/orders/attachments/${attachmentId}/download?format=${formatParam}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      return await response.blob();
    } catch (fetchError) {
      console.error('❌ Download error:', fetchError);
      return null;
    }
  }

  /**
   * Print a blob URL using iframe method
   */
  private async printBlob(url: string, attachment: AttachmentPrintData): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Create a hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        iframe.style.opacity = '0';
        
        // Set the source
        iframe.src = url;

        // When iframe loads, trigger print
        iframe.onload = () => {
          try {
            // Small delay to ensure content is fully loaded
            setTimeout(() => {
              try {
                // Access iframe window and trigger print
                const iframeWindow = iframe.contentWindow;
                if (iframeWindow) {
                  iframeWindow.focus();
                  iframeWindow.print();
                  
                  // Wait a bit then resolve (print dialog is async)
                  setTimeout(() => {
                    // Clean up iframe after print dialog
                    setTimeout(() => {
                      document.body.removeChild(iframe);
                    }, 1000);
                    resolve(true);
                  }, 500);
                } else {
                  document.body.removeChild(iframe);
                  resolve(false);
                }
              } catch (printError) {
                console.error('❌ Print error:', printError);
                document.body.removeChild(iframe);
                resolve(false);
              }
            }, 300);
          } catch (error) {
            console.error('❌ Iframe load error:', error);
            document.body.removeChild(iframe);
            resolve(false);
          }
        };

        iframe.onerror = () => {
          console.error('❌ Iframe load failed');
          document.body.removeChild(iframe);
          resolve(false);
        };

        // Append to body
        document.body.appendChild(iframe);

        // Timeout fallback
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
          resolve(false);
        }, 10000); // 10 second timeout

      } catch (error) {
        console.error('❌ Print blob error:', error);
        resolve(false);
      }
    });
  }

  /**
   * Queue an attachment for printing (with delay to avoid overwhelming)
   */
  queueAttachment(attachment: AttachmentPrintData) {
    this.printQueue.push(attachment);
    console.log(`📋 Queued attachment for printing: ${attachment.file_name} (Queue size: ${this.printQueue.length})`);
    
    if (!this.isPrinting) {
      this.processQueue();
    }
  }

  /**
   * Process the print queue sequentially
   */
  private async processQueue() {
    if (this.isPrinting || this.printQueue.length === 0) {
      return;
    }

    this.isPrinting = true;

    while (this.printQueue.length > 0) {
      const attachment = this.printQueue.shift();
      if (attachment) {
        await this.printAttachment(attachment);
        
        // Wait before next print (prevents browser from blocking multiple dialogs)
        if (this.printQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.printDelay));
        }
      }
    }

    this.isPrinting = false;
  }

  /**
   * Clear the print queue
   */
  clearQueue() {
    this.printQueue = [];
    this.isPrinting = false;
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueSize: this.printQueue.length,
      isPrinting: this.isPrinting,
    };
  }
}

// Export singleton instance
export const printService = new PrintService();
export default printService;

