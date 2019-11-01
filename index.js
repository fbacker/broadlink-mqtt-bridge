
import logger from './src/logger';
import Webserver from './src/web';

const run = () => {
  logger.info('Starting Broadlink MQTT NodeJS Application');
  Webserver.startServer();
};
run();
