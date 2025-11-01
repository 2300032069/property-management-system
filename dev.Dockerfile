FROM node:20-slim

WORKDIR /usr/app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 9229 8081 9091

CMD npm run dev
