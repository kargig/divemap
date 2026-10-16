#!/bin/bash
set -e

cleanup() {
    docker stop divemap-alembic-mysql >/dev/null 2>&1 || true
    docker rm divemap-alembic-mysql >/dev/null 2>&1 || true
    docker network rm divemap-alembic-network >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Setup DB
cleanup
docker network create divemap-alembic-network || true
docker run -d --name divemap-alembic-mysql --network divemap-alembic-network -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=divemap_test -p 3307:3306 mysql:8.0

echo "Waiting for MySQL..."
until docker exec divemap-alembic-mysql mysqladmin ping -h localhost --silent; do sleep 1; done

# Run Alembic inside container
docker run --rm --network divemap-alembic-network -v "$(pwd):/app" -w /app python:3.13-slim bash -c "
    apt-get update && apt-get install -y default-mysql-client pkg-config default-libmysqlclient-dev && \
    pip install --no-cache-dir uv && \
    uv pip install --system -r requirements.txt && \
    export DATABASE_URL=mysql+pymysql://root:password@divemap-alembic-mysql:3306/divemap_test && \
    alembic upgrade head && \
    echo '---- RUNNING ALEMBIC CHECK ----' && \
    alembic check
"
