FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY catalogs ./catalogs

ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV XIRA_CATALOG_PATH=/app/catalogs/asset_catalog.json

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
