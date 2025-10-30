FROM python:3.11-slim

WORKDIR /app
COPY requirements-serp.txt .
RUN pip install --no-cache-dir -r requirements-serp.txt

COPY . .
ENV PYTHONUNBUFFERED=1
CMD ["python", "ml/serp_collection.py"]
