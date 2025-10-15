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

# Install serve to run the production build
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Command to serve the production build
CMD ["serve", "-s", "build", "-l", "0.0.0.0:3000"]
