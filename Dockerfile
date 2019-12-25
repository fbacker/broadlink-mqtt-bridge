FROM node:alpine

WORKDIR /broadlink-mqtt-bridge
COPY . .
RUN apk --update add git less openssh && \
    rm -rf /var/lib/apt/lists/* && \
    rm /var/cache/apk/*
RUN npm install

ENTRYPOINT ["npm", "start"]

VOLUME [ "/broadlink-mqtt-bridge/config", "/broadlink-mqtt-bridge/commands" ]

EXPOSE 3000 3001
