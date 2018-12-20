// from: https://raw.githubusercontent.com/lprhodes/homebridge-broadlink-rm/master/helpers/getDevice.js
const BroadlinkJS = require("broadlinkjs-rm");
//const BroadlinkJS = require("./broadlink");
const broadlink = new BroadlinkJS();
const EventEmitter = require("events");
const myEmitter = new EventEmitter();

const discoveredDevices = {};
const limit = 5;
let discovering = false;

const discoverDevicesLoop = (count = 0) => {
  console.log("Discover device", count);
  discovering = true;
  if (count === 0) {
    console.log("Discover complete, broadcast devices");
    discoveredDevices;
    myEmitter.emit("discoverCompleted", Object.keys(discoveredDevices).length);
    Object.keys(discoveredDevices).forEach(device => {
      myEmitter.emit("device", discoveredDevices[device]);
    });
    discovering = false;
    return;
  }

  broadlink.discover();
  count--;

  setTimeout(() => {
    discoverDevicesLoop(count);
  }, 5 * 1000);
};

const discoverDevices = () => {
  if (discovering) return;
  discovering = true;
  discoverDevicesLoop(5);
};

broadlink.on("deviceReady", device => {
  const macAddressParts =
    device.mac.toString("hex").match(/[\s\S]{1,2}/g) || [];
  //const ipAddressParts = device.host.address.split('.');
  const macAddress = macAddressParts.join(":");
  device.host.macAddress = macAddress;
  const ipAddress = device.host.address;
  console.log("found device", device);
  //console.log("Discover complete")

  if (discoveredDevices[ipAddress]) return;
  /*
    console.log(
      `Discovered Broadlink RM device at ${device.host.macAddress} (${
        device.host.address
      })`
    );
  */

  //device.host.id = macAddressParts.join('').substring(0,4) + ipAddressParts.slice(2).join('');
  device.host.id = macAddressParts.join("");
  discoveredDevices[ipAddress] = device;
  //discoveredDevices[macAddress] = device;
  //myEmitter.emit("device", device);
});

module.exports = { broadlink: myEmitter, discoverDevices };
