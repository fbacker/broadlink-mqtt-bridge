import configLoader from 'config';
import path from 'path';


class Config {
  constructor(settings) {
    this.settings = settings;
    this.commandsPath = settings.recording.path || path.join(__dirname, '../', 'commands');
    this.isRunningRecording = false;
    this.queue = [];
  }

  setIsRunningRecording(isRunning) {
    this.isRunningRecording = isRunning;
  }

  clearQueue() {
    this.queue = [];
  }

  addItemToQue(item) {
    this.queue.push(item);
  }
}
export default new Config(configLoader.util.toObject());
