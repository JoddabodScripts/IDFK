FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma/
COPY src ./src/

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/server.js"]