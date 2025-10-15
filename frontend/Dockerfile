# Use Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application with environment variables
ARG REACT_APP_API_URL=http://74.208.173.203:8000/api/v1
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# Expose port
EXPOSE 3000

# Create a simple server script
RUN echo 'const express = require("express"); const path = require("path"); const app = express(); app.use(express.static(path.join(__dirname, "build"))); app.get("*", (req, res) => { res.sendFile(path.join(__dirname, "build", "index.html")); }); app.listen(3000, "0.0.0.0", () => { console.log("Server running on http://0.0.0.0:3000"); });' > server.js

# Install express for the server
RUN npm install express

# Command to run the custom server
CMD ["node", "server.js"]
