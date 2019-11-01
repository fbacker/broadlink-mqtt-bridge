
import _ from 'lodash';
import express from 'express';
import http from 'http';
import socket from 'socket.io';
import bodyParser from 'body-parser';
import broadlink from './broadlink';
import mqtt from './mqtt';
import config from './config';
import logger from './logger';
import { prepareAction, addToQueue } from './actions/base';
import { fileDelete, fileListStructure, fileSave } from './actions/files';
import { playCommand } from './actions/play';

let recordAction;
// -------------------------------------
//             Webserver
// -------------------------------------
// Output a simple GUI to interact with
// Setup socket.io so we can talk back and forth

class WebserverClass {
  constructor() {
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
  }

  configureSocket(io) {
    // websocket actions
    this.io.on('connection', (socketClient) => {
      logger.debug('Web a client connected');
      // Send config
      this.io.emit('config', config.settings);
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
  }

  configureRouter(router) {
    // Play an actual command, go thru MQTT to get saved state
    router.post('/play', (req, res) => {
      const { topic, message } = req.body;
      if (topic !== '' && message !== '') {
        mqtt.publish(topic, message, () => res.json());
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
      if (topic !== '' && message !== '' && device !== '' && type !== '') {
        logger.debug(`Start to record ${type}, action ${topic}`);
        recordAction(type, {
          message, topic, device,
        })
          .then(() => {
            logger.info('Record Completed');
            res.json({ message: `Recording completed for ${req.body.topic}` });
          })
          .catch((err) => {
            res.statusCode = 500;
            return res.json({
              message: `Recording failed for for ${req.body.topic}`,
              errors: [`Failed ${err}`],
              err,
            });
          });
      } else {
        res.statusCode = 400;
        return res.json({
          errors: ['POST JSON missing property topic, message, type or device'],
        });
      }
    });

    // Get all command files
    router.get('/files', (req, res) => {
      fileListStructure('./commands')
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
            errors: ['Error occured'],
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
      broadlink.discoverDevices();
      res.json();
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
    });

    // a broadlink device is found
    broadlink.on('device', (device) => {
      this.io.emit('device', device.host);
    });
  }

  // Play actions
  loopPlay() {
    playCommand().catch((err) => logger.error(err));
  }

  emitRecord(type, label, progress) {
    this.io.emit('record', type, label, progress);
  }

  // server is live
  startServer() {
    this.server.listen(config.settings.gui.port, () => {
      logger.debug(`GUI Web listen on port ${config.settings.gui.port}`);
      // Start to find devices
      broadlink.discoverDevices();
      // let someone know
      this.io.emit('deviceScanEnable');
      // loop actions
      setInterval(this.loopPlay, 250);
    });
  }
}
const Webserver = new WebserverClass();


// learn ir
const deviceEnterLearningIR = (data) => new Promise((resolve) => {
  Webserver.emitRecord(data.type, '', 0);
  logger.debug('deviceEnterLearningIR');
  data.deviceModule.enterLearning();
  resolve(data);
});

// Stops ir
const deviceExitLearningIR = (data) => new Promise((resolve) => {
  logger.debug('deviceExitLearningIR');
  data.deviceModule.cancelLearn();
  resolve(data);
});

// rf sweep frq
const deviceEnterLearningRFSweep = (data) => new Promise((resolve) => {
  Webserver.emitRecord('rf', '', 0);
  logger.debug('deviceEnterLearningRFSweep');
  data.deviceModule.enterRFSweep();
  resolve(data);
});
// enter rf learning
// const deviceEnterLearningRF = (data) => new Promise((resolve) => {
//   logger.debug('deviceEnterLearningRF');
//   data.deviceModule.enterLearning();
//   resolve(data);
// });
// stops rf
const deviceExitLearningRF = (data) => new Promise((resolve) => {
  logger.debug('deviceExitLearningRF');
  data.deviceModule.cancelLearn();
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
    Webserver.emitRecord(data.type, 'Press a button', progress);
    logger.debug(`record: Timeout in ${timeout}`);
    data.deviceModule.checkData();
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
    data.deviceModule.removeListener('rawData', callback);
    data.signal = dataRaw;

    setTimeout(() => resolve(data), 1000);
  };
  data.deviceModule.on('rawData', callback);
});

// Record RF Signal (after a frequence is found)
const recordRFCode = (data) => new Promise((resolve, reject) => {
  logger.info('recordRFCode: Press RF button');
  setTimeout(() => {
    let timeout = config.settings.recording.timeout.rf;
    const intervalSpeed = 1;
    const interval = setInterval(() => {
    //   logger.info(`recordRFCode: Timeout in ${timeout}`);
      const step = config.settings.recording.timeout.rf - timeout;
      const progress = (step / config.settings.recording.timeout.rf) * 100;
      Webserver.emitRecord('rf', 'Press RF button', progress);
      data.deviceModule.checkData();
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
      data.deviceModule.removeListener('rawData', callback);
      setTimeout(() => resolve(data), 1000);
    };
    data.deviceModule.on('rawData', callback);
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
    Webserver.emitRecord('rf', 'Hold RF button', progress);
    logger.debug(`recordRFFrequence: Timeout in ${timeout}`);
    data.deviceModule.checkRFData();
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
    data.deviceModule.removeListener('rawRFData', callback);
    data.frq = dataRaw;

    setTimeout(() => resolve(data), 1000);
  };
  data.deviceModule.on('rawRFData', callback);
});


recordAction = (action, data) => {
  if (config.isRunningRecording) {
    logger.error('Already recording');
    Webserver.emitRecord('running');
    return;
  }
  logger.debug(`Record ${action}`);
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
          logger.error(`Error ${err}`);
          prepareAction(data)
            .then(deviceExitLearningIR)
            .then(() => {
              config.setIsRunningRecording(false);
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
          prepareAction(data)
            .then(deviceExitLearningRF)
            .then(() => {
              config.setIsRunningRecording(false);
              Webserver.emitRecord('rf', 'exit');
            });
          throw Error(err);
        });


      // case 'temperature':
      //   return prepareAction(data).then(queryTemperature);
    default:
      return new Promise((resolve, reject) => {
        reject(new Error(`Action ${action} doesn't exists`));
      });
  }
};

export default Webserver;
