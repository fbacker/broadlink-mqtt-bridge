# amd64 x86_64 arm32v7 armhf arm64v8
ARG arch=amd64
FROM yobasystems/alpine-nodejs:min-${arch}
WORKDIR /app
VOLUME [ "/config", "/commands" ]
EXPOSE 3000 3001
ENV NODE_CONFIG_DIR=/app/config:/config

RUN apk --update add git less openssh && \
    rm -rf /var/lib/apt/lists/* && \
    rm /var/cache/apk/*
COPY package.json package.json
RUN npm install --production
COPY . .
RUN rm config/default.json
RUN mv config/docker.json config/default.json
RUN rm package-lock.json

ENTRYPOINT ["npm", "run", "production"]