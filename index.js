// If docker, config files are in another dir

// Make the imports
const config = require("config");
const winston = require("winston");
const mqtt = require("mqtt");
const fs = require("fs");
const path = require("path");
const CircularJSON = require("circular-json");
const shell = require("shelljs");
const express = require("express");
const http = require("http");
const socket = require("socket.io");
const bodyParser = require("body-parser");
const md5 = require("md5");
const md5File = require("md5-file");
const { broadlink, discoverDevices } = require("./device");

let cfg = config.util.toObject();
let devices = [];

if (process.env.DOCKER && process.env.DOCKER === "true") {
  //  process.env["NODE_CONFIG_DIR"] = "/config";
  const cfgLocal = config.util.loadFileConfigs("/config");
  if (cfgLocal) {
    cfg = Object.assign({}, cfg, cfgLocal);
  }
}

var io = null;
const commandsPath = cfg.recording.path || path.join(__dirname, "commands");

// -------------------------------------
//      SETUP LOGGER with Winston
// -------------------------------------

// Logger to be used in project
const logger = winston.createLogger({
  level: "debug",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: "output.log",
      tailable: true,
      maxsize: 2000000,
      maxFiles: 1
    })
    //new winston.transports.Http({ path: "log", port:3001 })
  ]
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

var mqttClient = mqtt.connect("", mqttOptions);
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
    .catch(err => console.error("mqtt failed on message", err));
});

// -------------------------------------
//            Setup Broadlink
// -------------------------------------

// after a while this is triggered
broadlink.on("discoverCompleted", numOfDevice => {
  logger.info(`Broadlink Discovery completed. Found ${numOfDevice} items.`);
  if (numOfDevice === 0) {
    logger.error("Broadlink device is missing");
  }
});

// a broadlink device is found
broadlink.on("device", discoveredDevice => {
  console.log("new device", discoverDevices);
  devices.push(discoveredDevice);
  logger.info("Broadlink Found Device", discoveredDevice.host);
  discoveredDevice.on("temperature", temperature =>
    {
      logger.debug(`Broadlink Temperature ${temperature}`, discoveredDevice.host);
      try {
        mqttClient.publish(`${mqttOptions.subscribeBasePath}/${discoveredDevice.host.id}/temperature`, temperature.toString());  
      } catch (error) {
        logger.error("Temperature publish error", error);
      }
      
    }
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
io.on("connection", socket => {
  logger.info("Web a client connected");
  io.emit("config", cfg);
  socket.on("disconnect", () => {
    logger.info("Web a client disconnected");
  });
  socket.on("action", msg => {
    logger.info("Web User want action", msg);
    runAction(msg.action, msg.topic, "web")
      .then(data => logger.log("web done", data))
      .catch(err => logger.error("web failed", err));
  });
  socket.on("getActions", () => {
    logger.info("Loading saved actions");
    handleListAllActions()
      .then(files => {
        logger.info("Actions on disk", files);
        io.emit("actions", files);
      })
      .catch(err => logger.error("Failed to load " + err));
  });
  socket.on("getDevices", () => {
    logger.info("Loading Connected devices");
    getDevicesInfo()
      .then(devs => {
        logger.info("Connected devices", devs);
        io.emit("devices", devs);
      })
      .catch(err => logger.error("Failed to load " + err));
  });
  socket.on("rescanDevices", () => {
    logger.info("Rescan devices");
    devices = [];
    discoverDevices();
  });
});

// API
var router = express.Router();
router.post("/play", function(req, res) {
  if (req.body.topic && req.body.topic !== "") {
    let action = "play";
    if (req.body.id) {
      action += "-" + req.body.id;
    }
    runAction(action, req.body.topic, "api")
      .then(() => {
        console.log("api done");
        res.json({ message: "Sending message " + req.body.topic });
      })
      .catch(err => {
        logger.error("api play error", err);
        res.statusCode = 500;
        return res.json({
          errors: ["Failed " + err],
          err
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
    let action = "recordir";
    if (req.body.id) {
      action += "-" + req.body.id;
    }
    runAction(action, req.body.topic, "api")
      .then(data => {
        console.log("api done", data);
        res.json({ message: "Sending message " + req.body.topic });
      })
      .catch(err => {
        logger.error("api recordir error", err);
        res.statusCode = 500;
        return res.json({
          errors: ["Failed " + err],
          err
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
    let action = "recordrf";
    if (req.body.id) {
      action += "-" + req.body.id;
    }
    runAction(action, req.body.topic, "api")
      .then(data => {
        console.log("api done", data);
        res.json({ message: "Sending message " + req.body.topic });
      })
      .catch(err => {
        logger.error("api recordrf error", err);
        res.statusCode = 500;
        return res.json({
          errors: ["Failed " + err],
          err
        });
      });
  } else {
    res.statusCode = 400;
    return res.json({
      errors: ["POST JSON missing property topic"]
    });
  }
});
router.get("/files", function(req, res) {
  listFilestructure("./commands")
    .then(data => {
      console.log("files", data);
      res.json(data);
    })
    .catch(err => {
      console.error("api:files:err", err);
      res.statusCode = 400;
      return res.json({
        errors: ["Error occured"],
        err
      });
    });
});
router.delete("/files", function(req, res) {
  console.log("delete", req.body.file);
  deleteFile(req.body.file)
    .then(obj => {
      console.log("file is removed");
      res.json({ success: true });
    })
    .catch(err => {
      console.error("api:files:delete:err", err);
      res.statusCode = 400;
      return res.json({
        errors: ["Error occured"],
        err
      });
    });
});
router.get("/devices", function(req, res) {
  getDevicesInfo()
    .then(devs => {
      res.json(devs);
    })
    .catch(err => {
      res.statusCode = 400;
      return res.json({
        errors: ["Error occured"],
        err
      });
    });
});
router.get("/devices/discover", function(req, res) {
  logger.info("Rescan devices");
  devices = [];
  discoverDevices();
  res.json({ success: true });
});
app.use("/api", router);

// -------------------------------------
//         Application Actions
// -------------------------------------

let actionIsRunning = false;

function runAction(action, topic, origin) {
  action = action.toLowerCase();
  let actionMode = action;
  if (actionMode.indexOf("-") !== -1)
    actionMode = action.substring(0, action.indexOf("-"));
  switch (actionMode) {
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
          prepareAction({ action, topic, origin }).then(deviceExitLearningIR);
        });
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
          prepareAction({ action, topic, origin }).then(deviceExitLearningRF);
        });
    case "play":
      return prepareAction({ action, topic, origin })
        .then(playAction)
        .then(mqttPublish);
    case "temperature":
      return prepareAction({ action, topic, origin })
        .then(queryTemperature)
    default:
      logger.error(`Action ${action} doesn't exists`);
      return handleActionError(`Action ${action} doesn't exists`);
      break;
  }
}
// Properly handle invalid action input to runAction
const handleActionError = data =>
  new Promise((resolve, reject) => {
    resolve(data);
  });

// Handle incoming actions from MQTT
const prepareAction = data =>
  new Promise((resolve, reject) => {
    logger.debug("prepareAction", data);
    if (data.topic.indexOf(mqttOptions.subscribeBasePath) === 0) {
      if (data.topic.split("/").length < 3) {
        logger.error(
          "Topic is too short, should contain broadcast base e.g. 'broadlink' with following device and action. e.g. broadlink/tv/samsung/power"
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

      // find device to use
      let device;
      if (devices.length === 0) {
        return reject("No devices");
      } else if (data.action.indexOf("-") !== -1) {
        // we want to select specific device
        const deviceId = data.action.substring(data.action.indexOf("-") + 1);
        for (let i = 0; i < devices.length; i++) {
          if (devices[i].host.id === deviceId) {
            device = devices[i];
            break;
          }
        }
        if (!device) return reject("Requested device not found");
      } else if (devices.length > 1) {
        return reject("Multiple devices exists. Please specify one to use.");
      } else {
        device = devices[0];
      }

      data = Object.assign({}, data, {
        path: actionPath,
        folderPath,
        filePath,
        device
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
    data.device.enterLearning();
    resolve(data);
  });

// Stops ir
const deviceExitLearningIR = data =>
  new Promise((resolve, reject) => {
    logger.debug("deviceExitLearningIR");
    data.device.cancelLearn();
    resolve(data);
  });

// rf sweep frq
const deviceEnterLearningRFSweep = data =>
  new Promise((resolve, reject) => {
    logger.debug("deviceEnterLearningRFSweep");
    data.device.enterRFSweep();
    resolve(data);
  });
// enter rf learning
const deviceEnterLearningRF = data =>
  new Promise((resolve, reject) => {
    logger.debug("deviceEnterLearningRF");
    data.device.enterLearning();
    resolve(data);
  });
// stops rf
const deviceExitLearningRF = data =>
  new Promise((resolve, reject) => {
    logger.debug("deviceExitLearningRF");
    data.device.cancelLearn();
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
      data.device.checkData();
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
      data.device.removeListener("rawData", callback);
      data.signal = dataRaw;
      resolve(data);
    };
    data.device.on("rawData", callback);
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
        data.device.checkData();
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
        data.device.removeListener("rawData", callback);
        resolve(data);
      };
      data.device.on("rawData", callback);
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
      data.device.checkRFData();
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
      data.device.removeListener("rawRFData", callback);
      data.frq = dataRaw;
      resolve(data);
    };
    data.device.on("rawRFData", callback);
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
        data.device.sendData(fileData, false);
        resolve(data);
      }
    });
  });

const queryTemperature = data =>
new Promise((resolve, reject) => {
  logger.info("queryTemperature");
  try {
    data.device.checkTemperature();
    resolve(data);
  } catch (error) {
    logger.error("Failed to query temperature");
    reject("Stopped at queryTemperature");
  }
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

// -------------- HELPERS --------------

const deleteFile = path =>
  new Promise((resolve, reject) => {
    logger.info(`delete file  ${path}`);
    fs.unlink(path, err => {
      if (err) {
        logger.error("Failed to delete file", { err });
        reject("Stopped at deleteFile");
        return;
      } else {
        resolve({});
      }
    });
  });

// Return json file structure
const listFilestructure = dir => {
  const walk = entry => {
    return new Promise((resolve, reject) => {
      fs.exists(entry, exists => {
        if (!exists) {
          return resolve({});
        }
        return resolve(
          new Promise((resolve, reject) => {
            fs.lstat(entry, (err, stats) => {
              if (err) {
                return reject(err);
              }
              if (!stats.isDirectory()) {
                return resolve(
                  new Promise((resolve, reject) => {
                    md5File(entry, (err, hash) => {
                      if (err) {
                        return reject(err);
                      }
                      resolve({
                        path: entry,
                        type: "file",
                        text: path.basename(entry),
                        time: stats.mtime,
                        size: stats.size,
                        id: md5(entry),
                        hash,
                        icon:
                          path.extname(entry) === ".bin" ? "fas fa-bolt" : null
                      });
                    });
                  })
                );
                /*
                return resolve({
                  path: entry,
                  type: "file",
                  text: path.basename(entry),
                  time: stats.mtime,
                  size: stats.size,
                  id: md5(entry),
                  icon: path.extname(entry) === ".bin" ? "fas fa-bolt" : null
                });
                */
              }
              resolve(
                new Promise((resolve, reject) => {
                  fs.readdir(entry, (err, files) => {
                    if (err) {
                      return reject(err);
                    }
                    Promise.all(
                      files.map(child => walk(path.join(entry, child)))
                    )
                      .then(children => {
                        resolve({
                          path: entry,
                          type: "folder",
                          text: path.basename(entry),
                          time: stats.mtime,
                          children,
                          id: md5(entry)
                        });
                      })
                      .catch(err => {
                        reject(err);
                      });
                  });
                })
              );
            });
          })
        );
      });
    });
  };

  return walk(dir);
};

const getDevicesInfo = () =>
  new Promise((resolve, reject) => {
    var devs = [];
    for (let i = 0; i < devices.length; i++) {
      devs.push(Object.assign({}, devices[i].host));
    }
    resolve(devs);
  });

discoverDevices();
