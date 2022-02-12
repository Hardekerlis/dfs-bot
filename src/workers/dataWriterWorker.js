require('dotenv').config();

const { parentPort } = require('worker_threads');
const redis = require('redis');
const client = redis.createClient();

const Interface = new (require('../lib/workerInterface.js'))(parentPort);
const { logger } = require('../utils/logger.js');

let queue = [];
let running = false;

Interface.on('newData', ({ data }) => {
  queue.push(data);
  // console.log(data);
  if (!running) start();
});

const start = async () => {
  running = true;
  await client.connect();

  setTimeout(async () => {
    const poolsToProcess = queue;
    queue = [];

    for (const pool of poolsToProcess) {
      await client.lPush('activePools', JSON.stringify(pool));
    }

    if (queue.length !== 0) {
      start();
    } else stop = false;
  }, 3000);
};

Interface.initialized();
