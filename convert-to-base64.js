#!/usr/bin/env node
import config from './src/config';
import { fileListStructure, checkCommandFilesFlatten } from './src/actions/files';

const fs = require('fs');
const path = require('path');

console.log('Will create base64 files of all existing commands.');

const loadfiles = (folderPath) => new Promise((resolve) => {
  console.log('');
  fileListStructure(folderPath).then((result) => {
    if (!result.children) {
      console.error('Missing commands folder. Please create a folder called "commands" and restart service.');
      return;
    }
    if (result.children.length === 0) {
      console.error('Missing commands', result);
      return;
    }
    const flattened = checkCommandFilesFlatten([], result);
    console.info(`Found ${flattened.length} commands in folder`);
    resolve(flattened);
  }).catch((err) => {
    console.error('not happy', err);
  });
});

const convertContent = (content) => {
  // const data = Buffer.from(content);
  const base64data = content.toString('base64');
  return base64data;
};

const convertFile = (from, to) => {
  console.log(`  - Convert ${from} to ${to}`);
  from = path.join(config.commandsPath, from);
  to = path.join(config.commandsPath, to);
  fs.readFile(from, (err, dataInput) => {
    if (err) {
      console.error(`Error: Read file issue ${err.message}`);
      return;
    }
    const dataOutput = convertContent(dataInput);
    fs.writeFile(to, dataOutput, { flag: 'w', encoding: 'utf8' }, (err1) => {
      if (err1) {
        console.error(`Could not write file ${to}. Error ${err1.message}`);
      }
    });
  });
};

loadfiles(config.commandsPath).then((list) => {
  list.forEach((element) => {
    if (element.type === 'file' && element.text !== '.DS_Store') {
      const item = path.parse(element.path);
      const newfilename = path.join(item.dir, `${item.name}.txt`);
      convertFile(element.path, newfilename);
    }
  });

  console.log('');
  console.log('Completed, we are done');
});
