# Yet another MQTT - Broadlink Bridge

This one is built specifically with OpenHAB on a Raspberry PI in mind. However it can be used in other scenarios installation outside RPI. It's possible to run this with e.g. Home Assistant.

## More information

Read the wiki https://github.com/fbacker/broadlink-mqtt-bridge/wiki

It has a Admin GUI for helping record IR / RF signals. You will be able with the filetree see all recorded actions, delete actions and if a disclamation mark occures, this means that the action is a duplicate of another (has same binary content).

![admin gui](https://raw.githubusercontent.com/fbacker/broadlink-mqtt-bridge/master/github/gui.png)

## Requirements Home Assistant

- Node > 8
- MQTT Broker
- Broadlink device e.g. RM 3 PRO

## Requirements OpenHAB

- Node > 8 (installed on RPI OpenHAB)
- MQTT (mosquitto in OpenHAB)
- Broadlink device e.g. RM 3 PRO

## Breaking Changes v1 -> v2 OpenHAB

If previously been using this service and upgrading you'll need to migrate OpenHAB way of handling things.

Binding MQTT 1.x (legacy) doesn't work. Please use the updated way of handling MQTT messages with OpenHAB. View wiki for examples. There's also example of how to downgrade to latest release of version 1.

## Breaking Changes v2 -> v3 (buffer to base64)

Commands are saved as base64 files to make it easier to copy from/to other systems.

As for now if the new base64 (.txt) file isn't found it will try to run the (.bin) file instead. This can be changed in future releases so make sure to upgrade your commands and don't delete the old files until you are sure that they work.

To migrate existing commands run ```npm run convert``` in the service folder. This will create base64 files of all existing bin files (nothing is deleted).

You can se on the icons what is 'old file -> disclaimer (marked file)' and 'new base64 file .> bolt'.
![admin gui](https://raw.githubusercontent.com/fbacker/broadlink-mqtt-bridge/master/github/icons-change.png)