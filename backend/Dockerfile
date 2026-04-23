FROM node:20-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    && wget http://security.debian.org/debian/pool/main/o/openssl/libssl1.1_1.1.1w-0+deb11u1_amd64.deb -O libssl1.1.deb \
    && dpkg -i libssl1.1.deb || apt-get -f install -y \
    && rm libssl1.1.deb \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma/
COPY src ./src/

RUN npx prisma generate
ENV DATABASE_URL="file:/app/data/dev.db"
RUN mkdir -p /app/data && touch /app/data/dev.db && npx prisma db push

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:/app/data/dev.db"

EXPOSE 3000

CMD ["sh", "-c", "mkdir -p /app/data && npx prisma db push && node src/server.js"]