# ProfitPlay Starter - Multi-language Docker Image
# Supports both Python and Node.js bots

# ============================================
# Python Bot Stage
# ============================================
FROM python:3.11-slim AS python-base

WORKDIR /app

# Install Python dependencies
COPY python/requirements.txt ./python/
RUN pip install --no-cache-dir -r python/requirements.txt

# Copy Python bot code
COPY python/ ./python/

# Create non-root user
RUN useradd -m -u 1000 botuser && chown -R botuser:botuser /app
USER botuser

# Default command for Python bot
CMD ["python", "python/bot.py"]

# ============================================
# Node.js Bot Stage
# ============================================
FROM node:20-slim AS node-base

WORKDIR /app

# Install Node.js dependencies
COPY node/package*.json ./node/
RUN cd node && npm install

# Copy Node.js bot code
COPY node/ ./node/

# Create non-root user
RUN useradd -m -u 1000 botuser && chown -R botuser:botuser /app
USER botuser

# Default command for Node.js bot
CMD ["node", "node/bot.js"]

# ============================================
# Development Stage (includes both)
# ============================================
FROM python:3.11-slim AS development

WORKDIR /app

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY python/requirements.txt ./python/
RUN pip install --no-cache-dir -r python/requirements.txt

# Install Node.js dependencies
COPY node/package*.json ./node/
RUN cd node && npm install

# Copy all source code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 botuser && chown -R botuser:botuser /app
USER botuser

# Default to bash for interactive development
CMD ["bash"]
