# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    wget \
    xvfb \
    fontconfig \
    libfreetype6 \
    libx11-6 \
    libxext6 \
    libxrender1 \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install wkhtmltopdf from official source
RUN wget -q https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && apt-get update \
    && apt-get install -y ./wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && rm wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Create necessary directories
RUN mkdir -p logs attachments

# Copy startup script
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["/app/startup.sh"]
