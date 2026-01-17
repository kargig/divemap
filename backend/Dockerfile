FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies including netcat-openbsd for IPv6 support
# Optimized for faster installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    netcat-openbsd \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies using only pre-compiled wheels
# Optimized pip installation for faster startup
RUN pip install --no-cache-dir --only-binary=all --disable-pip-version-check -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory and make scripts executable in one layer
RUN mkdir -p uploads && \
    chmod +x /app/run_migrations.py && \
    chmod +x /app/run_migrations_docker.sh && \
    chmod +x /app/test_netcat_ipv6.sh && \
    chmod +x /app/startup.sh

# Set environment variables for faster startup
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# Expose port
EXPOSE 8000

# Run the startup script
CMD ["/app/startup.sh"] 