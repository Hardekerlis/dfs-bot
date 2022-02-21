require('dotenv').config();

const { logger } = require('./utils/logger.js');

const redis = require('redis');
const client = redis.createClient();

if (process.env.LOCAL_DEV === 'true') {
  logger.info(
    'Application is in dev mode. Using test address and test key for wallet',
  );
  const wallets = require('../wallets.json');

  process.env.walletAddress = Object.keys(wallets.addresses)[0];
  process.env.privateKey = wallets.private_keys[process.env.walletAddress];
  process.env.rpcUrl = 'http://127.0.0.1:7545';
} else {
  process.env.walletAddress = process.env.WALLET_ADDRESS;
  process.env.privateKey = process.env.PRIVATE_KEY;
  process.env.rpcUrl = process.env.RPC_URL;
}

// const Web3 = require('web3');
// const HDWalletProvider = require('@truffle/hdwallet-provider');
//
// const web3 = new Web3(
//   new HDWalletProvider(
//     global.privateKey,
//     // 'https://bsc.getblock.io/mainnet/?api_key=2377bd74-b3e4-4c78-906b-ec3afb870ac8',
//     global.rpcUrl,
//   ),
// );

const WorkerFactory = require('./lib/workerFactory.js');

const start = async () => {
  logger.info('Starting application ...');
  logger.debug('Connecting to redis');
  await client.connect();
  logger.debug('Connected to redis');

  if (process.env.LOCAL_DEV === 'true') {
    logger.warn('Application is in dev mode');
    logger.warn('Flushing redis');
    // await client.flushDb();
    logger.debug('Flushed redis');
  }
  logger.debug('Initializing worker factory');
  const workerFactory = new WorkerFactory();

  logger.info('Creating data writer worker');
  const dataWriterWorker = workerFactory.create(
    './src/workers/dataWriterWorker.js',
  );
  logger.debug('Created data handler worker');

  logger.info('Initializing worker');
  await dataWriterWorker.init();
  logger.debug('Worker is running ...');

  logger.info('Creating data handler worker');
  const dataHandlerWorker = workerFactory.create(
    './src/workers/dataHandlerWorker.js',
  );
  logger.debug('Created data handler worker');

  logger.info('Initializing worker');
  await dataHandlerWorker.init();
  dataHandlerWorker.send('start', dataWriterWorker.id);
  logger.debug('Worker is running ...');

  logger.info('Creating crawler worker');
  const crawlerWorker = workerFactory.create('./src/workers/crawler.js');
  logger.debug('Created crawler worker');

  logger.info('Initializing worker');
  await crawlerWorker.init();
  await crawlerWorker.send('start');
  logger.debug('Worker is running ...');

  logger.info('Creating trade worker');
  const tradeWorker = workerFactory.create('./src/workers/tradeWorker.js');
  logger.debug('Created trade worker');

  logger.info('Initializing worker');
  await tradeWorker.init();
  await tradeWorker.send('start');
  logger.debug('Worker is running ...');

  // logger.info('Creating activePairsUpdaterLB worker');
  // const activePairsUpdaterLB = workerFactory.create(
  //   './src/workers/activePairsUpdaterLB.js',
  // );
  // logger.debug('Created activePairsUpdaterLB worker');
  //
  // logger.info('Creating activePairsUpdater worker');
  // const activePairsUpdater = [
  //   workerFactory.create('./src/workers/activePairsUpdater.js'),
  //   workerFactory.create('./src/workers/activePairsUpdater.js'),
  // ];
  // logger.debug('Created activePairsUpdater worker');
  //
  // logger.info('Initializing activePairsUpdater worker');
  // await activePairsUpdater[0].init();
  // await activePairsUpdater[0].send('start', activePairsUpdaterLB.id);
  //
  // await activePairsUpdater[1].init();
  // await activePairsUpdater[1].send('start', activePairsUpdaterLB.id);
  // logger.debug('activePairsUpdater Worker is running ...');
  //
  // // Has to be started after the updater
  // logger.info('Initializing activePairsUpdaterLB worker');
  // // await activePairsUpdaterLB.init();
  // // logger.error('INITLIZEd');
  //
  // logger.error('Sending start to LB');
  // await activePairsUpdaterLB.send('start');
  // logger.debug('activePairsUpdaterLB Worker is running ...');
};

start();
