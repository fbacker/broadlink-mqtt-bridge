// -------------------------------------
//      SETUP LOGGER with Winston
// -------------------------------------

import winston from 'winston';
import path from 'path';
import config from './config';

const logLevel = config.loglevel;
console.log(`LOGLEVEL: ${logLevel}`);

const logFormat = winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`);

export default winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.label({ label: path.basename(process.mainModule.filename) }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    // Format the metadata object
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
      format: winston.format.combine(
        config.isProduction ? winston.format.uncolorize() : winston.format.colorize(),
        logFormat,
      ),
    }),
  ],
});
