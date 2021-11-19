// -------------------------------------
//      Read Environment Variables
// -------------------------------------

import dotenv from 'dotenv';
import fs from 'fs';

const envs = dotenv.config();
if (envs.error) {
  throw envs.error;
}
 
const isProduction = process.env.NODE_ENV === 'development' ? false : true;
const vars = Object.assign(envs.parsed, {
  loglevel: isProduction ? envs.parsed.loglevel : 'debug',
  isProduction,
  mqtt_port: parseInt(envs.parsed.mqtt_port),
  queue_delay: parseInt(envs.parsed.queue_delay),
  port: parseInt(envs.parsed.port),
  recording_timeout_ir: parseInt(envs.parsed.recording_timeout_ir),
  recording_timeout_rf: parseInt(envs.parsed.recording_timeout_rf),
  webhooks_scan_complete: envs.parsed.webhooks_scan_complete !== '' ? envs.parsed.webhooks_scan_complete : null,
});

// Validate mqtt path
if (vars.mqtt_subscribeBasePath.substr(-1) !== '/') throw new Error('mqtt_subscribeBasePath must end in /');

// Validate that commands exists
try {
  fs.statSync(vars.recording_path);
  vars.recording_path_absolute = fs.realpathSync(vars.recording_path);
} catch {
  throw new Error('recording_path is not a folder');
}

// Development mode, print all variables
if (!isProduction) console.log('Loaded variables', vars);

export default vars;
