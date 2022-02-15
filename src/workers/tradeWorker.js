const { parentPort } = require('worker_threads');
const redis = require('redis');
const client = redis.createClient();

const Interface = new (require('../lib/workerInterface.js'))(parentPort);
const sleep = require('../lib/sleep.js');

const { logger } = require('../utils/logger.js');
const getRoute = require('../utils/dfs.js');

const doTrade = async (route, tradeAmt) => {};

const listen = async () => {
  await client.connect();

  let startTrading = false;

  while (true) {
    if (!startTrading) {
      logger.info('Trading worker is sleeping for 2000 ms');

      await sleep(2000);
    }
    const activePoolsLength = await client.lLen('activePools');

    if (activePoolsLength >= 50) {
      startTrading = true;
      const firstIndex = Math.floor(Math.random() * (activePoolsLength - 50));
      const lastIndex = firstIndex + 49;

      const routeToScan = await client.lRange(
        'activePools',
        0,
        activePoolsLength,
      );

      const route = await getRoute(routeToScan);
      console.log(route);
      await sleep(5000);
    }
  }
};

listen();

Interface.initialized();
