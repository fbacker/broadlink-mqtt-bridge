import fs from 'fs';
import logger from '../logger';
import config from '../config';

const playCommand = () => new Promise((resolve, reject) => {
  if (config.queue.length !== 0 && !config.isPlayBlocked()) {
    const data = config.queue.shift();
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
  logger.info('queryTemperature');
  try {
    data.deviceModule.checkTemperature();
    resolve(data);
  } catch (error) {
    logger.error('Failed to query temperature');
    reject(new Error('Stopped at queryTemperature'));
  }
});

export { playCommand, queryTemperatureCommand };
