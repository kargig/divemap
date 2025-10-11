FROM nginx:alpine

# Install required packages
RUN apk add --no-cache \
    netcat-openbsd \
    && rm -rf /var/cache/apk/*

# Remove the default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom configuration
COPY dev.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx directly (no pre-warming needed in dev)
CMD ["nginx", "-g", "daemon off;"]
