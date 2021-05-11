FROM node:alpine

RUN npm install --quiet node-gyp -g

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

ENTRYPOINT ["node", "/app/dist/main.js"]
