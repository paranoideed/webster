FROM node:24-alpine
WORKDIR /app
ARG GITHUB_TOKEN
COPY package*.json ./
RUN echo "@paranoideed:registry=https://npm.pkg.github.com" > .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc && \
    npm install && \
    rm .npmrc
COPY . .
EXPOSE 3000
