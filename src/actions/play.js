import _ from 'lodash';
import logger from '../logger';
import config from '../config';
import broadlink from '../broadlink';
import { fileLoad } from './files';

const playCommand = () => new Promise((resolve, reject) => {
  if (config.queue.length !== 0) {
    // grab item from queue
    const data = config.queue.shift();
    // do we block plays
    if (config.isPlayBlocked()) {
      // can we find a call from GUI sent commands, allow it
      const index = _.findIndex(config.unblocked, (o) => o === data.hash);
      if (index !== -1) {
        config.unblocked.splice(index, 1);
      } else {
        logger.warn(
          `Blocked call topic: ${data.topic}, message: ${data.message}`,
        );
        return;
      }
    }

    fileLoad(data.filePath).then((buffer) => {
      _.each(data.deviceModules, (deviceItem) => {
        logger.info(
          `Send command topic: ${data.topic}, message: ${data.message}, file: ${data.path}/${data.message}, device: ${deviceItem.host.id}`,
        );
        deviceItem.sendData(buffer, false);
      });
      resolve(data);
    }).catch(reject);
  }
});

const queryTemperatureCommand = (data) => new Promise((resolve, reject) => {
  logger.info('Ask for temperatures.');
  try {
    _.each(broadlink.devices(), (device) => device.checkTemperature());
    resolve(data);
  } catch (error) {
    reject(new Error(`Failed to query temperature ${error}`));
  }
});

export { playCommand, queryTemperatureCommand };
