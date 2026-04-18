FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.docker.txt ./

# Use the CPU-only PyTorch index so the container does not pull Linux CUDA
# runtime packages by default during installation.
RUN pip install --upgrade pip && \
    pip install --root-user-action=ignore --index-url https://download.pytorch.org/whl/cpu torch==2.11.0 && \
    pip install --root-user-action=ignore -r requirements.docker.txt

COPY app ./app
COPY data/runtime_bundle_250_64.pkl ./data/runtime_bundle_250_64.pkl

EXPOSE 8001

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
