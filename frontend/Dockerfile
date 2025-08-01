# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Set npm configuration for better reliability
RUN npm config set registry https://registry.npmjs.org/
RUN npm config set fetch-retries 3
RUN npm config set fetch-retry-mintimeout 5000
RUN npm config set fetch-retry-maxtimeout 60000

# Copy package files
COPY package*.json ./

# Install only production dependencies (excludes devDependencies)
RUN npm ci --only=production --timeout=300000

# Copy source code
COPY . .

# Build the app with environment variables
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy built app from build stage
COPY --from=build /app/build ./build

# Expose port
EXPOSE 8080

# Start the app
CMD ["serve", "-s", "build", "-l", "8080"] 