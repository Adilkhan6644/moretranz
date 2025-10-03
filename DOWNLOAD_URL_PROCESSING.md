# Download URL Processing - Implementation Guide

## Overview
This document describes the implementation of download URL extraction and processing from email bodies in the MoreTranz API system.

## What Was Implemented

### 1. **Order Type Mapping**
A comprehensive mapping system between human-readable order type names and internal format identifiers:

```python
ORDER_TYPE_MAPPING = {
    "DTF": "dtf_textile",
    "ProColor": "dtf_procolor",
    "Glitter": "dtf_glitter",
    "UV DTF": "dtf_uv",
    "Sublimation": "dtf_sublimation",
    "Glow in the Dark": "dtf_glow",
    "Gold Foil": "dtf_gold_foil",
    "Reflective": "dtf_reflective",
    "Pearl": "dtf_pearl",
    "Iridescent": "dtf_iridescent",
    "Spangle": "spangle",
    "Thermochromic": "dtf_thermochromic"
}
```

This mapping is used throughout the system to:
- Identify order types from email content
- Generate appropriate filenames for downloads
- Organize files by order type

### 2. **HTML Body Extraction**
Added `get_email_html_body()` function to extract HTML content from emails:
- Parses multipart emails to find HTML parts
- Handles single-part HTML emails
- Gracefully handles decoding errors

### 3. **Download URL Extraction**
Added `extract_download_urls_from_html()` function that:
- Parses HTML using BeautifulSoup
- Finds all links with "Download" text
- Extracts context from parent elements (up to 5 levels)
- Returns structured data with URL, link text, and context

### 4. **Order Type Detection**
Added `detect_order_type_from_context()` function that:
- Analyzes link text and surrounding context
- Identifies the order type (DTF, Glitter, ProColor, etc.)
- Extracts gang sheet numbers (e.g., "Gang Sheet #1")
- Handles variations in naming (UV DTF, UV-DTF, UVDTF)

### 5. **File Download Functionality**
Added `download_file_from_url()` async function that:
- Downloads files from URLs with proper headers
- Uses streaming for efficient memory usage
- Includes timeout handling (60 seconds default)
- Returns success/failure status
- Provides detailed logging

### 6. **Filename Generation**
Added `get_filename_from_url()` function that:
- Extracts filename from URL path
- Handles URL encoding/decoding
- Provides fallback naming when filename can't be determined
- Ensures valid file extensions

### 7. **Download Processing Integration**
Added `process_download_urls()` method to EmailProcessor class that:
- Extracts HTML from email
- Finds all download links
- Detects order type for each link
- Downloads files to order folder
- Converts images to PDF format
- Saves attachment records to database
- Automatically prints downloaded files

### 8. **Workflow Integration**
The download URL processing is now integrated into the main email processing workflow:

```
1. Parse order details
2. Create order in database
3. Process email attachments ← existing functionality
4. Process download URLs ← NEW functionality
5. Create email body PDF
6. Mark order as completed
```

## How It Works

### Email Processing Flow

When an email is received:

1. **Email Parsing**: The system extracts both plain text and HTML bodies
2. **URL Extraction**: HTML is parsed to find "Download" links
3. **Context Analysis**: For each link, the system analyzes surrounding text to determine:
   - Order type (DTF, Glitter, ProColor, Spangle, etc.)
   - Gang sheet number
4. **File Download**: Files are downloaded from URLs
5. **File Processing**: 
   - Images are converted to 4x6" PDF labels
   - PDFs are used as-is
6. **Database Recording**: Each download is saved as an Attachment record
7. **Printing**: Downloaded files are automatically sent to printer

### Example Email Processing

**Email Content (HTML):**
```html
<h2>Glitter</h2>
<p>Glitter Gang Sheet #1 <a href="https://example.com/glitter_sheet1.png">Download</a></p>

<h2>DTF</h2>
<p>DTF Gang Sheet #1 <a href="https://example.com/dtf_sheet1.png">Download</a></p>
<p>DTF Gang Sheet #2 <a href="https://example.com/dtf_sheet2.png">Download</a></p>
```

**System Processing:**
1. Detects 3 download links
2. Link 1: Glitter, Sheet #1 → downloads as `dtf_glitter_sheet_1.png`
3. Link 2: DTF, Sheet #1 → downloads as `dtf_textile_sheet_1.png`
4. Link 3: DTF, Sheet #2 → downloads as `dtf_textile_sheet_2.png`
5. Each file is converted to PDF and printed

## Supported Order Types

The system now supports all order types requested by the client:

- **DTF** (Direct to Film) → `dtf_textile`
- **ProColor** → `dtf_procolor`
- **Glitter** → `dtf_glitter`
- **UV DTF** → `dtf_uv`
- **Sublimation** → `dtf_sublimation`
- **Glow in the Dark** → `dtf_glow`
- **Gold Foil** → `dtf_gold_foil`
- **Reflective** → `dtf_reflective`
- **Pearl** → `dtf_pearl`
- **Iridescent** → `dtf_iridescent`
- **Spangle** → `spangle`
- **Thermochromic** → `dtf_thermochromic`

## Dependencies

The implementation uses the following libraries:
- **beautifulsoup4** (≥4.9.3): For HTML parsing
- **requests** (≥2.26.0): For HTTP downloads

Both are already included in `requirements.txt`.

## Error Handling

The system includes comprehensive error handling:

1. **Missing HTML**: If no HTML body found, gracefully skips URL processing
2. **No Links**: If no download links found, logs and continues
3. **Download Failures**: Logs errors and continues with remaining downloads
4. **Timeout**: 60-second timeout per download with proper error logging
5. **Unknown Order Types**: Logs warning and skips download
6. **Database Errors**: Logs to processing_logs table

## Logging

The system provides detailed console logging:

```
🔗 Found 3 download link(s) in email
📥 Processing download 1/3
Link text: Download
URL: https://example.com/glitter_sheet1.png
Detected: Glitter Gang Sheet #1
📥 Downloading from URL: https://example.com/glitter_sheet1.png
✅ Downloaded successfully: C:\path\to\folder\dtf_glitter_sheet_1.png (45623 bytes)
🔄 Converting downloaded image to PDF: dtf_glitter_sheet_1_label.pdf
✅ PDF conversion successful
✅ Download saved to database
```

## Database Schema

Downloads are saved with the same schema as email attachments:

```python
Attachment(
    order_id=order.id,
    file_name="dtf_glitter_sheet_1.png",
    file_path="/path/to/original.png",
    pdf_path="/path/to/converted.pdf",  # If image was converted
    file_type="png",
    print_status="pending",
    sheet_type="Glitter Gang Sheet",
    sheet_number=1
)
```

## Testing Recommendations

1. **Test with single order type email**: Verify basic functionality
2. **Test with multiple order types**: Ensure all types are detected
3. **Test with multiple gang sheets**: Verify sheet numbering
4. **Test with various URL formats**: Ensure download works
5. **Test error cases**: Invalid URLs, timeouts, missing files
6. **Monitor logs**: Check for proper detection and processing

## Configuration

No additional configuration needed. The system:
- Uses existing `ATTACHMENTS_FOLDER` setting
- Integrates with existing printer service
- Uses existing database models
- Follows existing file organization patterns

## Future Enhancements

Potential improvements:
1. Parallel downloads for faster processing
2. Retry logic for failed downloads
3. Download progress tracking via WebSocket
4. Support for authenticated download URLs
5. Configurable timeout per order type
6. Download size limits

## Troubleshooting

**Issue: Downloads not detected**
- Check that email has HTML body (not just plain text)
- Verify link text contains "download" (case-insensitive)
- Check console logs for parsing errors

**Issue: Wrong order type detected**
- Review context extraction (may need to adjust parent level depth)
- Add special case handling in `detect_order_type_from_context()`

**Issue: Download fails**
- Check URL is publicly accessible
- Verify timeout is sufficient (adjust if needed)
- Check network connectivity
- Review error logs for specific HTTP errors

**Issue: File not printing**
- Check printer service logs
- Verify PDF conversion succeeded
- Check file permissions

## Summary

This implementation enables the MoreTranz API to:
✅ Extract download URLs from email HTML
✅ Detect and classify all 12+ order types
✅ Download files automatically
✅ Convert and print downloads
✅ Maintain consistent file organization
✅ Provide comprehensive logging and error handling

The system is production-ready and integrates seamlessly with the existing email processing workflow.

