# MQTT - Broadlink

Yet another MQTT - Broadlink Bridge for helping OpenHAB.
This tool helps you to record and play Broadlink actions via MQTT or Admin GUI.

You will be able with the filetree see all recorded actions, delete actions and if a disclamation mark occures, this means that the action is a duplicate of another.

![admin gui](https://github.com/fbacker/broadlink-mqtt-bridge/raw/master/github/overview1.png)

### Requirements

- node
- mqtt
- a broadlink device e.g. RM 3 PRO

# Starting

There is a couple of options.

## Raspberry PI AutoInstaller

SSH into your RPI then run the command
```js
bash -c "$(curl -sL https://raw.githubusercontent.com/fbacker/broadlink-mqtt-bridge/master/installers/raspberry.sh)"
```

This will install the broadlink-mqtt-bridge project in /srv/openhab2-conf/broadlink-mqtt-bridge/. At the end of the installer you will have an option to make the project run automatic at boot.

It's possible to start and stop 
```
/etc/init.d/broadlinkbridge
```

To upgrade to latest version just run the script again or run ```git pull```in the app directory.

## Manually

```js
// install
git clone https://github.com/fbacker/broadlink-mqtt-bridge.git
cd broadlink-mqtt-bridge
npm install

// test run the app
node index.js

// add to run at reboot
// example for linux (e.g. openhab2 on RPI)
crontab -e
@reboot cd /home/openhabian/broadlink-mqtt-bridge && node index.js < /dev/null &
```

## Docker

This is on the works

# Configure

in ./config there's a couple of options in default.json. Do not change this. This is the default settings that can be changed.
Make your own file ./config/local.json and only add and change values that you want. This will solve issues with upgrades.


# Running

There's a couple of ways to interact. Web GUI, Websockets, Rest API and with MQTT.

## Web (best for Recording)

Most output and simple is running the web gui. This will output everything from logs and GUI to trigger actions. Possible to change port in config.

http://localhost:3000/

**Multiple devices**
You need to specify the broadlink id in the form input field. You can list connected devices with the 'devices' button.

## WebSocket

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
        Use with play:{id}, e.g. play:ds9323d
        Available devices is found with socket.emit('getDevices'); and listening to socket.on('devices', function(devices) =>
    </script>
```

## Rest API

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
```

## MQTT (best for playing)

Send play, recordir or recordrf to a topic.

```js
// Example play an action
Topic: broadlink / fan / light;
Message: play;
```

# OpenHAB

After recorded a couple of actions it's possible to use with OpenHAB. Use same MQTT server in config settings.

Look at OpenHab documentation how to configure openhab with MQTT https://www.openhab.org/addons/bindings/mqtt1/

```js
/// EXAMPLE SIMPLE ACTION
// Swap light, 1 recorded action

// .items
Switch FanLights "Fan Lights" {mqtt=">[mqtt:broadlink/fan/light:command:ON:play]"}
// or specific broadlink device
Switch FanLights "Fan Lights" {mqtt=">[mqtt:broadlink/fan/light:command:ON:play:23fdsd]"}

// .sitemap
Frame label="Fan Livingroom"  {
    Switch item=FanLights label="Lampor" mappings=[ON="Swap"]
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

# TODOs

- [ ] Create Docker
- [ ] Cleanup project
- [ ] Make GUI pretty
- [x] OpenHAB RPI AutoInstall Script
- [x] Multiple broadlink devices
