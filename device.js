// from: https://raw.githubusercontent.com/lprhodes/homebridge-broadlink-rm/master/helpers/getDevice.js
const BroadlinkJS = require("broadlinkjs-rm");
//const BroadlinkJS = require("./broadlink");
const broadlink = new BroadlinkJS();
const EventEmitter = require("events");
const myEmitter = new EventEmitter();

const discoveredDevices = {};
const limit = 5;
let discovering = false;

const discoverDevices = (count = 0) => {
  discovering = true;
  if (count >= 5) {
    myEmitter.emit(
      "discoverCompleted",
      Object.keys(discoveredDevices).length / 2
    );
    discovering = false;
    return;
  }

  broadlink.discover();
  count++;

  setTimeout(() => {
    discoverDevices(count);
  }, 5 * 1000);
};

discoverDevices();

broadlink.on("deviceReady", device => {
  const macAddressParts =
    device.mac.toString("hex").match(/[\s\S]{1,2}/g) || [];
  const macAddress = macAddressParts.join(":");
  device.host.macAddress = macAddress;

  if (
    discoveredDevices[device.host.address] ||
    discoveredDevices[device.host.macAddress]
  )
    return;
  /*
    console.log(
      `Discovered Broadlink RM device at ${device.host.macAddress} (${
        device.host.address
      })`
    );
  */
  discoveredDevices[device.host.address] = device;
  discoveredDevices[device.host.macAddress] = device;
  myEmitter.emit("device", device);
});

module.exports = myEmitter;
