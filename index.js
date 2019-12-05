import { exec } from 'child_process';
import logger from './src/logger';
import Webserver from './src/web';
import config from './src/config';


const run = () => {
  logger.info('Starting Broadlink MQTT NodeJS Application');
  Webserver.startServer();
  exec(`frontail --port ${config.settings.gui.logs} --disable-usage-stats output.log`, () => {
    // output is running
  });
};
run();
