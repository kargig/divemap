# Stage 1: Builder
# This stage installs build tools and compiles dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    gcc \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install dependencies into a wheels directory or directly
# Using a virtualenv is the cleanest way to transfer to the next stage
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt


# Stage 2: Runtime
# This stage is the final small image containing only the app and its runtime deps
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install runtime-only system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    netcat-openbsd \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy the pre-compiled virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv

# Ensure the app uses the virtualenv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy application code
COPY . .

# Create uploads directory and set permissions
RUN mkdir -p uploads && \
    chmod +x /app/run_migrations.py && \
    chmod +x /app/run_migrations_docker.sh && \
    chmod +x /app/test_netcat_ipv6.sh && \
    chmod +x /app/startup.sh

# Expose port
EXPOSE 8000

# Run the startup script
CMD ["/app/startup.sh"]
