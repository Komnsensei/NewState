# Use a base image that includes both Node.js and Python, or install Python
# Option 1: Use a multi-stage build or a fat image (e.g., Debian or Ubuntu based Node image)
FROM node:20-slim
<<<<<<< HEAD

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
=======
    WORKDIR /app

    # --- Install PowerShell Core ---
    # Install dependencies for adding new package sources and HTTPS transport
    RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        gnupg \
        # Cleanup /var/lib/apt/lists/* after initial install to keep layer small
        && rm -rf /var/lib/apt/lists/* \
        # Download the Microsoft package signing key
        && curl -sSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/microsoft.gpg > /dev/null \
        # Add the Microsoft product repository for Debian 12 (Bookworm)
        && sh -c 'echo "deb [arch=amd64 signed-by=/etc/apt/trusted.gpg.d/microsoft.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/microsoft.list' \
        # Update package lists to include PowerShell repository
        && apt-get update \
        # Install PowerShell
        && apt-get install -y powershell \
        # Clean up apt cache and temporary files to reduce image size
        && apt-get clean \
        && rm -rf /var/lib/apt/lists/*
    # --- End PowerShell Core Install ---

    COPY package*.json ./
    RUN npm ci --omit=dev
    COPY . .
    ENV PORT=8080
    EXPOSE 8080
    CMD ["npm", "start"]
>>>>>>> 14deb1f (feat: Add PowerShell Core to Dockerfile for QIH Integrator and update CMD)
