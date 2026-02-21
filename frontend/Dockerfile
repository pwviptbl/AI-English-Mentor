FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Altera o dono dos arquivos para que o usuário node consiga escrever as builds (.next)
RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]
