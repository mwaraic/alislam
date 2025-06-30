# Lightweight build for Cloudflare deployment
FROM python:3.11-slim as builder

WORKDIR /app

# Install minimal build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Create virtual environment and install with size optimization
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install packages with CPU-only torch
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch==2.6.0+cpu --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt && \
    # Light cleanup - keep essential torch components
    find /opt/venv -type f -name "*.pyc" -delete && \
    find /opt/venv -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    # Remove only clearly unnecessary torch components
    rm -rf /opt/venv/lib/python*/site-packages/torch/test 2>/dev/null || true && \
    rm -rf /opt/venv/lib/python*/site-packages/torch/include 2>/dev/null || true

# Final stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy virtual environment
COPY --from=builder /opt/venv /opt/venv

# Environment setup
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH=/app \
    PYTHONUNBUFFERED=1

# Copy application code
COPY core/ ./core/
COPY main.py .

# Create non-root user
RUN useradd --no-create-home --shell /bin/false app \
    && mkdir -p /home/app/.cache/huggingface \
    && chown -R app:app /app /home/app

USER app

EXPOSE 8000

# Updated health check that handles startup delays better
HEALTHCHECK --interval=30s --timeout=30s --start-period=120s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "30"] 