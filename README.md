# Yet another MQTT - Broadlink Bridge

This one is built specifically with OpenHAB on a Raspberry PI in mind. However it can be used in other scenarios installation outside RPI.

## More information

Read the wiki https://github.com/fbacker/broadlink-mqtt-bridge/wiki

It has a Admin GUI for helping record IR / RF signals. You will be able with the filetree see all recorded actions, delete actions and if a disclamation mark occures, this means that the action is a duplicate of another (has same binary content).

![admin gui](https://raw.githubusercontent.com/fbacker/broadlink-mqtt-bridge/master/github/gui.png)

## Requirements

- Node > 8 (installed on RPI OpenHAB)
- MQTT (mosquitto in OpenHAB)
- Broadlink device e.g. RM 3 PRO

## Breaking Changes v1 -> v2 OpenHAB

If previously been using this service and upgrading you'll need to migrate OpenHAB way of handling things.

Binding MQTT 1.x (legacy) doesn't work. Please use the updated way of handling MQTT messages with OpenHAB. View wiki for examples. There's also example of how to downgrade to latest release of version 1.
