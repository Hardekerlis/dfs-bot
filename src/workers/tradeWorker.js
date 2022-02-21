const { parentPort } = require('worker_threads');
const redis = require('redis');
const client = redis.createClient();
const BN = require('bn.js');

const Interface = new (require('../lib/workerInterface.js'))(parentPort);
const sleep = require('../lib/sleep.js');

const { logger } = require('../utils/logger.js');
const getRoute = require('../utils/dfs.js');

const PriceRoute = require('../lib/getPriceFromRoute.js');

const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');

const web3 = new Web3(
  new HDWalletProvider(process.env.privateKey, process.env.rpcUrl),
);

const pancakeAbis = require('../../abis/pancake.json');
const pancakeAddresses = require('../../addresses/pancake.json');

const pancake = {
  factory: new web3.eth.Contract(pancakeAbis.factory, pancakeAddresses.factory),
  router: new web3.eth.Contract(pancakeAbis.router, pancakeAddresses.router),
};

const validateRoute = async (route, optimalAmt) => {
  if (optimalAmt === 0) return { profitable: false };

  let precision = 18;
  const doNum = (num) => {
    if (precision <= 0) {
      return -1;
    }
    num = parseFloat(num).toPrecision(precision);
    try {
      return new BN(web3.utils.toWei(num + ''));
    } catch (err) {
      precision--;
      doNum(num);
    }
  };

  let amt = doNum(optimalAmt.toString());

  logger.debug(`AMT: ${amt}`);

  if (amt === -1 || !amt) {
    logger.error('amt from getOptimalInput() was faulty. returning...');
    logger.error(`amt: ${amt}`);
    return {
      error: true,
    };
  }

  const gasPrice = await web3.eth.getGasPrice();

  const newRoute = new PriceRoute(
    route,
    amt,
    [pancake.router],
    new BN(gasPrice),
  );
  newRoute.forceDex(0);
  const result = await newRoute.tryGetPrice(10);

  // const result = await getPriceFromRoute(
  //   route,
  //   amt,
  //   [pancake.router],
  //   new BN(gasPrice),
  //   [],
  // );

  return result;
};

const doTrade = async (route, tradeAmt) => {
  console.log(route, tradeAmt);
};

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

      const dfsResult = await getRoute(routeToScan);

      if (dfsResult.profitable) {
        // console.log(dfsResult);
        logger.debug('Trade is profitable');
        const result = await validateRoute(
          dfsResult.route,
          dfsResult.optimalAmt,
        );

        // if (!result.error && result.profitable) {
        if (!result.error) {
          // DO TRADE
          await doTrade(result.path, result.quoteIn);
        }
      } else {
        logger.debug('Trade is not profitable. Re-running dfs');
      }

      // TODO: Do trade
      await sleep(100);
    }
  }
};

listen();

Interface.initialized();
