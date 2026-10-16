# Stage 1: Builder
# All dependencies have pre-built wheels (including octo-deco via GitHub Release).
# Zero C-compilers (gcc, build-essential, python3-dev) needed!
FROM python:3.13-slim AS builder

WORKDIR /app

# Install uv from official binary
COPY --from=ghcr.io/astral-sh/uv:0.10.2 /uv /uvx /bin/

# Configure uv environment
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Create destination virtualenv
RUN uv venv /opt/venv --python python3.13
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy dependency specifications
COPY pyproject.toml uv.lock ./

# Install production dependencies only using BuildKit cache mount
RUN --mount=type=cache,target=/root/.cache/uv uv sync --active --frozen --no-dev --no-install-project


# Stage 2: Runtime
# This stage is the final small image containing only the app and its runtime deps
FROM python:3.13-slim AS runtime

WORKDIR /app

# Install runtime-only system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends netcat-openbsd libmagic1 && rm -rf /var/lib/apt/lists/* && apt-get clean

# Copy the pre-compiled virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv

# Ensure the app uses the virtualenv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy application code
COPY . .

# Create uploads directory and set permissions
RUN mkdir -p uploads && chmod +x /app/run_migrations.py /app/run_migrations_docker.sh /app/test_netcat_ipv6.sh /app/startup.sh

# Expose port
EXPOSE 8000

# Run the startup script
CMD ["/app/startup.sh"]
