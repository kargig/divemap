FROM nginx:alpine

# Install required packages
RUN apk add --no-cache \
    netcat-openbsd \
    && rm -rf /var/cache/apk/*

# Remove the default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom configuration
COPY dev.conf /etc/nginx/nginx.conf

# Copy startup script
COPY startup.sh /usr/local/bin/startup.sh
RUN chmod +x /usr/local/bin/startup.sh

# Expose port 80
EXPOSE 80

# Start nginx with pre-warming
CMD ["/usr/local/bin/startup.sh"]
