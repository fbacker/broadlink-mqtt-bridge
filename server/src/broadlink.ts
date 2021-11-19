import _ from 'lodash';
import { EventEmitter } from 'events';
import BroadlinkJS from 'broadlinkjs-rm';
import logger from './logger';

class Broadlink extends EventEmitter {
  _loopTimeToFindDevices = 3;
  _isScanning = false;
  _broadlink: BroadlinkJS = new BroadlinkJS();
  _devicesLocal: Record<string, BroadlinkJS> = {};

  constructor() {
    super();
    // network callback, device is found
    this._broadlink.on('deviceReady', (device) => {
      this.configureDevice(device);
      logger.info(`Device found model: ${device.host.model}, id: ${device.host.id}, ip: ${device.host.address}`);
      logger.debug(`${JSON.stringify(device.host)}`);
      this.emit('device', device);
    });
  }

  isScanning(): boolean {
    return this._isScanning;
  }

  // Return list of devices
  devices(): Array<BroadlinkJS> {
    const devs = [];
    _.each(this._devicesLocal, (device) => devs.push(device));
    return devs;
  }

  // Return list of devices with only the information
  devicesInformation(): Array<BroadlinkJS> {
    const devs = this.devices();
    return _.map(devs, (device) => device.host);
  }

  // Add some extra information to the device object
  configureDevice(device: BroadlinkJS) {
    const macAddressParts = device.mac.toString('hex').match(/[\s\S]{1,2}/g) || [];
    device.host.macAddress = macAddressParts.join(':');
    device.host.id = macAddressParts.join('');
    device.host.model = device.model;
    device.host.type = device.type;

    this._devicesLocal[device.host.id] = device;
    /*
    // listen on temperature changes
    device.on('temperature', (temperature) => {
      logger.debug(`Broadlink Temperature ${temperature} on ${device.host.id}`);
      try {
        // We got temperature, publish to
        // broadlink/internal/temperature/{device-id}
        this.emit(
          'publish-mqtt',
          `${config.settings.mqtt.subscribeBasePath}internal/temperature/${device.host.id}`,
          temperature.toString(),
        );
        this.emit('temperature', device.host.id, temperature.toString());
      } catch (error) {
        logger.error('Temperature publish error', error);
      }
    });
    */
  }

  // Emit *.255 broadcast to find devices on network
  discoverDevicesLoop(count = 0) {
    // We are finished, stop looking for devices
    if (count === 0) {
      this.emit('scan', 100);
      this.emit('discoverCompleted', Object.keys(this._devicesLocal).length);
      this._isScanning = false;
      return;
    }

    // network emit
    const step = this._loopTimeToFindDevices - count;
    const progress = (step / this._loopTimeToFindDevices) * 100;
    this.emit('scan', progress);
    this._broadlink.discover();

    // loop
    count -= 1;
    setTimeout(() => {
      this.discoverDevicesLoop(count);
    }, 3 * 1000);
  }

  // EXPORTED; Run to find devices
  discoverDevices() {
    if (this._isScanning) return false;
    this._isScanning = true;
    // clear
    this._broadlink.devices = {};
    this._devicesLocal = {};
    this.discoverDevicesLoop(this._loopTimeToFindDevices);
    return true;
  }
}
export default new Broadlink();
