FROM node:10.15.3

WORKDIR /broadlink-mqtt-bridge

COPY . .

RUN npm install

ENTRYPOINT ["npm", "start"]

VOLUME [ "/broadlink-mqtt-bridge/config/local.json", "/broadlink-mqtt-bridge/commands" ]

EXPOSE 3000
