# MQTT - Broadlink

Yet another MQTT - Broadlink Bridge for helping OpenHAB.

### Requirements

- node
- mqtt
- a broadlink device e.g. RM 3 PRO

# Starting

There is a couple of options.

## Manually

```js
// install
git clone https://github.com/fbacker/broadlink-mqtt-bridge.git
cd broadlink-mqtt-bridge
npm install

// overwrite configs
nano ./config/local.json

// test run the app
node index.js


// add to run at reboot
crontab -e
@reboot cd /home/openhabian/broadlink-mqtt-bridge && node index.js < /dev/null &
```

## Docker

@TODO create Dockerfile that works

# Configure

in ./config there's a couple of options in default.json. Do not change this. This is the default settings that can be changed.
Make your own file ./config/local.json and only add and change values that you want. This will solve issues with upgrades.

**NOTE:** if running 'manual' git repo. Please make sure to set a custom path where to place the commands. If you want to use the same directory as application set null.

```js
// manually running, setting commands saved path to __dirname/commands
{
  "recording": {
    "path": null
  }
}
```

# Running

There's a couple of ways to interact.

## Web

Most output and simple is running the web gui. This will output everything from logs and GUI to trigger actions. Possible to change port in config.

http://localhost:3000/

## WebSocket

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

        /***
         * action
         *  - play
         *  - recordIR
         *  - recordRF
         * topic
         *  Path to record / play
         */
        socket.emit('action', { action, topic });

    </script>
```

## Rest API

It's possible to use api to calls for play and recording actions. Note that recording wont give help information as when using the web api.

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

// JSON Tree of files
curl --header "Content-Type: application/json" \
  --request GET \
  http://localhost:3000/api/files
```

# OpenHAB

After recorded a couple of actions it's possible to use with OpenHAB. Use same MQTT server in config settings.

```js
// gui.items
Switch FanLights "Fan Lights" {mqtt=">[mqtt:broadlink/fan/light:command:ON:play]"}

//gui.sitemap
Frame label="Fan Livingroom"  {
    Switch item=FanLights label="Lampor" mappings=[ON="Swap"]
}
```

# Thanks

This helper is built with https://github.com/lprhodes/broadlinkjs-rm for interaction with broadlink devices.
