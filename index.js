// If docker, config files are in another dir
console.log("env", process.env);

// Make the imports
const config = require("config");
const winston = require("winston");
const mqtt = require("mqtt");
const fs = require("fs");
const path = require("path");
const CircularJSON = require("circular-json");
var shell = require("shelljs");
const express = require("express");
const http = require("http");
const socket = require("socket.io");
const bodyParser = require("body-parser");
const broadlink = require("./device");

let cfg = config.util.toObject();

if (process.env.DOCKER && process.env.DOCKER === "true") {
  //  process.env["NODE_CONFIG_DIR"] = "/config";
  const cfgLocal = config.util.loadFileConfigs("/config");
  if (cfgLocal) {
    cfg = Object.assign({}, cfg, cfgLocal);
  }
}

var io = null;
const commandsPath = cfg.recording.path || path.join(__dirname, "commands");
console.log("commandsPath", commandsPath);
// -------------------------------------
//      SETUP LOGGER with Winston
// -------------------------------------

// Logger to be used in project
const logger = winston.createLogger({
  level: "debug",
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: "output.log" })]
});

// Output stream to socket.io
logger.stream({ start: -1 }).on("log", function(log) {
  if (io !== null) {
    io.emit("log", log);
  }
});

// try to make some pretty output
const alignedWithColorsAndTime = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.align(),
  winston.format.printf(info => {
    const { timestamp, level, message, ...args } = info;
    const ts = timestamp.slice(0, 19).replace("T", " ");
    return `${ts} [${level}]: ${message} ${
      Object.keys(args).length ? CircularJSON.stringify(args, null, 2) : ""
    }`;
  })
);
logger.add(
  new winston.transports.Console({
    format: alignedWithColorsAndTime
  })
);

logger.info("Starting Broadlink MQTT NodeJS Application");

// -------------------------------------
//         Setup MQTT and listen
// -------------------------------------
// Options settings to use, see IClientOptions in MQTT
// https://github.com/mqttjs/MQTT.js > Client Options
//
// If you want to listen to MQTT events listen to mqtt.subscribeBasePath/#
// E.g. broadlink/#

var mqttOptions = cfg.mqtt;
logger.info("MQTT Options", mqttOptions);

var mqttClient = mqtt.connect(
  "",
  mqttOptions
);
mqttClient.on("connect", function(connack) {
  logger.info("MQTT Connected", connack);
  // listen to actions
  mqttClient.subscribe(`${mqttOptions.subscribeBasePath}/#`, function(err) {
    if (err) {
      logger.error("MQTT Failed to Subscribe", err);
    }
  });
});
mqttClient.on("reconnect", function() {
  logger.info("MQTT Reconnected");
});
mqttClient.on("close", function() {
  logger.error("MQTT Closed");
});
mqttClient.on("offline", function() {
  logger.error("MQTT Offline");
});
mqttClient.on("error", function(err) {
  logger.error("MQTT Error", err);
});
mqttClient.on("message", function(topic, message) {
  // message is Buffer
  const msg = message.toString();
  logger.debug("MQTT Message", { topic, msg });
  runAction(msg, topic, "mqtt")
    .then(data => console.log("mqtt done", data))
    .catch(err => console.error("mqtt failed", err));
});

// -------------------------------------
//            Setup Broadlink
// -------------------------------------
let device;

// after a while this is triggered
broadlink.on("discoverCompleted", numOfDevice => {
  logger.info(`Broadlink Discovery completed. Found ${numOfDevice} items.`);
  if (numOfDevice === 0) {
    logger.error("Broadlink device is missing");
  }
});

// a broadlink device is found
broadlink.on("device", discoveredDevice => {
  device = discoveredDevice;
  logger.info("Broadlink Found Device", device.host);
  device.on("temperature", temperature =>
    logger.debug(`Broadlink Temperature ${temperature}`)
  );
  /*
  // IR or RF signal found
  device.on("rawData", data => {
    logger.debug("Broadlink RAW");
    //recordSave(data);
    //recordCancel();
  });
  // RF Sweep found something
  device.on("rawRFData", temp => {
    logger.debug("Broadlink RAW RF");
    recordMode = recordModeEnum.RecordRFSignal;
  });
  // Don't really know
  device.on("rawRFData2", temp => {
    logger.debug("Broadlink RAW 2");
    recordCancel();
  });
  */
});

// -------------------------------------
//             Webserver
// -------------------------------------
// Output a simple GUI to interact with
// Setup socket.io so we can talk back and forth

const app = express();
app.use(express.static("html"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// server is alive
var server = http.createServer(app);
server.listen(cfg.gui.port, () =>
  logger.info(`GUI Web listen on port ${cfg.gui.port}`)
);

// websocket actions
io = socket.listen(server);
io.on("connection", function(socket) {
  logger.info("Web a client connected");
  io.emit("config", cfg);
  socket.on("disconnect", function() {
    logger.info("Web a client disconnected");
  });
  socket.on("action", function(msg) {
    logger.info("Web User want action", msg);
    runAction(msg.action, msg.topic, "web")
      .then(data => console.log("web done", data))
      .catch(err => console.error("web failed", err));
  });
  socket.on("getActions", function() {
    logger.info("Loading saved actions");
    handleListAllActions()
      .then(files => {
        logger.info("Actions on disk", files);
        io.emit("actions", files);
      })
      .catch(err => logger.error("Failed to load " + err));
  });
});

// API
var router = express.Router();
router.post("/play", function(req, res) {
  if (req.body.topic && req.body.topic !== "") {
    runAction("play", req.body.topic, "api")
      .then(() => {
        console.log("api done");
        res.json({ message: "Sending message " + req.body.topic });
      })
      .catch(err => {
        console.error("api error", err);
        res.statusCode = 500;
        return res.json({
          errors: ["Failed " + err]
        });
      });
  } else {
    res.statusCode = 400;
    return res.json({
      errors: ["POST JSON missing property topic"]
    });
  }
});
router.post("/recordir", function(req, res) {
  if (req.body.topic && req.body.topic !== "") {
    runAction("recordir", req.body.topic, "api")
      .then(data => {
        console.log("api done", data);
        res.json({ message: "Sending message " + req.body.topic });
      })
      .catch(err => {
        console.error("api err", err);
        res.statusCode = 500;
        return res.json({
          errors: ["Failed " + err]
        });
      });
  } else {
    res.statusCode = 400;
    return res.json({
      errors: ["POST JSON missing property topic"]
    });
  }
});
router.post("/recordrf", function(req, res) {
  if (req.body.topic && req.body.topic !== "") {
    runAction("recordrf", req.body.topic, "api")
      .then(data => {
        console.log("api done", data);
        res.json({ message: "Sending message " + req.body.topic });
      })
      .catch(err => {
        console.error("api error", err);
        res.statusCode = 500;
        return res.json({
          errors: ["Failed " + err]
        });
      });
  } else {
    res.statusCode = 400;
    return res.json({
      errors: ["POST JSON missing property topic"]
    });
  }
});
app.use("/api", router);

// -------------------------------------
//         Application Actions
// -------------------------------------

let actionIsRunning = false;

function runAction(action, topic, origin) {
  action = action.toLowerCase();
  switch (action) {
    case "recordir":
      return prepareAction({ action, topic, origin })
        .then(deviceEnterLearningIR)
        .then(recordIR)
        .then(deviceExitLearningIR)
        .then(recordSave)
        .then(data => {
          console.log("done", data);
        })
        .catch(err => {
          console.log("error occured", err);
          deviceExitLearningIR();
        });
      break;
    case "recordrf":
      return prepareAction({ action, topic, origin })
        .then(deviceEnterLearningRFSweep)
        .then(recordRFFrequence)
        .then(deviceEnterLearningIR)
        .then(recordRFCode)
        .then(deviceExitLearningIR)
        .then(recordSave)
        .then(data => {
          console.log("done", data);
        })
        .catch(err => {
          console.log("error occured", err);
          deviceExitLearningRF();
        });
      break;
    case "play":
      return prepareAction({ action, topic, origin })
        .then(playAction)
        .then(mqttPublish);
      break;
    default:
      logger.error(`Action ${action} doesn't exists`);
      break;
  }
}

// Handle incoming actions from MQTT
const prepareAction = data =>
  new Promise((resolve, reject) => {
    logger.debug("prepareAction", data);
    if (data.topic.indexOf(mqttOptions.subscribeBasePath) === 0) {
      if (data.topic.split("/").length < 3) {
        logger.error(
          "Topic is to short, should contain broadcast base e.g. 'broadlink' with following device and action. e.g. broadlink/tv/samsung/power"
        );
        reject("Stopped prepareAction");
        return;
      }

      data.topic = data.topic.toLowerCase();
      data.action = data.action.toLowerCase();
      const actionPath = data.topic.substr(
        mqttOptions.subscribeBasePath.length + 1
      );
      const filePath = path.join(commandsPath, actionPath) + ".bin";
      const folderPath = filePath.substr(0, filePath.lastIndexOf("/"));
      data = Object.assign({}, data, {
        path: actionPath,
        folderPath,
        filePath
      });
      resolve(data);
    } else {
      logger.error("MQTT Message Failed with base path");
      reject("Stopped prepareAction");
    }
  });

// learn ir
const deviceEnterLearningIR = data =>
  new Promise((resolve, reject) => {
    logger.debug("deviceEnterLearningIR");
    device.enterLearning();
    resolve(data);
  });

// Stops ir
const deviceExitLearningIR = data =>
  new Promise((resolve, reject) => {
    logger.debug("deviceExitLearningIR");
    device.cancelLearn();
    resolve(data);
  });

// rf sweep frq
const deviceEnterLearningRFSweep = data =>
  new Promise((resolve, reject) => {
    logger.debug("deviceEnterLearningRFSweep");
    device.enterRFSweep();
    resolve(data);
  });
// enter rf learning
const deviceEnterLearningRF = data =>
  new Promise((resolve, reject) => {
    logger.debug("deviceEnterLearningRF");
    device.enterLearning();
    resolve(data);
  });
// stops rf
const deviceExitLearningRF = data =>
  new Promise((resolve, reject) => {
    logger.debug("deviceExitLearningRF");
    device.cancelLearn();
    resolve(data);
  });

// Save action
const recordSave = data =>
  new Promise((resolve, reject) => {
    logger.info("recordSave");
    logger.info(`Save data to file ${data.filePath}`);
    shell.mkdir("-p", data.folderPath);
    fs.writeFile(data.filePath, data.signal, { flag: "w" }, err => {
      if (err) {
        logger.error("Failed to create file", err);
        reject("Stopped at recordSave");
        return;
      }
      logger.info("File saved successfully");
      resolve(data);
    });
  });

// Record a IR Signal
const recordIR = data =>
  new Promise((resolve, reject) => {
    logger.info("recordIR: Press an IR signal");
    let timeout = cfg.recording.timeout.ir;
    let intervalSpeed = 1;
    let interval = setInterval(() => {
      logger.info("recordIR: Timeout in " + timeout);
      device.checkData();
      timeout -= intervalSpeed;
      if (timeout <= 0) {
        clearInterval(interval);
        logger.error("IR Timeout");
        reject("Stopped at recordIR");
      }
    }, intervalSpeed * 1000);

    // IR signal received
    const callback = dataRaw => {
      clearInterval(interval);
      logger.debug("Broadlink IR RAW");
      device.emitter.off("rawData", callback);
      data.signal = dataRaw;
      resolve(data);
    };
    device.on("rawData", callback);
  });

// Record RF Signal (after a frequence is found)
const recordRFCode = data =>
  new Promise((resolve, reject) => {
    logger.info("recordRFCode: Press RF button");
    setTimeout(() => {
      let timeout = cfg.recording.timeout.rf;
      let intervalSpeed = 1;
      let interval = setInterval(() => {
        logger.info("recordRFCode: Timeout in " + timeout);
        device.checkData();
        timeout -= intervalSpeed;
        if (timeout <= 0) {
          clearInterval(interval);
          logger.error("RF Timeout");
          reject("Stopped at recordRFCode");
        }
      }, intervalSpeed * 1000);

      // IR or RF signal found
      const callback = dataRaw => {
        logger.debug("Broadlink RF RAW");
        data.signal = dataRaw;
        clearInterval(interval);
        device.emitter.off("rawData", callback);
        resolve(data);
      };
      device.on("rawData", callback);
    }, 3000);
  });

// Record RF, scans for frequence
const recordRFFrequence = data =>
  new Promise((resolve, reject) => {
    logger.info("recordRFFrequence: Hold and RF button");
    let timeout = cfg.recording.timeout.rf;
    let intervalSpeed = 1;
    let interval = setInterval(() => {
      logger.info("recordRFFrequence: Timeout in " + timeout);
      device.checkRFData();
      timeout -= intervalSpeed;
      if (timeout <= 0) {
        clearInterval(interval);
        logger.error("RF Sweep Timeout");
        reject("Stopped at recordRFFrequence");
      }
    }, intervalSpeed * 1000);

    // RF Sweep found something
    const callback = dataRaw => {
      clearInterval(interval);
      device.emitter.off("rawRFData", callback);
      data.frq = dataRaw;
      resolve(data);
    };
    device.on("rawRFData", callback);
  });

const playAction = data =>
  new Promise((resolve, reject) => {
    logger.info("playAction");
    fs.readFile(data.filePath, (err, fileData) => {
      if (err) {
        logger.error("Failed to read file", { err });
        reject("Stopped at playAction");
        return;
      } else {
        device.sendData(fileData, false);
        resolve(data);
      }
    });
  });

const handleListAllActions = data =>
  new Promise((resolve, reject) => {
    var files = [];
    shell.ls("commands/**/*.bin").forEach(function(file) {
      const topic = file.substring(0, file.length - 4);
      files.push(topic);
    });
    files.sort();
    resolve(files);
  });

const mqttPublish = data =>
  new Promise((resolve, reject) => {
    if (data.origin !== "mqtt") {
      //@TODO implement
      //logger.info("broadcast action, how to");
      //mqttClient.publish()
    }
    resolve(data);
  });
