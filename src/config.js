import configLoader from 'config';
import path from 'path';


class Config {
  constructor(settings) {
    this.settings = settings;
    this.settings.version = '2.1.4';
    this.commandsPath = settings.recording.path || path.join(__dirname, '../', 'commands');
    this.isRunningRecording = false;
    this.isRunningScan = false;
    this.isRunningBlocked = false;
    this.queue = [];
    this.unblocked = [];
  }

  isPlayBlocked() {
    return (
      this.isRunningRecording || this.isRunningScan || this.isRunningBlocked
    );
  }

  setIsRunningRecording(isRunning) {
    this.isRunningRecording = isRunning;
  }

  setIsRunningScan(isRunning) {
    this.isRunningScan = isRunning;
  }

  setIsRunningBlocked(blocked) {
    this.isRunningBlocked = blocked;
  }

  clearQueue() {
    this.queue = [];
  }

  clearUnblockedQueue() {
    this.unblocked = [];
  }

  addItemToQue(item) {
    this.queue.push(item);
  }

  addItemToUnblockedQueue(item) {
    this.unblocked.push(item.hash);
  }
}
export default new Config(configLoader.util.toObject());
