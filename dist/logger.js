"use strict";
// -------------------------------------
//      SETUP LOGGER with Winston
// -------------------------------------
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const config_1 = __importDefault(require("./config"));
const logLevel = config_1.default.loglevel;
console.log(`LOGLEVEL: ${logLevel}`);
const enumerateErrorFormat = winston_1.default.format((info) => {
    if (info instanceof Error) {
        Object.assign(info, { message: info.stack });
    }
    return info;
});
exports.default = winston_1.default.createLogger({
    level: logLevel,
    format: winston_1.default.format.combine(enumerateErrorFormat(), config_1.default.isProduction ? winston_1.default.format.uncolorize() : winston_1.default.format.colorize(), winston_1.default.format.splat(), winston_1.default.format.printf(({ level, message }) => `${level}: ${message}`)),
    transports: [
        new winston_1.default.transports.Console({
            stderrLevels: ['error'],
        }),
    ],
});
//# sourceMappingURL=logger.js.map