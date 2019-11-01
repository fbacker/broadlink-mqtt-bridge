import _ from 'lodash';
import util from 'util';
import { EventEmitter } from 'events';
import BroadlinkJS from 'broadlinkjs-rm';

import logger from './logger';
import config from './config';

class Broadlink {
  constructor() {
    this.loopTimeToFindDevices = 5;
    this.discovering = false;
    this.broadlink = new BroadlinkJS();

    // network callback, device is found
    this.broadlink.on('deviceReady', (device) => {
      this.configureDevice(device);
      logger.debug(
        `Device found model: ${device.host.model}, id: ${device.host.id}, ip: ${device.host.address}`,
      );
      this.emit('device', device);
    });
  }

  devices() {
    const devices = [];
    return _.each(this.broadlink.devices, (device) => devices.push(device));
  }

  devicesInfo() {
    const devices = this.devices();
    return _.map(devices, (device) => device.host);
  }

  configureDevice(device) {
    this.deviceFillInfo(device);
    // listen on temperature changes
    device.on('temperature', (temperature) => {
      logger.debug(`Broadlink Temperature ${temperature} on ${device.host.id}`);
      try {
      // @TODO, change -stat to statistics/ ???
        this.emit('publish-mqtt', `${config.settings.mqtt.subscribeBasePath}-stat/${device.host.id}/temperature`, temperature.toString());
        // mqtt.publish(
        //   `${mqtt.options.subscribeBasePath}-stat/${device.host.id}/temperature`,
        //   temperature.toString(),
        // );
      } catch (error) {
        logger.error('Temperature publish error', error);
      }
    });
  /*
  // IR or RF signal found
  device.on("rawData", data => {
    logger.debug("Broadlink RAW");
    //recordSave(data);
    //recordCancel();
  });
  // RF Sweep found something
  device.on("rawRFData", temp => {
    logger.debug("Broadlink RAW RF");
    recordMode = recordModeEnum.RecordRFSignal;
  });
  // Don't really know
  device.on("rawRFData2", temp => {
    logger.debug("Broadlink RAW 2");
    recordCancel();
  });
  */
  }

  deviceFillInfo(device) {
    const macAddressParts = device.mac.toString('hex').match(/[\s\S]{1,2}/g) || [];
    device.host.macAddress = macAddressParts.join(':');
    device.host.id = macAddressParts.join('');
    device.host.model = device.model;
    this.broadlink.devices[device.host.id] = device;
  }

  // Emit *.255 broadcast to find devices on network
  discoverDevicesLoop(count = 0) {
  // We are finished, stop looking for devices
    if (count === 0) {
      this.emit('discoverCompleted', Object.keys(this.broadlink.devices).length);
      // console.log("discoveredDevices", discoveredDevices);
      this.discovering = false;
      return;
    }

    // network emit
    const step = this.loopTimeToFindDevices - count;
    const progress = (step / this.loopTimeToFindDevices) * 100;
    this.emit('scan', progress);
    this.broadlink.discover();

    // loop
    count -= 1;
    setTimeout(() => {
      this.discoverDevicesLoop(count);
    }, 5 * 1000);
  }

  // EXPORTED; Run to find devices
  discoverDevices() {
    if (this.discovering) return;
    this.discovering = true;
    // clear
    this.broadlink.devices = {};
    this.discoverDevicesLoop(this.loopTimeToFindDevices);
  }
}
util.inherits(Broadlink, EventEmitter);
export default new Broadlink();
