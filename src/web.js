import _ from 'lodash';
import express from 'express';
import http from 'http';
import socket from 'socket.io';
import bodyParser from 'body-parser';
import request from 'request';
import sysinfo from 'systeminformation';

import broadlink from './broadlink';
import mqtt from './mqtt';
import config from './config';
import logger from './logger';
import { prepareAction, addToQueue } from './actions/base';
import { fileDelete, fileListStructure, fileSave } from './actions/files';
import { playCommand, queryTemperatureCommand } from './actions/play';

const isDocker = require('is-docker');

let recordAction;
// -------------------------------------
//             Webserver
// -------------------------------------
// Output a simple GUI to interact with
// Setup socket.io so we can talk back and forth

class WebserverClass {
  constructor() {
    this.host = isDocker() ? '0.0.0.0' : '127.0.0.1';
    logger.info(`Listen on ip ${this.host}`);
    if (isDocker() && (config.settings.gui.port !== 3000 || config.settings.gui.logs !== 3001)) {
      logger.error('Cant change gui or log ports on docker container');
    }
    const app = express();

    app.use(express.static('html'));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    this.server = http.createServer(app);

    this.io = socket.listen(this.server);
    this.configureSocket(this.io);
    this.configureBroadlink();
    this.configureMQTT();
    app.use('/api', this.configureRouter(express.Router()));
    this.checkIntervalDevices = null;
  }

  configureSocket(io) {
    // websocket actions
    this.io.on('connection', (socketClient) => {
      logger.debug('Web a client connected');
      // Send config
      this.io.emit('config', config.settings);
      this.io.emit('blocked', config.isRunningBlocked);
      // Send all devices we have
      _.each(broadlink.devicesInfo(), (device) => io.emit('device', device));
      // web client disconnects
      socketClient.on('disconnect', () => {
        logger.debug('Web a client disconnected');
      });
    });
  }

  configureMQTT() {
    mqtt.on('playCommand', (topic, message) => {
      prepareAction({ topic, message }).then(addToQueue).catch((err) => logger.error(`MQTT failed on message '${err}'`));
    });

    mqtt.on('playTemperature', () => {
      queryTemperatureCommand();
    });
  }

  configureRouter(router) {
    // Play an actual command, go thru MQTT to get saved state
    router.post('/play', (req, res) => {
      const { topic, message, device } = req.body;
      if (topic !== '' && message !== '') {
        prepareAction({
          topic, message, device, disableLog: true,
        }).then((data) => {
          // if running is blocked, make gui calls still possible
          if (config.isRunningBlocked) config.addItemToUnblockedQueue(data);
          // send to mqtt
          const t = device ? `${topic}:${device}` : topic;
          mqtt.publish(t, data.message, () => {
            logger.debug('Sent message to mqtt');
            res.json({ message: 'Message sent to MQTT' });
          });
        }).catch((e) => {
          res.statusCode = 400;
          return res.json({
            message: e.message,
            errors: [e.message],
          });
        });
      } else {
        res.statusCode = 400;
        return res.json({
          message: `Recording failed for ${req.body.topic}`,
          errors: ['POST JSON missing property topic and message'],
        });
      }
    });

    // Record IR Signal
    router.post('/record', (req, res) => {
      const {
        topic, message, device, type,
      } = req.body;
      logger.debug(`Start to record block rec: ${config.isRunningRecording}, block scan ${config.isRunningScan}`);
      if (config.isRunningRecording) {
        logger.error('Recording is already running.');
        res.statusCode = 500;
        return res.json({
          message: 'Recording is already running.',
        });
      }
      if (config.isRunningScan) {
        logger.error('Wait until scan is completed before recording.');
        res.statusCode = 500;
        return res.json({
          message: 'Wait until scan is completed before recording.',
        });
      }

      if (topic !== '' && message !== '' && device !== '' && type !== '') {
        logger.debug(`Start to record ${type}, action ${topic}`);
        recordAction(type, {
          message, topic, device,
        })
          .then(() => {
            logger.info('Record Completed');
            res.json({ message: `Recording completed for ${req.body.topic}`, success: true });
          })
          .catch((err) => {
            res.statusCode = 500;
            return res.json({
              message: `Recording failed for for ${req.body.topic}, please se log.`,
              errors: [`Failed ${err}`],
              err,
              success: false,
            });
          });
      } else {
        res.statusCode = 400;
        return res.json({
          errors: ['POST JSON missing property topic, message, type or device'],
        });
      }
    });

    router.get('/temperature', (req, res) => {
      queryTemperatureCommand().then(() => {
        res.json({ message: 'yes' });
      }).catch(() => {
        res.statusCode = 400;
        res.json({ message: 'Failed to request temperature.' });
      });
    });

    // Get all command files
    router.get('/files', (req, res) => {
      fileListStructure(config.commandsPath)
        .then((data) => {
          res.json(data);
        })
        .catch((err) => {
          logger.error('api:files:err', err);
          res.statusCode = 400;
          return res.json({
            errors: ['Error occured'],
            err,
          });
        });
    });

    // Delete specific file
    router.delete('/files', (req, res) => {
      logger.debug(`delete file ${req.body.file}`);
      fileDelete(req.body.file)
        .then(() => {
          logger.info(`file ${req.body.file} is deleted`);
          res.json({ success: true });
        })
        .catch((err) => {
          logger.error(`failed to delete file ${req.body.file}`, err);
          res.statusCode = 400;
          return res.json({
            errors: [err.message],
            err,
          });
        });
    });

    // Give list of devices
    router.get('/devices', (req, res) => {
      res.json(broadlink.devicesInfo());
    });

    // Clean device list and rescan
    router.get('/rescan', (req, res) => {
      logger.info('Clear current devicelist and rescan');
      if (config.isRunningScan) {
        res.json({ running: true });
      } else {
        const isRunning = broadlink.discoverDevices();
        res.json({ running: !isRunning });
      }
    });

    // Block play calls
    router.post('/block', (req, res) => {
      const block = JSON.parse(req.body.block.toLowerCase());
      logger.info(`Block play calls unless from GUI: ${block}`);
      config.setIsRunningBlocked(block);
      this.io.emit('blocked', config.isRunningBlocked);
      if (!block) config.clearUnblockedQueue();
      res.json({ happy: true });
    });

    // Get system information
    router.get('/info', (req, res) => {
      sysinfo.osInfo((os) => {
        delete os.serial;
        delete os.servicepack;
        delete os.hostname;
        sysinfo.versions((v) => {
          const versions = {
            git: v.git, node: v.node, npm: v.npm, v8: v.v8,
          };
          const o = { os, versions, config: config.settings };
          logger.info('System Information', o);
          res.json(o);
        });
      });
    });

    return router;
  }

  configureBroadlink() {
    // -------------------------------------
    //            Setup Broadlink
    // -------------------------------------

    // let someone know
    broadlink.on('scan', (progress) => {
      this.io.emit('deviceScan', progress);
    });

    // send mqtt
    broadlink.on('publish-mqtt', (topic, message) => {
      mqtt.publish(topic, message);
    });

    // internal temperature response
    broadlink.on('temperature', (device, temperature) => {
      this.io.emit('temperature', device, temperature);
    });

    // after a while this is triggered
    broadlink.on('discoverCompleted', (numOfDevice) => {
      logger.info(`Broadlink Discovery completed. Found ${numOfDevice} devices.`);
      this.io.emit('deviceScanComplete');
      if (numOfDevice === 0) {
        logger.error('Broadlink device is missing, try to restart the device!');
      } else {
        // Send all devices
        _.each(broadlink.devicesInfo(), (device) => this.io.emit('device', device));
      }

      // Trigger webhook
      const url = config.settings.webhooks.scanCompleted;
      if (!url) return;
      request.get(url, (error) => {
        if (error) {
          logger.error('Webhook sent error');
          return;
        }
        logger.info('Webhook sent successfully');
      });
    });

    // a broadlink device is found
    broadlink.on('device', (device) => {
      this.io.emit('device', device.host);
    });
  }

  // Play actions
  loopPlay() {
    playCommand().catch((err) => logger.warn(err));
  }

  emitRecord(type, label, progress) {
    this.io.emit('record', type, label, progress);
  }

  // server is live
  startServer() {
    this.server.listen(config.settings.gui.port, this.host, () => {
      logger.debug(`GUI Web listen on port ${config.settings.gui.port}`);
      // Start to find devices
      const isRunning = broadlink.discoverDevices();
      if (isRunning) {
        // let someone know
        this.io.emit('deviceScanEnable');
      }
      // loop actions
      setInterval(this.loopPlay, config.settings.queue.delay);
    });
    this.checkIntervalDevices = setInterval(() => this.broadlinkCheckForDevices(), 60000);
  }

  broadlinkCheckForDevices() {
    const devices = broadlink.devices();
    const numOfDevices = Object.keys(devices).length;
    logger.debug(`Check if we have any devices: ${numOfDevices} found.`);
    if (numOfDevices === 0) {
      logger.info('Try to find broadlink devices');
      const isRunning = broadlink.discoverDevices();
      if (isRunning) {
        // let someone know
        this.io.emit('deviceScanEnable');
      }
    } else {
      clearInterval(this.checkIntervalDevices);
    }
  }
}
const Webserver = new WebserverClass();

// learn ir
const deviceEnterLearningIR = (data) => new Promise((resolve) => {
  Webserver.emitRecord(data.type, 'Wait', 0);
  logger.debug('deviceEnterLearningIR');
  data.deviceModules[0].enterLearning();
  resolve(data);
});

// Stops ir
const deviceExitLearningIR = (data) => new Promise((resolve) => {
  Webserver.emitRecord(data.type, 'Wait', 0);
  logger.debug('deviceExitLearningIR');
  data.deviceModules[0].cancelLearn();
  resolve(data);
});

// rf sweep frq
const deviceEnterLearningRFSweep = (data) => new Promise((resolve) => {
  Webserver.emitRecord(data.type, 'Wait', 0);
  logger.debug('deviceEnterLearningRFSweep');
  data.deviceModules[0].enterRFSweep();
  resolve(data);
});
// enter rf learning
// const deviceEnterLearningRF = (data) => new Promise((resolve) => {
//   logger.debug('deviceEnterLearningRF');
//   data.deviceModules[0].enterLearning();
//   resolve(data);
// });
// stops rf
const deviceExitLearningRF = (data) => new Promise((resolve) => {
  Webserver.emitRecord(data.type, 'Wait', 0);
  logger.debug('deviceExitLearningRF');
  data.deviceModules[0].cancelLearn();
  resolve(data);
});

// Record a IR Signal
const recordIR = (data) => new Promise((resolve, reject) => {
  logger.debug(`record${data.type.toUpperCase()}: Press a button`);
  Webserver.emitRecord(data.type, 'Press a button', 0);
  let timeout = config.settings.recording.timeout.ir;
  const intervalSpeed = 1;
  const interval = setInterval(() => {
    const step = config.settings.recording.timeout.ir - timeout;
    const progress = (step / config.settings.recording.timeout.ir) * 100;
    if (step > 0) {
      Webserver.emitRecord(data.type, 'Press a button', progress);
    }
    logger.debug(`recordIR: Timeout in ${timeout}, step: ${step}, progress: ${progress}`);
    data.deviceModules[0].checkData();
    timeout -= intervalSpeed;
    if (timeout <= 0) {
      clearInterval(interval);
      logger.error('IR Timeout');
      reject(new Error('Record IR Timed out.'));
    }
  }, intervalSpeed * 1000);

  // IR signal received
  const callback = (dataRaw) => {
    clearInterval(interval);
    Webserver.emitRecord(data.type, 'Release');
    logger.debug('Broadlink IR RAW');
    data.deviceModules[0].removeListener('rawData', callback);
    data.signal = dataRaw;

    setTimeout(() => resolve(data), 1000);
  };
  data.deviceModules[0].on('rawData', callback);
});

// Record RF Signal (after a frequence is found)
const recordRFCode = (data) => new Promise((resolve, reject) => {
  logger.info('recordRFCode: Press RF button');
  setTimeout(() => {
    let timeout = config.settings.recording.timeout.rf;
    const intervalSpeed = 1;
    const interval = setInterval(() => {
      const step = config.settings.recording.timeout.rf - timeout;
      const progress = (step / config.settings.recording.timeout.rf) * 100;
      logger.debug(`recordRFCode: Timeout in ${timeout}, step: ${step}, progress: ${progress}`);
      if (step > 0) {
        Webserver.emitRecord('rf', 'Press RF button', progress);
      }
      data.deviceModules[0].checkData();
      timeout -= intervalSpeed;
      if (timeout <= 0) {
        clearInterval(interval);
        logger.error('RF Timeout');
        reject(new Error('Record RF Timed out.'));
      }
    }, intervalSpeed * 1000);

    // IR or RF signal found
    const callback = (dataRaw) => {
      logger.debug('Broadlink RF RAW');
      Webserver.emitRecord(data.type, 'Release');
      data.signal = dataRaw;
      clearInterval(interval);
      data.deviceModules[0].removeListener('rawData', callback);
      setTimeout(() => resolve(data), 1000);
    };
    data.deviceModules[0].on('rawData', callback);
  }, 3000);
});

// Record RF, scans for frequence
const recordRFFrequence = (data) => new Promise((resolve, reject) => {
  logger.info('recordRFFrequence: Hold RF button');
  let timeout = config.settings.recording.timeout.rf;
  const intervalSpeed = 1;
  const interval = setInterval(() => {
    const step = config.settings.recording.timeout.rf - timeout;
    const progress = (step / config.settings.recording.timeout.rf) * 100;
    if (step > 0) {
      Webserver.emitRecord('rf', 'Hold RF button', progress);
    }
    logger.debug(`recordRFFrequence: Timeout in ${timeout}, step: ${step}, progress: ${progress}`);
    data.deviceModules[0].checkRFData();
    timeout -= intervalSpeed;
    if (timeout <= 0) {
      clearInterval(interval);
      return reject(new Error('Record RF Frequency timed out'));
    }
  }, intervalSpeed * 1000);

  // RF Sweep found something
  const callback = (dataRaw) => {
    Webserver.emitRecord(data.type, 'Release');
    logger.debug('recordRFFrequence found data');
    clearInterval(interval);
    data.deviceModules[0].removeListener('rawRFData', callback);
    data.frq = dataRaw;

    setTimeout(() => resolve(data), 1000);
  };
  data.deviceModules[0].on('rawRFData', callback);
});

recordAction = (action, data) => {
  logger.debug(`Record ${action}`);

  Webserver.emitRecord('running');
  switch (action) {
    case 'ir':
      config.setIsRunningRecording(true);
      data.type = 'ir';
      return prepareAction(data)
        .then(deviceEnterLearningIR)
        .then(recordIR)
        .then(deviceExitLearningIR)
        .then(fileSave)
        .then(() => {
          config.setIsRunningRecording(false);
          Webserver.emitRecord('ir', 'exit');
          logger.info('done');
        })
        .catch((err) => {
          config.setIsRunningRecording(false);
          logger.error(`Error ${err}`);
          prepareAction(data)
            .then(deviceExitLearningIR)
            .then(() => {
              Webserver.emitRecord('ir', 'exit');
            });
        });

    case 'rf':
      config.setIsRunningRecording(true);
      data.type = 'rf';
      return prepareAction(data)
        .then(deviceEnterLearningRFSweep)
        .then(recordRFFrequence)
        .then(deviceEnterLearningIR)
        .then(recordRFCode)
        .then(deviceExitLearningIR)
        .then(fileSave)
        .then(() => {
          config.setIsRunningRecording(false);
          Webserver.emitRecord('rf', 'exit');
        })
        .catch((err) => {
          logger.error(`Error ${err}`);
          config.setIsRunningRecording(false);
          prepareAction(data)
            .then(deviceExitLearningRF)
            .then(() => {
              Webserver.emitRecord('rf', 'exit');
            });
          throw Error(err);
        });

    default:
      return new Promise((resolve, reject) => {
        reject(new Error(`Action ${action} doesn't exists`));
      });
  }
};

export default Webserver;
