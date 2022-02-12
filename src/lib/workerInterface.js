class WorkerInterface {
  constructor(port, id, workerFactory) {
    this.port = port;
    this.listeners = {};
    this.rooms = [];
    this.port.on('message', (args) => {
      const [id, data] = args;
      if (this.listeners.hasOwnProperty(id)) {
        this.listeners[id](data);
      }
    });
    this.id = id;
    this.factory = workerFactory;

    this.on('__doBroadcast__', (data) => {
      this.broadcast(data.id, data.data);
    });

    this.on('__setWorkerId__', (data) => {
      this.id = data.id;
      this.send('__workerIdSet__');
    });

    this.on('__sendToSpecificWorker__', (data) => {
      this.sendTo(data.toId, data.id, data.data);
    });

    this.on('__doToBroadcast__', (data) => {
      this.broadcastTo(data.to, data.id, data.data);
    });

    this.on('__addRoom__', (name) => {
      this.rooms.push(name);
      this.send('__roomAdded__');
    });

    this.on('__getWorkersInRoom__', (name) => {
      const workers = this.factory.getWorkersInRoom(name);
      this.send('__gotWorkersInRoom__', workers);
    });
  }

  async addRoom(name) {
    this.rooms.push(name);

    await new Promise((resolve) => {
      this.send('__addRoom__', name);
      this.on('__roomAdded__', () => {
        resolve();
      });
    });
  }

  initialized() {
    this.send('__workerInitialized__');
  }

  async getWorkersInRoom(name) {
    return await new Promise((resolve) => {
      this.send('__getWorkersInRoom__', name);
      this.on('__gotWorkersInRoom__', (data) => {
        resolve(data);
      });
    });
  }

  async init() {
    await new Promise((resolve, reject) => {
      this.on('__workerInitialized__', (data) => {
        resolve();
      });
    });
  }

  sendTo(toId, id, data) {
    if (this.factory === undefined) {
      //this.port = parentPort
      this.send('__sendToSpecificWorker__', {
        id,
        data,
        toId,
      });
      return;
    }

    this.factory.sendTo(toId, id, data, this.id);
  }

  on(id, cb) {
    this.listeners[id] = cb;
  }
  send(id, data) {
    this.port.postMessage([id, data]);
  }

  broadcastTo(to, id, data) {
    if (this.factory === undefined) {
      this.send('__doToBroadcast__', {
        to,
        id,
        data,
      });

      return;
    }

    this.factory.broadcastTo(to, id, data);
  }

  broadcast(id, data) {
    if (this.factory === undefined) {
      //this.port = parentPort
      this.send('__doBroadcast__', {
        id,
        data,
      });
      return;
    }

    this.factory.broadcast(this.id, id, data);
  }
}
module.exports = WorkerInterface;
