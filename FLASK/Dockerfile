FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY main ./main

RUN mkdir -p /app/uploads

EXPOSE 5000

CMD gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 120 app:app
