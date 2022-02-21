require('dotenv').config();

const { parentPort } = require('worker_threads');

const Interface = new (require('../lib/workerInterface.js'))(parentPort);
const { logger } = require('../utils/logger.js');

const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');

const web3 = new Web3(
  new HDWalletProvider(process.env.privateKey, process.env.rpcUrl),
);

const redis = require('redis');
const client = redis.createClient();

const pancakeAbis = require('../../abis/pancake.json');
const pancakeAddresses = require('../../addresses/pancake.json');

const pancake = {
  factory: new web3.eth.Contract(pancakeAbis.factory, pancakeAddresses.factory),
  router: new web3.eth.Contract(pancakeAbis.router, pancakeAddresses.router),
};

let working = false;
let pools = [];
let parentWorker;

Interface.on('start', (workerId) => {
  parentWorker = workerId;
});

Interface.on('queuePair', async ({ data }) => {
  logger.debug('activePairsUpdater got a new pair');
  if (data.workerId === Interface.id) {
    pools.push(data.pool);
    if (!working) await handlePool();
  }
});

const handlePool = async () => {
  logger.info('Updating pools');
  working = true;
  await client.connect();

  while (working) {
    try {
      const pool = pools.shift();
      const pairContract = new web3.eth.Contract(
        pancakeAbis.pair,
        pool.address,
      );

      logger.info(
        `Updating reserves for pair ${pool.token0.symbol} / ${pool.token1.symbol}`,
      );

      const reserves = await pairContract.methods.getReserves().call();

      await client.lRem('activePools', 5, JSON.stringify(pool));

      pool.reserve0 = reserves[0];
      pool.reserve1 = reserves[1];

      await client.lPush('activePools', JSON.stringify(pool));
      if (pools.length === 0) working = false;
    } catch (err) {
      console.error(err);
    }
  }

  Interface.sendTo(parentWorker, 'finished');
  await client.disconnect();
};

(async () => {
  await Interface.addRoom('activePairsUpdaters');
  Interface.initialized();
})();
