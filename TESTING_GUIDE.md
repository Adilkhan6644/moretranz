# Testing Guide - Download URL Functionality

## 🎯 Purpose
This guide will help you test the new download URL extraction and processing feature.

---

## 📋 Prerequisites

1. ✅ Docker is running
2. ✅ Email configuration is set up in the database
3. ✅ You have access to the sender email account

---

## 🧪 Test Method 1: Send Test Email via Gmail

### Step 1: Configure Email Settings

1. Open your browser and go to: http://localhost:8000/docs (FastAPI Swagger UI)
2. Navigate to the **Email Config** endpoints
3. Configure your email settings:
   - Email address
   - App password
   - Allowed senders
   - Enable processing

### Step 2: Prepare Test Email

**Option A: Use the provided template**
- Open `TEST_EMAIL_TEMPLATE.html` in this folder
- Copy the HTML content

**Option B: Send from Gmail**

1. Compose a new email in Gmail
2. **To:** Your configured email address
3. **From:** One of your allowed senders
4. **Subject:** `Test Order - Glitter + DTF`
5. **Body:** Switch to HTML mode and paste:

```html
<h1>PO Number: TEST123456</h1>
<h2>Order Type: Glitter + DTF + Spangle</h2>
<p><strong>Requires Quality Check:</strong> No</p>

<h3>Delivery address:</h3>
<p>
Test Customer<br>
123 Test Street<br>
Test City, ST 12345
</p>

<p><strong>Committed Shipping Date:</strong> Friday, October 10, 2025</p>

<h2>Glitter</h2>
<p><strong>Total Print Length:</strong> 15.5 inches</p>
<p>
    <strong>Glitter Gang Sheet #1</strong><br>
    <a href="https://via.placeholder.com/600x800.png?text=Glitter+Sheet+1">Download</a>
</p>

<h2>DTF</h2>
<p><strong>Total Print Length:</strong> 22.45 inches</p>
<p>
    <strong>DTF Gang Sheet #1</strong><br>
    <a href="https://via.placeholder.com/600x800.png?text=DTF+Sheet+1">Download</a>
</p>

<h2>Spangle</h2>
<p><strong>Total Print Length:</strong> 10.0 inches</p>
<p>
    <strong>Spangle Gang Sheet #1</strong><br>
    <a href="https://via.placeholder.com/600x800.png?text=Spangle+Sheet+1">Download</a>
</p>
```

### Step 3: Send the Email

Send the email and **leave it as UNREAD** in your inbox.

---

## 📊 Monitor Processing

### View Docker Logs

Open a terminal and run:
```powershell
docker logs -f moretranz_api-backend-1
```

### What to Look For

You should see log output like this:

```
📧 Connecting to Gmail...
✅ Login successful!
🔍 Checking for unread emails...
📩 Found 1 unread emails

📨 Email Details:
From: sender@example.com
Subject: Test Order - Glitter + DTF

✅ Sender is in allowed list!

📦 Order Details:
PO Number: TEST123456
Order Type: Glitter + DTF + Spangle
Customer: Test Customer

📁 Created folder: attachments/TEST123456_Test Customer

💾 Saving order to database...
✅ Order saved successfully

🔗 Found 3 download link(s) in email

📥 Processing download 1/3
Link text: Download
URL: https://via.placeholder.com/600x800.png?text=Glitter+Sheet+1
Detected: Glitter Gang Sheet #1
📥 Downloading from URL: https://via.placeholder.com/600x800.png?text=Glitter+Sheet+1
✅ Downloaded successfully: attachments/TEST123456_Test Customer/dtf_glitter_sheet_1.png (12345 bytes)
🔄 Converting downloaded image to PDF: dtf_glitter_sheet_1_label.pdf
✅ PDF conversion successful
✅ Download saved to database

📥 Processing download 2/3
Link text: Download
Detected: DTF Gang Sheet #1
📥 Downloading from URL: ...
✅ Downloaded successfully
...

📥 Processing download 3/3
Link text: Download
Detected: Spangle Gang Sheet #1
📥 Downloading from URL: ...
✅ Downloaded successfully
...

✅ Order TEST123456 processed successfully
```

---

## ✅ Verification Steps

### 1. Check Files Were Downloaded

Navigate to the attachments folder:
```powershell
cd moretranz_api/attachments
dir TEST123456*
```

You should see a folder like: `TEST123456_Test Customer`

Inside, you should find:
- `dtf_glitter_sheet_1.png` (downloaded image)
- `dtf_glitter_sheet_1_label.pdf` (converted PDF)
- `dtf_textile_sheet_1.png` (DTF download)
- `dtf_textile_sheet_1_label.pdf`
- `spangle_sheet_1.png` (Spangle download)
- `spangle_sheet_1_label.pdf`
- `TEST123456_email_body.pdf` (email body PDF)

### 2. Check Database Records

Access the API docs: http://localhost:8000/docs

Call the **GET /api/v1/orders** endpoint

You should see:
- Order with PO Number: TEST123456
- Multiple attachments (one for each downloaded file)
- Each attachment should have:
  - `file_name`: Original filename
  - `file_path`: Path to downloaded file
  - `pdf_path`: Path to PDF version
  - `sheet_type`: e.g., "Glitter Gang Sheet"
  - `sheet_number`: e.g., 1

### 3. Check Frontend

Open: http://localhost:3000

Navigate to the **Orders** page

You should see:
- New order: TEST123456
- Customer: Test Customer
- Order Type: Glitter + DTF + Spangle
- Status: completed
- All downloaded attachments listed

---

## 🐛 Troubleshooting

### No emails found
- Make sure email is UNREAD
- Check email is from an allowed sender
- Verify email configuration in database

### Downloads not detected
- Check email is in HTML format (not plain text only)
- Verify links have "Download" text
- Check console logs for parsing errors

### Wrong order type detected
- Review the HTML structure
- Ensure order type name is near the download link
- Check logs for detected context

### Download fails
- Verify URL is publicly accessible
- Check internet connection
- Try the URL in a browser
- Review timeout settings (default: 60 seconds)

### Files not converting to PDF
- Check wkhtmltopdf is installed (should be in Docker)
- Verify image files are valid format
- Check file permissions

---

## 🎯 Testing Different Order Types

To test all order types, create test sections for:

### All Supported Types:
- ✅ DTF (Direct to Film)
- ✅ ProColor
- ✅ Glitter
- ✅ UV DTF
- ✅ Sublimation
- ✅ Glow in the Dark
- ✅ Gold Foil
- ✅ Reflective
- ✅ Pearl
- ✅ Iridescent
- ✅ Spangle
- ✅ Thermochromic

### Example for UV DTF:
```html
<h2>UV DTF</h2>
<p><strong>Total Print Length:</strong> 18.0 inches</p>
<p>
    <strong>UV DTF Gang Sheet #1</strong><br>
    <a href="https://via.placeholder.com/600x800.png?text=UV+DTF+Sheet+1">Download</a>
</p>
```

---

## 📈 Success Criteria

✅ Email is detected and parsed
✅ All download links are extracted
✅ Order types are correctly identified
✅ Files are downloaded from URLs
✅ Images are converted to PDFs
✅ Database records are created
✅ Files are organized in order folder
✅ Console shows detailed processing logs

---

## 🔄 Quick Test Commands

### Start email processing:
Visit: http://localhost:8000/docs → POST /api/v1/config/start

### Stop email processing:
Visit: http://localhost:8000/docs → POST /api/v1/config/stop

### View all orders:
Visit: http://localhost:8000/docs → GET /api/v1/orders

### View specific order:
Visit: http://localhost:8000/docs → GET /api/v1/orders/{order_id}

### Check processing logs:
```powershell
docker logs moretranz_api-backend-1 --tail 100
```

---

## 💡 Tips

1. **Use placeholder images** for initial testing (like https://via.placeholder.com/)
2. **Test one order type first**, then gradually add more
3. **Check logs immediately** after sending email
4. **Keep emails simple** initially, add complexity as you verify
5. **Use unique PO numbers** for each test to avoid duplicates
6. **Mark emails as unread** if you want to reprocess them

---

## 🎉 Real-World Testing

Once basic testing works, try with:
1. Real order emails from your client
2. Actual download URLs from their system
3. Multiple gang sheets per order type
4. Complex order combinations
5. Different email formats

---

Happy Testing! 🚀

