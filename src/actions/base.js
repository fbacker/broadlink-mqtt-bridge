import path from 'path';
import _ from 'lodash';
import broadlink from '../broadlink';
import logger from '../logger';
import config from '../config';


// Load base information
const prepareAction = (data) => new Promise((resolve, reject) => {
  if (data.topic.indexOf(config.settings.mqtt.subscribeBasePath) !== 0) { return reject(new Error(`Base path wrong for '${data.topic}'`)); }
  if (data.topic.split('/').length < 3) {
    return reject(new Error(
      `Topic is too short, should contain broadcast base e.g. '${config.settings.mqtt.subscribeBasePath}' with following device and action. e.g. ${config.settings.mqtt.subscribeBasePath}tv/samsung/power`,
    ));
  }

  data.topic = data.topic.toLowerCase();
  data.action = data.message.toLowerCase(); // logging output doesn't work with the name message
  const actionPath = data.topic.substr(config.settings.mqtt.subscribeBasePath.length);
  const filePath = `${path.join(config.commandsPath, actionPath, data.message)}.bin`;
  const folderPath = filePath.substr(0, filePath.lastIndexOf('/'));

  // find device to use
  const devices = broadlink.devices();
  const numOfDevices = Object.keys(devices).length;
  let device;
  if (numOfDevices === 0) {
    return reject(new Error('No devices'));
  }
  if (data.device) {
    // we want to select specific device
    device = _.find(devices, (d) => d.host.id === data.device);
    if (!device) return reject(new Error('Requested device not found'));
  } else {
    device = devices[Object.keys(devices)[0]];
  }

  data = {
    ...data,
    path: actionPath,
    folderPath,
    filePath,
    deviceModule: device,
  };
  logger.info(`Prepare topic: ${data.topic}, message: ${data.message}`);
  return resolve(data);
});

// Add to play queue, run when possible
const addToQueue = (data) => new Promise((resolve) => {
  config.addItemToQue(data);
  resolve();
});


export { prepareAction, addToQueue };
