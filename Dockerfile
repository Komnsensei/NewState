# Use a base image that includes both Node.js and Python, or install Python
# Option 1: Use a multi-stage build or a fat image (e.g., Debian or Ubuntu based Node image)
FROM node:20-slim

# Install Python and pip
# You might need to update apt-get first, depending on how fresh the slim image is
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set python as python3 for consistency
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3 1

# From here, your existing Dockerfile continues
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.cjs"]