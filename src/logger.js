// -------------------------------------
//      SETUP LOGGER with Winston
// -------------------------------------

import _ from 'lodash';
import winston from 'winston';
import config from './config';

const { format, transports } = winston;
const alignedWithColorsAndTime = format.combine(
  format.colorize(),
  format.timestamp(),
  format.align(),
  format.printf((info) => {
    const {
      timestamp, level, message, ...args
    } = info;
    const ts = timestamp.slice(0, 19).replace('T', ' ');
    // Lets find print variables that are not functions
    const argo = {};
    _.forEach(args, (value, key) => {
      if (typeof value !== 'function') {
        argo[key] = value;
      }
    });
    return `${ts} [${level}]: ${message} ${
      Object.keys(argo).length ? `\n${JSON.stringify(argo, null, 2)}` : ''
    }`;
  }),
);
let logLevel = config.settings.logging.level;
if (!logLevel) {
  logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}
console.log(`LOGLEVEL: ${logLevel}`);
export default winston.createLogger({
  level: logLevel,
  format: alignedWithColorsAndTime,
  transports: [
    new transports.File({
      filename: 'output.log',
      tailable: true,
      maxsize: 2000000,
      maxFiles: 1,
    }),
    new transports.Console(),
  ],
});
