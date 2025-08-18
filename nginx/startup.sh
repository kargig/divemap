#!/bin/bash
set -e

echo "🚀 Starting Divemap Nginx Proxy..."

# Create SSL directory if it doesn't exist
mkdir -p /etc/nginx/ssl

# Check if SSL certificates are provided via environment variables
if [ -n "$SSL_CERT" ] && [ -n "$SSL_KEY" ]; then
    echo "📜 SSL certificates found in environment variables"
    echo "$SSL_CERT" > /etc/nginx/ssl/cert.pem
    echo "$SSL_KEY" > /etc/nginx/ssl/key.pem
    
    # Set proper permissions
    chmod 600 /etc/nginx/ssl/cert.pem
    chmod 600 /etc/nginx/ssl/key.pem
    chown nginx:nginx /etc/nginx/ssl/cert.pem
    chown nginx:nginx /etc/nginx/ssl/key.pem
    
    echo "✅ SSL certificates configured"
else
    echo "⚠️  SSL certificates not found in environment variables"
    echo "🔍 Checking Fly.io secrets..."
    
    # Try to get certificates from Fly.io secrets
    if command -v flyctl >/dev/null 2>&1; then
        echo "📥 Attempting to fetch SSL certificates from Fly.io secrets..."
        # This would require flyctl to be available in the container
        # For now, we'll use environment variables
        echo "ℹ️  Please set SSL_CERT and SSL_KEY environment variables"
    fi
    
    # Create self-signed certificate for development/testing
    echo "🔐 Creating self-signed certificate for development..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/key.pem \
        -out /etc/nginx/ssl/cert.pem \
        -subj "/C=GR/ST=Athens/L=Athens/O=Divemap/CN=divemap.gr" \
        -addext "subjectAltName=DNS:divemap.gr,DNS:www.divemap.gr"
    
    chmod 600 /etc/nginx/ssl/cert.pem
    chmod 600 /etc/nginx/ssl/key.pem
    chown nginx:nginx /etc/nginx/ssl/cert.pem
    chown nginx:nginx /etc/nginx/ssl/key.pem
    
    echo "✅ Self-signed certificate created"
fi

# Test nginx configuration
echo "🔍 Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi

# Start nginx
echo "🚀 Starting nginx..."
exec nginx -g "daemon off;"
