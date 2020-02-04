#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { argv } = require('yargs')
  .usage('Usage: $0 <command> [options]')
  .command('convert', 'Convert HEX file to BIN')
  .example('$0 convert -f foo.hex', 'convert file')
  .alias('f', 'file')
  .nargs('f', 1)
  .describe('f', 'Load a file')
  .demandOption(['f'])
  .option('o', {
    alias: 'output',
    type: 'string',
    description: 'Output file',
  })
  .help('h')
  .alias('h', 'help');


fs.exists(argv.file, (exists) => {
  if (!exists) {
    console.error(`Error: File ${argv.file} doesn't exists`);
    process.exit();
  }
  fs.readFile(argv.file, 'utf8', (err, dataInput) => {
    if (err) {
      console.error(`Error: Read file issue ${err.message}`);
      process.exit();
    }
    const dataOutput = Buffer.from(dataInput);
    const fileOutput = argv.output ? argv.output : `${path.parse(argv.file).name}.bin`;
    fs.writeFile(fileOutput, dataOutput, { flag: 'w' }, (err1) => {
      if (err1) {
        console.error(`Could not write file ${fileOutput}. Error ${err1.message}`);
        process.exit();
      }
    });
  });
});
