import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import md5 from 'md5';
import md5File from 'md5-file';
import logger from '../logger';
import config from '../config';

const fileDelete = (filePath) => new Promise((resolve, reject) => {
  logger.info(`delete file  ${filePath}`);

  if (filePath.substr(0, config.commandsPath.length) === config.commandsPath) {
    fs.unlink(filePath, (err) => {
      if (err) {
        logger.error('Failed to delete file', { err });
        return reject(new Error('Stopped at deleteFile'));
      }
      return resolve({});
    });
  } else {
    return reject(new Error(`Trying to delete a faulty path '${filePath}'`));
  }
});

// Save action
const fileSave = (data) => new Promise((resolve, reject) => {
  logger.info(`Save data to file topic ${data.topic}, file: ${data.filePath}`);
  shell.mkdir('-p', data.folderPath);
  fs.writeFile(data.filePath, data.signal, { flag: 'w' }, (err) => {
    if (err) {
      reject(new Error('Failed to create file'));
      return;
    }
    resolve(data);
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
                  md5File(entry, (err, hash) => {
                    if (err) {
                      return reject(err);
                    }
                    resolve({
                      path: entry,
                      type: 'file',
                      text: path.basename(entry),
                      time: stats.mtime,
                      size: stats.size,
                      id: md5(entry),
                      hash,
                      icon:
                          path.extname(entry) === '.bin' ? 'fas fa-bolt' : null,
                    });
                  });
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
                    files.map((child) => walk(path.join(entry, child))),
                  )
                    .then((children) => {
                      resolve({
                        path: entry,
                        type: 'folder',
                        text: path.basename(entry),
                        time: stats.mtime,
                        children,
                        id: md5(entry),
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
  fs.stat(folderPath, (err) => {
    if (err) {
      logger.error(`Missing folder for command files at ${folderPath}`);
      throw new Error('Force shutdown, missing commands folder');
    }
    fileListStructure(folderPath).then((result) => {
      if (result.children.length === 0) {
        logger.error('Missing commands', result);
        return;
      }
      const flattened = checkCommandFilesFlatten([], result);
      logger.info(`Found ${flattened.length} commands in folder`);
    });
  });
};

export {
  checkCommandFiles, fileDelete, fileListStructure, fileSave,
};
