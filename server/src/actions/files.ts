import fs from 'fs';
import path from 'path';
import md5 from 'md5';
import logger from '../logger';
import config from '../config';

const files = () => {
  const walk = (entry: string) =>
    new Promise((resolveWalk, rejectWalk) => {
      try {
        const stats = fs.lstatSync(entry);

        // Work folder items
        if (stats.isDirectory()) {
          resolveWalk(
            new Promise((resolveFolder, rejectFolder) => {
              fs.readdir(entry, (err, files) => {
                if (err) {
                  return rejectFolder(err);
                }
                Promise.all(files.map((child) => walk(path.join(entry, child))))
                  .then((children) => {
                    const shortNameFolder = entry.substring(config.recording_path_absolute.length + 1);
                    resolveFolder({
                      path: shortNameFolder,
                      type: 'folder',
                      text: path.basename(entry),
                      time: stats.mtime,
                      children,
                      id: md5(shortNameFolder),
                    });
                  })
                  .catch((err) => {
                    rejectFolder(err);
                  });
              });
            }),
          );
        } else {
          return resolveWalk(
            new Promise((resolveFile) => {
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

              const shortName = entry.substring(config.recording_path_absolute.length + 1);
              resolveFile({
                path: shortName,
                type: 'file',
                text: path.parse(entry).name, // path.basename(entry),
                ext: path.extname(entry),
                time: stats.mtime,
                size: stats.size,
                id: md5(shortName),
                icon,
              });
            }),
          );
        }
      } catch {
        rejectWalk(new Error('Failed to load files'));
      }
    });
  return walk(config.recording_path_absolute);
};

const fileDelete = (filePath: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const fullPath = path.join(config.recording_path_absolute, filePath);
    logger.info(`delete file  ${fullPath}`);

    fs.unlink(fullPath, (err) => {
      if (err) {
        logger.error('Failed to delete file', { err });
        return reject(new Error('Unable to delete file'));
      }
      return resolve();
    });
  });
/*
// Save action
const fileSave = (data) =>
  new Promise((resolve, reject) => {
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
const fileLoad = (pathToFile) =>
  new Promise((resolve, reject) => {
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
  
  //fs.stat(folderPath, (err) => {
//    if (err) {
      //logger.error(`Missing folder for command files at ${folderPath}`);
      //throw new Error('Force shutdown, missing commands folder');
    //}
  //});
  
  fileListStructure(folderPath)
    .then((result) => {
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
    })
    .catch((err) => {
      logger.error('not happy', err);
    });
};

export { checkCommandFiles, fileDelete, fileListStructure, fileSave, fileLoad, checkCommandFilesFlatten };
*/
export { files, fileDelete };
