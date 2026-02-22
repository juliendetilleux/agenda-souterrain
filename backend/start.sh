#!/bin/bash

echo "=== Starting Agenda Souterrain API ==="
echo "PORT=${PORT:-8000}"
echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo 'yes' || echo 'NO')"

echo "Running database migrations..."
if alembic upgrade head; then
    echo "Migrations completed successfully."
else
    echo "WARNING: Migrations failed (exit code $?). Starting server anyway..."
fi

echo "Starting server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
