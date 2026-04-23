FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY app ./app
COPY seeds ./seeds
COPY docker-entrypoint.sh ./docker-entrypoint.sh
COPY docker-init.sh ./docker-init.sh
COPY docker-dev-entrypoint.sh ./docker-dev-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh /app/docker-init.sh /app/docker-dev-entrypoint.sh

EXPOSE 8000

CMD ["/app/docker-entrypoint.sh"]
