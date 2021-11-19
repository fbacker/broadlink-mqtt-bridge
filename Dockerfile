FROM node:14
WORKDIR /app
VOLUME [ "/config", "/commands" ]
EXPOSE 3000 3001
ENV NODE_CONFIG_DIR=/app/config:/config

COPY package.json package.json
RUN npm install --production
COPY . .
RUN rm config/default.json
RUN mv config/docker.json config/default.json
RUN rm package-lock.json

ENTRYPOINT ["npm", "run", "production"]