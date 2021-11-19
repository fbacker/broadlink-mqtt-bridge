// -------------------------------------
//         Setup MQTT and listen
// -------------------------------------
// Options settings to use, see IClientOptions in MQTT
// https://github.com/mqttjs/MQTT.js > Client Options
//
// If you want to listen to MQTT events listen to mqtt.subscribeBasePath/#
// E.g. broadlink/#
import util from 'util';
import { EventEmitter } from 'events';
import mqtt from 'mqtt';
import config from './config';
import logger from './logger';

class MQTT {
  constructor() {
    this.options = config.settings.mqtt;
    this.client = mqtt.connect('', this.options);
    logger.debug('MQTT Options', this.options);

    this.client.on('connect', () => {
      logger.debug(`MQTT Connected, subscribe: ${this.options.subscribeBasePath}#`);
      // listen to actions
      this.client.subscribe(`${this.options.subscribeBasePath}#`, (err) => {
        if (err) {
          logger.error('MQTT Failed to Subscribe', err);
        }
      });
    });
    this.client.on('reconnect', () => {
      logger.info('MQTT Trying to reconnect');
    });
    this.client.on('close', () => {
      logger.error('MQTT Closed');
    });
    this.client.on('offline', () => {
      logger.error('MQTT Offline');
    });
    this.client.on('error', (err) => {
      logger.error('MQTT Error', err);
    });
    this.client.on('message', (topic, message, packet) => {
      // We dont want to run retained messages.
      if (packet.retain) {
        logger.debug(`packet is retained, block ${packet.topic}`);
        return;
      }
      const msg = message.toString();
      logger.debug(`MQTT Received Message topic: ${topic}, message: ${msg}`);

      if (topic === `${this.options.subscribeBasePath}internal`) {
        switch (msg.toLowerCase()) {
          case 'temperature':
            this.emit('playTemperature');
            break;
          default:
            logger.warn(`Internal function ${msg} doesn't exist.`);
            break;
        }
      } else {
        this.emit('playCommand', topic, msg);
      }
    });
  }

  publish(topic, message, callback) {
    logger.debug(`MQTT Publish topic: ${topic}, message: ${message}`);
    this.client.publish(topic, message, callback);
  }
}
util.inherits(MQTT, EventEmitter);
export default new MQTT();
