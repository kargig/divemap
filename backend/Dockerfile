FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies including netcat-openbsd for IPv6 support
RUN apt-get update && apt-get install -y \
    pkg-config \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies using only pre-compiled wheels
RUN pip install --no-cache-dir --only-binary=all -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Make migration scripts executable
RUN chmod +x /app/run_migrations.py
RUN chmod +x /app/run_migrations_docker.sh
RUN chmod +x /app/test_netcat_ipv6.sh
RUN chmod +x /app/startup.sh

# Expose port
EXPOSE 8000

# Run the startup script
CMD ["/app/startup.sh"] 