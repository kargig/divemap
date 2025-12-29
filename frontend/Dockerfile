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
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# Production stage - only production dependencies
FROM node:20-alpine as production

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy built app from build stage
COPY --from=build /app/dist ./dist

# Expose port
EXPOSE 8080

# Start the app
CMD ["serve", "-s", "dist", "-l", "8080"]