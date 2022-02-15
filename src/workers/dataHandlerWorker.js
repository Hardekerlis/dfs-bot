require('dotenv').config();

const { parentPort } = require('worker_threads');
const redis = require('redis');
const client = redis.createClient();

const Interface = new (require('../lib/workerInterface.js'))(parentPort);
const { logger } = require('../utils/logger.js');

let indexes = [];
let working = false;
let dataWriterWorker;

const reservedPool = '0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE';

Interface.on('newPair', async ({ data }) => {
  if (data.workerId === Interface.id) {
    indexes.push(data.index);
    if (!working) await handlePair();
  }
});

const handlePair = async () => {
  working = true;
  await client.connect();

  while (working) {
    const index = indexes.shift();

    logger.debug('Handling data');

    logger.debug('Fetching data to handle from DB');
    const poolData = JSON.parse(await client.get(index));
    // let activePools = await client.get('activePools');
    //
    // logger.debug('Parsing data');
    // if (activePools) {
    //   activePools = JSON.parse(activePools);
    // } else {
    //   activePools = [];
    // }

    const symbols = `${poolData.token0.symbol} / ${poolData.token1.symbol}`;

    if (poolData.reserve0.length < 20 || poolData.reserve1.length < 20) {
      logger.info(`Insufficient liquidity for ${symbols}`);
    } else if (poolData.address.toLowerCase() === reservedPool.toLowerCase()) {
      logger.info('This pool is reserved for flashloans');
    } else {
      Interface.sendTo(dataWriterWorker, 'newData', poolData);
    }

    if (indexes.length === 0) working = false;
  }

  await client.disconnect();
  logger.debug(`Data handler worker ${Interface.id} has nothing to do`);
};

Interface.on('start', (workerId) => {
  dataWriterWorker = workerId;
});

(async () => {
  await Interface.addRoom('dataHandlers');
  Interface.initialized();
})();
