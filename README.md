# Yet another MQTT - Broadlink Bridge

- [MQTT - Broadlink](#mqtt---broadlink)
- [Requirements](#requirements)
- [Installation](#installation)
- [Raspberry PI AutoInstaller](#raspberry-pi-autoinstaller)
- [Docker](#docker)
- [Manually](#manually)
- [Configure](#configure)
- [Running](#running)
- [Web (best for Recording)](#web-best-for-recording)
- [MQTT (best for playing)](#mqtt-best-for-playing)
- [Rest API](#rest-api)
- [WebSocket](#websocket)
- [Using With OpenHAB](#using-with-openhab)

This one is built specifically with OpenHAB on a Raspberry PI in mind. However it can be used in other scenarios installation outside RPI.

It has a Admin GUI for helping record IR / RF signals. You will be able with the filetree see all recorded actions, delete actions and if a disclamation mark occures, this means that the action is a duplicate of another (has same binary content).

![admin gui](https://github.com/fbacker/broadlink-mqtt-bridge/raw/master/github/overview1.png)

## Requirements

- Node > 8 (installed on RPI OpenHAB)
- MQTT (mosquitto in OpenHAB)
- Broadlink device e.g. RM 3 PRO

## Installation

### Raspberry PI AutoInstaller

SSH into your RPI then run the command

```js
bash -c "$(curl -sL https://raw.githubusercontent.com/fbacker/broadlink-mqtt-bridge/master/installers/raspberry.sh)"
```

This will install the broadlink-mqtt-bridge project in /srv/openhab2-conf/broadlink-mqtt-bridge/. At the end of the installer you will have an option to make the project run automatic at boot.

To upgrade to latest version just run the script again.

You can control the service with

```js
// Start service
sudo systemctl start broadlinkbridge.service
// Stop service
sudo systemctl stop broadlinkbridge.service
// Restart service
sudo systemctl restart broadlinkbridge.service
```

### Docker

```bash

docker run --network=host \
  -v "$PWD/config/local.json:/broadlink-mqtt-bridge/config/local.json" \
  -v "$PWD/commands:/broadlink-mqtt-bridge/commands" \
  fbacker/broadlink-mqtt-bridge
```

#### Docker Compose

```yml
version: "3.7"
services:
  broadlink-mqtt-bridge:
    image: "fbacker/broadlink-mqtt-bridge"
    restart: always
    network_mode: host
    volumes:
      - "./config/local.json:/broadlink-mqtt-bridge/config/local.json"
      - "./commands:/broadlink-mqtt-bridge/commands"
```

### Manually

```js
// install
cd /srv/openhab2-conf/
git clone https://github.com/fbacker/broadlink-mqtt-bridge.git
cd broadlink-mqtt-bridge
npm install

// test run the app
node index.js

// add to run at reboot
// example for linux (e.g. openhab2 on RPI)
crontab -e
@reboot cd /home/openhabian/broadlink-mqtt-bridge && node index.js < /dev/null &

// To upgrade to latest version
git pull
```

## Configure

in ./config there's a couple of options in default.json. Do not change this. This is the default settings that can be overwritten.
Make your own file `./config/local.json` and only add and change values that you want.

**NOTE:** Changing the default.json will break updates.

**NOTE2:** mqtt node properties that can be used, look here: https://www.npmjs.com/package/mqtt#client

## Running

There's a couple of ways to interact. Web GUI, Websockets, Rest API and with MQTT.

### Web (best for Recording)

Most output and simple is running the web gui. This will output everything from logs and GUI to trigger actions. Possible to change port in config.

`http://{computer-ip}:3000/`

**Multiple devices**
You need to specify the broadlink id in the form input field. You can list connected devices with the 'devices' button.

### MQTT (best for playing)

Send play, recordir or recordrf to a topic.

```
// Example play an action
Topic: broadlink/fan/light;
Message: play;
```

If using multiple device add the device id in the message.

```
// Play action on specific broadlink device
Topic: broadlink/fan/light;
Message: play-bdh3hi;
```

### Rest API

It's possible to use api to calls for play and recording actions. Note that recording wont give help information as when using the web api.

**Multiple devices**
If using multiple broadlink devices, you need to specify the unique id with the post. Add it with {"id":"myid}.
The ID is found in the webconsole or with /api/devices

```js
// Play a recorded action
curl --header "Content-Type: application/json" \
  --request POST \
  --data '{"topic":"broadlink/tv/samsung/power"}' \
  http://localhost:3000/api/play

// Record IR device
curl --header "Content-Type: application/json" \
  --request POST \
  --data '{"topic":"broadlink/tv/samsung/power"}' \
  http://localhost:3000/api/recordIR

// Record RF device
curl --header "Content-Type: application/json" \
  --request POST \
  --data '{"topic":"broadlink/fan/light"}' \
  http://localhost:3000/api/recordRF

// Tree of files
curl --header "Content-Type: application/json" \
  --request GET \
  http://localhost:3000/api/files

curl --header "Content-Type: application/json" \
  --request DELETE \
  --data '{"file":"commands/fan/light"}' \
  http://localhost:3000/api/files

// List connected devices
curl --header "Content-Type: application/json" \
  --request GET \
  http://localhost:3000/api/devices

// Rescan for devices
curl --header "Content-Type: application/json" \
  --request GET \
  http://localhost:3000/api/devices/discover

```

### WebSocket

Could be good for something right?

Look at ./html/index.html for example. You can call actions and listen to logs.

```js
    <script src="http://localhost:3000/socket.io/socket.io.js"></script>
    <script>
        var socket = io();
        socket.on('connection', function (socket) {
            // connected
        });
        socket.on('log', function (msg) {
            // output logs
        });
        socket.on('config', function (msg) {
            // config file, will trigger on client connect
        });
        socket.on('actions', function (msg) {
            // all saved actions, trigged with
            // socket.emit('getActions');
        });
        socket.on('devices', function(devices) {
            // all connected devices, triggered with
            // socket.emit('getDevices');
        })

        /***
         * action
         *  - play
         *  - recordIR
         *  - recordRF
         * topic
         *  Path to record / play
         */
        socket.emit('action', { action, topic });

        **Multiple Devices**
        If using multiple broadlink devices you need to add the id of the device you want to use.
        Use with play-{id}, e.g. play-ds9323d
        Available devices is found with socket.emit('getDevices'); and listening to socket.on('devices', function(devices) =>
    </script>
```

## Using With OpenHAB

After recorded a couple of actions it's possible to use with OpenHAB. Use same MQTT server in config settings.

Look at OpenHab documentation how to configure openhab with MQTT https://www.openhab.org/addons/bindings/mqtt1/

```js
/// EXAMPLE ON/OFF device
Switch OutdoorLight1 "Outdoor Porch" {mqtt=">[mqtt:broadlink/switches/outdoor/garden1/on:command:ON:play],>[mqtt:broadlink/switches/outdoor/garden1/off:command:OFF:play]"}

// EXAMPLE Swap light
Switch FanLights "Fan Lights" {mqtt=">[mqtt:broadlink/fan/light:command:ON:play]"}
// or specific broadlink device
Switch FanLights "Fan Lights" {mqtt=">[mqtt:broadlink/fan/light:command:ON:play-23fdsd]"}

// .sitemap
Frame label="Fan Livingroom"  {
    Switch item=OutdoorLight1 label="Outdoor"
    Switch item=FanLights label="Swap light" mappings=[ON="Swap"]
}

/// EXAMPLE ADVANCED
// Change fan speed, 6 recorded actions

// .items
Number FanSpeed "Fan Speed [%d]"

// .rules
rule "FanSpeed"
when
    Item FanSpeed changed
then
    if (FanSpeed.state == "NULL") return; // If NULL do nothing
    val topic = "broadlink/fans/livingroom/speed-" + FanSpeed.state
    publish("mqtt", topic, "play")
end

// .sitemap
Selection item=FanSpeed mappings=[1="1", 2="2", 3="3", 4="4", 5="5", 6="6"]
```
