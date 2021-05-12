FROM node:alpine

RUN apk --no-cache add git
RUN npm install --quiet node-gyp -g

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

ENTRYPOINT ["node", "/app/dist/main.js"]
