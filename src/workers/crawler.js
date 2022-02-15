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

// const sushiAbis = require('../abis/sushi.json');
// const sushiAddresses = require('../addresses/sushi.json');
//
// const sushi = {
//   factory: new web3.eth.Contract(sushiAbis.factory, sushiAddresses.factory),
//   router: new web3.eth.Contract(sushiAbis.router, sushiAddresses.router),
// };

const poolDataTemplate = {
  address: '0x123jdhjahsdyasyd',
  reserve0: '45678214',
  reserve1: '897867867',
  token0: {
    decmial: '18',
    address: '0x23dasdhadjkas',
    symbol: 'MYTOK',
  },
  token1: {
    decmial: '18',
    address: '0x23dasdhadjkas',
    symbol: 'MYTOK',
  },
};

const ibep20Abi = require('../../abis/IBEP20.json');

let workersPool;
let usedWorkers = [];

const workerLoadBalancer = (index) => {
  const randNum = Math.floor(Math.random() * workersPool.length);
  const workerId = workersPool[randNum];
  workersPool.splice(randNum, 1);
  usedWorkers.push(workerId);

  Interface.broadcastTo('dataHandlers', 'newPair', {
    index,
    workerId: workerId,
  });

  if (workersPool.length === 0) {
    workersPool = usedWorkers;
    usedWorkers = [];
  }
};

const start = async () => {
  workersPool = await Interface.getWorkersInRoom('dataHandlers');

  const pancakeFactory = pancake.factory.methods;
  const amountOfPairs = process.env.LOCAL_DEV
    ? 2000
    : await pancakeFactory.allPairsLength().call();

  await client.connect();

  let lastPoolIndex = parseInt(await client.get('lastPoolIndex'));
  if (isNaN(lastPoolIndex)) lastPoolIndex = 0;

  for (let i = lastPoolIndex; i < amountOfPairs; i++) {
    logger.info('Downloading new pair');
    const poolData = {
      token0: {},
      token1: {},
      address: await pancakeFactory.allPairs(i).call(),
    };

    const poolContract = new web3.eth.Contract(
      pancakeAbis.pair,
      poolData.address,
    );

    const reserves = await poolContract.methods.getReserves().call();

    poolData.reserve0 = reserves[0];
    poolData.reserve1 = reserves[1];

    poolData.token0.address = await poolContract.methods.token0().call();
    poolData.token1.address = await poolContract.methods.token1().call();

    const token0Contract = new web3.eth.Contract(
      ibep20Abi.abi,
      poolData.token0.address,
    );
    const token1Contract = new web3.eth.Contract(
      ibep20Abi.abi,
      poolData.token1.address,
    );
    poolData.token0.symbol = await token0Contract.methods.symbol().call();
    poolData.token0.decimals = await token0Contract.methods.decimals().call();

    poolData.token1.symbol = await token1Contract.methods.symbol().call();
    poolData.token1.decimals = await token1Contract.methods.decimals().call();

    const symbols = `${poolData.token0.symbol} / ${poolData.token1.symbol}`;

    const parsedData = JSON.stringify(poolData);
    await client.set(i, parsedData);
    await client.incr('poolCount');
    logger.info(`Downloaded pair ${symbols}`);
    await workerLoadBalancer(i);

    logger.info(`Finished with ${((i / amountOfPairs) * 100).toPrecision(4)}%`);
    await client.set('lastPoolIndex', i);
  }

  await client.disconnect();
};

Interface.on('start', () => {
  start();
});

Interface.initialized();
