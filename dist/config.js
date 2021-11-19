"use strict";
// -------------------------------------
//      Read Environment Variables
// -------------------------------------
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const envs = dotenv_1.default.config();
if (envs.error) {
    throw envs.error;
}
const isProduction = process.env.NODE_ENV === 'development' ? false : true;
const vars = Object.assign(envs.parsed, {
    isProduction,
    mqtt_port: parseInt(envs.parsed.mqtt_port),
    queue_delay: parseInt(envs.parsed.queue_delay),
    port: parseInt(envs.parsed.port),
    recording_timeout_ir: parseInt(envs.parsed.recording_timeout_ir),
    recording_timeout_rf: parseInt(envs.parsed.recording_timeout_rf),
    webhooks_scan_complete: envs.parsed.webhooks_scan_complete !== '' ? envs.parsed.webhooks_scan_complete : null,
});
// Validate mqtt path
if (vars.mqtt_subscribeBasePath.substr(-1) !== '/')
    throw new Error('mqtt_subscribeBasePath must end in /');
// Validate that commands exists
try {
    fs_1.default.statSync(vars.recording_path);
    vars.recording_path_absolute = fs_1.default.realpathSync(vars.recording_path);
}
catch (_a) {
    throw new Error('recording_path is not a folder');
}
if (!isProduction)
    console.log('Loaded variables', vars);
exports.default = vars;
//# sourceMappingURL=config.js.map