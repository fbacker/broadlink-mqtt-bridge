import fs from 'fs';
import _ from 'lodash';
import logger from '../logger';
import config from '../config';
import broadlink from '../broadlink';

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
        logger.error(`Blocked call topic: ${data.topic}, message: ${data.message}`);
        return;
      }
    }

    logger.info(
      `Send command topic: ${data.topic}, message: ${data.message}, file: ${data.path}/${data.message}`,
    );
    fs.readFile(data.filePath, (err, fileData) => {
      if (err) {
        return reject(new Error(`Failed to find file: ${data.filePath}`));
      }
      data.deviceModule.sendData(fileData, false);
      resolve(data);
    });
  }
});

const queryTemperatureCommand = (data) => new Promise((resolve, reject) => {
  logger.info('ask for temperature');
  try {
    _.each(broadlink.devices(), (device) => device.checkTemperature());
    resolve(data);
  } catch (error) {
    reject(new Error(`Failed to query temperature ${error}`));
  }
});

export { playCommand, queryTemperatureCommand };
