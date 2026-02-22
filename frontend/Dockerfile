FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache su-exec

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "mkdir -p /app/.next && chown -R node:node /app/.next /app/node_modules && exec su-exec node:node npm run dev"]
