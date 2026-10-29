# --- build del frontend ---
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- runtime: API + frontend statico ---
FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt requirements-api.txt
COPY pipeline/requirements.txt requirements-pipeline.txt
RUN pip install --no-cache-dir -r requirements-api.txt -r requirements-pipeline.txt
COPY backend/ backend/
COPY pipeline/ pipeline/
COPY --from=web /web/dist frontend/dist
ENV DATA_DIR=/data STATIC_DIR=/app/frontend/dist
VOLUME /data
EXPOSE 8000
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
