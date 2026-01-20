# === STAGE 1: Build Frontend ===
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build React App
RUN npm run build

# === STAGE 2: Production Server ===
FROM node:20-slim

# Install Google Chrome Stable and fonts
# Note: "gnupg" and "wget" are installed to download the signing key.
RUN apt-get update \
  && apt-get install -y wget gnupg \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Backend Dependencies
COPY ["robo whatsapp agendamentos/package.json", "./"]
RUN npm install --production

# Copy Backend Source Code
# We copy line by line or folder to avoid clutter, or just copy the whole folder
COPY ["robo whatsapp agendamentos/", "./"]

# Copy Built Frontend from Stage 1 to 'dist' folder in backend
COPY --from=builder /app/dist ./dist

# Environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
  NODE_ENV=production

EXPOSE 3001

# Start the server
CMD [ "node", "server.js" ]
