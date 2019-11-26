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

Binding MQTT 1.x (legacy) doesn't work. Please use the updated way of handling MQTT messages with OpenHAB. View wiki for examples.

### Use old system

Do you not want to take part on new version. Checkout git code before v2 merge.

View old readme from here https://github.com/fbacker/broadlink-mqtt-bridge/blob/32128196a1b185520e25d2284554f018e39d4e2a/README.md

```bash
// Checkout latest commit before v2
git clone https://github.com/fbacker/broadlink-mqtt-bridge.git
cd broadlink-mqtt-bridge
git checkout --detach 32128196a1b185520e25d2284554f018e39d4e2a
```
