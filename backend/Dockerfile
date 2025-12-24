# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies (FFmpeg is critical for yt-dlp)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . .

# Create downloads directory with write permissions
RUN mkdir -p downloads && chmod 777 downloads

# Make port 7860 available to the world outside this container
EXPOSE 7860

# Run app.py using gunicorn with gthread worker (Native Threads)
# 1 worker, 100 threads to handle concurrent requests
CMD ["gunicorn", "--worker-class", "gthread", "--threads", "100", "--timeout", "1000", "--bind", "0.0.0.0:7860", "app:app"]
