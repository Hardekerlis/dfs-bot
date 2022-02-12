const WorkerInterface = require('./workerInterface.js');
const { nanoid } = require('nanoid');
const { Worker } = require('worker_threads');

class WorkerFactory {
  constructor() {
    this.workers = {};
  }

  getWorkersInRoom(name) {
    const workers = [];

    for (let _workerId in this.workers) {
      if (this.workers[_workerId].rooms.includes(name)) {
        workers.push(_workerId);
      }
    }

    return workers;
  }

  broadcast(workerId, id, data) {
    for (let _workerId in this.workers) {
      const worker = this.workers[_workerId];

      let _data = {
        data,
        fromId: workerId,
      };

      worker.send(id, _data);
    }
  }

  broadcastTo(to, id, data) {
    for (let _workerId in this.workers) {
      const worker = this.workers[_workerId];

      if (worker.rooms.includes(to)) {
        let _data = {
          data,
          fromId: _workerId,
        };

        worker.send(id, _data);
      }
    }
  }

  sendTo(toId, id, data, fromId) {
    if (!this.workers.hasOwnProperty(toId)) {
      console.log(`Trying to send id: ${id} to worker: ${toId}.`);
      console.log('But no such worker exists in this factory.');
      return;
    }

    this.workers[toId].send(id, {
      data: data,
      fromId,
      toId,
    });
  }

  create(path) {
    let id = 'worker_' + nanoid(8);

    let _worker = new WorkerInterface(new Worker(path), id, this);

    _worker.send('__setWorkerId__', { id });

    this.workers[id] = _worker;

    return this.workers[id];
  }

  async remove(worker) {
    let id = worker.id;

    await this.workers[id].port.terminate();

    delete this.workers[id];
  }

  async terminateAll() {
    for (let _workerId in this.workers) {
      const worker = this.workers[_workerId];
      await this.remove(worker);
    }
  }

  totalWorkers() {
    return Object.keys(this.workers).length;
  }
}

module.exports = WorkerFactory;
