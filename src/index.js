require('dotenv').config();

const { logger } = require('./utils/logger.js');

const redis = require('redis');
const client = redis.createClient();

if (process.env.LOCAL_DEV === 'true') {
  logger.info(
    'Application is in dev mode. Using test address and test key for wallet',
  );
  const wallets = require('../wallets.json');

  global.walletAddress = Object.keys(wallets.addresses)[0];
  global.privateKey = wallets.private_keys[global.walletAddress];
  global.rpcUrl = 'http://127.0.0.1:7545';
} else {
  global.walletAddress = process.env.WALLET_ADDRESS;
  global.privateKey = process.env.PRIVATE_KEY;
  global.rpcUrl = process.env.RPC_URL;
}

const getPairs = require('./getPairs.js');

const start = async () => {
  const pairs = await getPairs();
};

start();
