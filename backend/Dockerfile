FROM python:3.12-slim

WORKDIR /app

RUN useradd -u 1000 -m -s /bin/bash appuser

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY catalogs ./catalogs

RUN chown -R appuser:appuser /app

ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV XIRA_CATALOG_PATH=/app/catalogs/asset_catalog.json

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:' + str(__import__('os').environ.get('PORT', 8000)) + '/api/assets/health', timeout=4)" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
