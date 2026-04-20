FROM python:3.12-slim

WORKDIR /app

COPY worker/requirements.txt /tmp/worker-requirements.txt
RUN pip install --no-cache-dir -r /tmp/worker-requirements.txt

COPY backend ./backend
COPY worker ./worker

WORKDIR /app/worker

ENV PYTHONPATH=/app/worker:/app/backend

CMD ["python", "-m", "worker.cli", "run-once", "--limit", "10"]
