# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Set npm configuration for better reliability
RUN npm config set registry https://registry.npmjs.org/
RUN npm config set fetch-retries 3
RUN npm config set fetch-retry-mintimeout 5000
RUN npm config set fetch-retry-maxtimeout 60000

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --timeout=300000

# Copy source code
COPY . .

# Build the app with environment variables (using production build that skips ESLint)
ARG REACT_APP_API_URL
ARG REACT_APP_GOOGLE_CLIENT_ID
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID
ENV GENERATE_SOURCEMAP=false
RUN GENERATE_SOURCEMAP=false npm run build:prod

# Production stage - only production dependencies
FROM node:20-alpine as production

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy built app from build stage
COPY --from=build /app/build ./build

# Expose port
EXPOSE 8080

# Start the app
CMD ["serve", "-s", "build", "-l", "8080"] 