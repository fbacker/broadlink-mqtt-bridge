import logger from './logger';
import config from './config';
import broadlink from './broadlink';
import { files } from './actions/files';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

//import bodyParser from 'body-parser';

logger.info('Starting Application');

const app = express();
app.use(cors());

//app.use(express.static('html'));

const server = http.createServer(app);

//app.use('/api', this.configureRouter(express.Router()));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
app.get('/api/files', (req, res) => {
  files()
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

// Give list of devices
app.get('/api/devices', (req, res) => {
  res.json(broadlink.devicesInformation());
});

// Clean device list and rescan
app.get('/api/scan', (req, res) => {
  if (broadlink.isScanning()) {
    //@TODO emit progress?
    logger.warn('Scanning is already running');
    return res.json({ started: false });
  }

  logger.info('Clear current devicelist and rescan');
  broadlink.discoverDevices();
  return res.json({ started: true });
});

broadlink.on('device', (device) => {
  logger.debug(`device here`);
});
broadlink.on('scan', (progress) => {
  logger.debug(`scanning ${progress}`);
});
broadlink.on('discoverCompleted', (numOfDevicesFound) => {
  logger.debug(`finished scan found:  ${numOfDevicesFound}`);
});

const io = new Server(server);
io.on('connection', (socketClient) => {
  logger.debug('Web a client connected');
  // Send config
  //this.io.emit('config', config.settings);
  //this.io.emit('blocked', config.isRunningBlocked);
  // Send all devices we have
  //_.each(broadlink.devicesInfo(), (device) => io.emit('device', device));
  // web client disconnects
  socketClient.on('disconnect', () => {
    logger.debug('Web a client disconnected');
  });
});

server.listen(config.port, () => {
  logger.info(`listening on *:${config.port}`);
});
