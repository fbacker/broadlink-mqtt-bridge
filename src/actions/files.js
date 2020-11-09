import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import md5 from 'md5';
import md5File from 'md5-file';
import logger from '../logger';
import config from '../config';

const fileDelete = (filePath) => new Promise((resolve, reject) => {
  const fullPath = path.join(config.commandsPath, filePath);
  logger.info(`delete file  ${fullPath}`);

  fs.unlink(fullPath, (err) => {
    if (err) {
      logger.error('Failed to delete file', { err });
      return reject(new Error('Stopped at deleteFile'));
    }
    return resolve({});
  });
});

// Save action
const fileSave = (data) => new Promise((resolve, reject) => {
  logger.info(`Save data to file topic ${data.topic}, file: ${data.filePath}`);
  shell.mkdir('-p', data.folderPath);
  const converted = data.signal.toString('base64');
  fs.writeFile(`${data.filePath}.txt`, converted, { flag: 'w', encoding: 'utf8' }, (err) => {
    if (err) {
      reject(new Error('Failed to create file'));
      return;
    }
    resolve(data);
  });
});

// Load action
const fileLoad = (pathToFile) => new Promise((resolve, reject) => {
  logger.debug(`Load command from ${pathToFile}`);
  fs.readFile(`${pathToFile}.txt`, 'utf8', (err, data) => {
    if (err) {
      logger.warn(`Didn't find file ${pathToFile}, try to load old version`);

      fs.readFile(`${pathToFile}.bin`, (err1, dataBuffer) => {
        if (err1) {
          reject(new Error(`Failed to load file ${pathToFile}`));
        }
        resolve(dataBuffer);
      });
      return;
    }
    const buff = Buffer.from(data, 'base64');
    resolve(buff);
  });
});

/* eslint-disable no-shadow, consistent-return */
const fileListStructure = (dir) => {
  const walk = (entry) => new Promise((resolve) => {
    fs.exists(entry, (exists) => {
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
                  let icon = null;
                  switch (path.extname(entry)) {
                    case '.txt':
                      icon = 'fas fa-bolt';
                      break;
                    case '.bin':
                      icon = 'fas fa-exclamation';
                      break;
                    default:
                      break;
                  }
                  md5File(entry).then((hash) => {
                    const shortName = entry.substring(config.commandsPath.length + 1);
                    resolve({
                      path: shortName,
                      type: 'file',
                      text: path.parse(entry).name, // path.basename(entry),
                      ext: path.extname(entry),
                      time: stats.mtime,
                      size: stats.size,
                      id: md5(shortName),
                      hash,
                      icon,
                    });
                  }).catch((err1) => reject(err1));
                }),
              );
              /*
                return resolve({
                  path: entry,
                  type: "file",
                  text: path.basename(entry),
                  time: stats.mtime,
                  size: stats.size,
                  id: md5(entry),
                  icon: path.extname(entry) === ".txt" ? "fas fa-bolt" : null
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
                    files.map((child) => walk(path.join(entry, child))),
                  )
                    .then((children) => {
                      const shortNameFolder = entry.substring(config.commandsPath.length + 1);
                      resolve({
                        path: shortNameFolder,
                        type: 'folder',
                        text: path.basename(entry),
                        time: stats.mtime,
                        children,
                        id: md5(shortNameFolder),
                      });
                    })
                    .catch((err) => {
                      reject(err);
                    });
                });
              }),
            );
          });
        }),
      );
    });
  });

  return walk(dir);
};

const checkCommandFilesFlatten = (arr, obj) => {
  if (!obj.children) {
    arr.push(obj);
    return arr;
  }
  obj.children.forEach((element) => checkCommandFilesFlatten(arr, element));
  return arr;
};

const checkCommandFiles = (folderPath) => {
  logger.debug(`Check command files ${folderPath}`);
  /*
  fs.stat(folderPath, (err) => {
    if (err) {
      logger.error(`Missing folder for command files at ${folderPath}`);
      throw new Error('Force shutdown, missing commands folder');
    }
  });
  */
  fileListStructure(folderPath).then((result) => {
    if (!result.children) {
      logger.error('Missing commands folder. Please create a folder called "commands" and restart service.');
      return;
    }
    if (result.children.length === 0) {
      logger.error('Missing commands', result);
      return;
    }
    const flattened = checkCommandFilesFlatten([], result);
    logger.info(`Found ${flattened.length} commands in folder`);
  }).catch((err) => {
    logger.error('not happy', err);
  });
};

export {
  checkCommandFiles, fileDelete, fileListStructure, fileSave, fileLoad, checkCommandFilesFlatten,
};
