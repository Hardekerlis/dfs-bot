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
    await client.flushDb();
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
};

start();
