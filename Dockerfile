# === STAGE 1: Build Frontend ===
FROM node:20-alpine AS builder
WORKDIR /app

# Frontend environment variables (required at build time for Vite)
ARG VITE_SUPABASE_URL=https://stgatkuwnouzwczkpphs.supabase.co
ARG VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDI3MTMsImV4cCI6MjA4MTIxODcxM30.2_zKnRPDPYrztbUT2PyQ90WLSjm3eyvp2z_BGJAeAmQ
ARG VITE_ZAP_API_URL
ARG VITE_GOOGLE_API_KEY
ARG VITE_GOOGLE_SEARCH_ENGINE_ID

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_ZAP_API_URL=$VITE_ZAP_API_URL
ENV VITE_GOOGLE_API_KEY=$VITE_GOOGLE_API_KEY
ENV VITE_GOOGLE_SEARCH_ENGINE_ID=$VITE_GOOGLE_SEARCH_ENGINE_ID

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
  && apt-get install -y wget gnupg git \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Backend Dependencies
COPY ["robo-whatsapp-agendamentos/package.json", "./"]
RUN npm install --production

# Copy Backend Source Code
# We copy line by line or folder to avoid clutter, or just copy the whole folder
COPY ["robo-whatsapp-agendamentos/", "./"]

# Copy Built Frontend from Stage 1 to 'dist' folder in backend
COPY --from=builder /app/dist ./dist

# Environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
  NODE_ENV=production

EXPOSE 3001

# Start the server
CMD [ "node", "server.js" ]
