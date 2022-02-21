require('dotenv').config();

const { parentPort } = require('worker_threads');

const Interface = new (require('../lib/workerInterface.js'))(parentPort);
const { logger } = require('../utils/logger.js');

const redis = require('redis');
const client = redis.createClient();

let workersPool;
let workersPoolLength;
let usedWorkers = [];

const workerLoadBalancer = async (pool) => {
  const randNum = Math.floor(Math.random() * workersPool.length);
  const workerId = workersPool[randNum];
  workersPool.splice(randNum, 1);
  usedWorkers.push(workerId);

  Interface.broadcastTo('activePairsUpdaters', 'queuePair', {
    pool,
    workerId: workerId,
  });

  if (workersPool.length === 0) {
    workersPool = usedWorkers;
    usedWorkers = [];
  }
};

const start = async () => {
  logger.info('Looping through all active pools to queue them for update');
  await client.connect();
  const activePoolsLength = await client.lLen('activePools');
  const rawActivePools = await client.lRange(
    'activePools',
    0,
    activePoolsLength,
  );

  for (const rawPool of rawActivePools) {
    const pool = JSON.parse(rawPool);

    await workerLoadBalancer(pool);
  }

  workersPool = await Interface.getWorkersInRoom('activePairsUpdaters');

  logger.info(
    'Queued all pools for update. Waiting for update workers to finish',
  );
  await client.disconnect();
};

Interface.on('start', async () => {
  logger.error('Starting');
  workersPool = await Interface.getWorkersInRoom('activePairsUpdaters');
  workersPoolLength = workersPool.length;
  start();
});

let finishedWorkers = 0;
Interface.on('finished', () => {
  finishedWorkers++;

  if (finishedWorkers === workersPoolLength) {
    finishedWorkers = 0;
    start();
  }
});

Interface.initialized();
