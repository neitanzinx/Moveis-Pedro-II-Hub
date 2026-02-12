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

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
RUN apt-get update \
  && apt-get install -y wget gnupg git procps psmisc \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
  && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# If running Docker >= 1.13.0 use docker run's --init arg to reap zombie processes, otherwise
# uncomment the following lines to have `dumb-init` as PID 1
ADD https://github.com/Yelp/dumb-init/releases/download/v1.2.2/dumb-init_1.2.2_x86_64 /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init
ENTRYPOINT ["dumb-init", "--"]

WORKDIR /app

# Copy Backend Dependencies and install
COPY ["robo-whatsapp-agendamentos/package.json", "./"]
# Install dependencies including Puppeteer
RUN npm install --production

# Copy Backend Source Code
COPY ["robo-whatsapp-agendamentos/", "./"]

# Copy Built Frontend from Stage 1 to 'dist' folder in backend
COPY --from=builder /app/dist ./dist

# Environment variables
ENV NODE_ENV=production
# Force Puppeteer to use installed Chrome
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

EXPOSE 3001

CMD [ "node", "server.js" ]
