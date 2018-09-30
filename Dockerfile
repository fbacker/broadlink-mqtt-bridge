FROM node:10
WORKDIR /app
ENV DOCKER true

#RUN mkdir /app
#RUN mkdir /app/html
#RUN mkdir /app/config
#RUN mkdir /config  
#RUN mkdir /commands  

COPY package*.json ./
COPY *.js ./
COPY html/* ./html/
#COPY config/default.json /app/config/default.json
COPY config/default.json ./config/default.json

RUN npm install --only=production

EXPOSE 3000
EXPOSE 2000

VOLUME [ "/config", "/commands" ]

CMD [ "node", "index.js" ]

#docker run -p 3000:3000 -d fredrickbacker/broadlink-mqtt-openhab -v ./tmp-config/:/config -v ./tmp-commands/:/commands
#docker run -p 3000:3000 -d fredrickbacker/broadlink-mqtt-openhab --volume=/Users/fredrickbacker/Work/tmpbroad/tmp-config/:/config --volume=/Users/fredrickbacker/Work/tmpbroad/tmp-commands/:/commands

# build
#docker build -t fredrickbacker/broadlink-mqtt-openhab .

#delet all images
#docker rmi $(docker images -q)

#delete all containers
#docker rm $(docker ps -a -q)

#docker run \
#    --name=broadlink \
#    -p 3000:3000 \
#    -p 2000:2000/udp \
#    --volume=/Users/fredrickbacker/Work/tmpbroad/tmp-config/:/config \
#    --volume=/Users/fredrickbacker/Work/tmpbroad/tmp-commands/:/commands \
#    fredrickbacker/broadlink-mqtt-openhab
