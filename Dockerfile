# ==========================================
# Stage 1: Build Frontend (Node.js)
# ==========================================
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source code and build it
COPY frontend/ ./
RUN npm run build


# ==========================================
# Stage 2: Build Backend & Serve (Python)
# ==========================================
FROM python:3.11-slim

# Install system dependencies (git is required for repo cloning)
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
# Menggunakan extra-index-url cpu agar tidak mendownload driver NVIDIA GPU (CUDA) yang berukuran 5GB+
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy the built frontend from Stage 1 into /app/frontend/dist
# FastAPI is now configured to serve these files automatically
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Set environment variables for production
ENV PYTHONUNBUFFERED=1

# Expose the single port that serves both API and UI
EXPOSE 8000

# Start the application using Uvicorn
CMD ["uvicorn", "backend.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
