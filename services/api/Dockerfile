FROM node:24-slim

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./

RUN npm install

COPY src ./src

RUN npm run build

RUN rm -rf src node_modules/.cache
RUN npm ci --omit=dev

EXPOSE 8080

CMD ["node", "dist/index.js"]
