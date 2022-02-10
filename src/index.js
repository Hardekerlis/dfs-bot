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
const getRoute = require('./getRoute.js');

const start = async () => {
  await client.connect();

  // if (process.env.LOCAL_DEV === 'true') await client.flushDb();
  // const { success } = await getPairs();
  //
  // if (!success) throw new Error('Fetching pairs failed');

  const data = await getRoute();

  console.log('Route:', data.route);
  console.log(`Profit: ${data.profit}`);

  if (data.profit > 0) {
    logger.info('EXECUTE TRADE');
  }

  // const bfs = async (start) => {
  //   const visited = new Set();
  //
  //   const queue = [start];
  //
  //   while (queue.length > 0) {
  //     const airport = queue.shift();
  //
  //     const destinations = adjecencyList.get(airport);
  //
  //     for (const destination of destinations) {
  //       // queue.push(destination);
  //
  //       if (destination === 'WBNB') {
  //         console.log('Found it');
  //       }
  //
  //       if (!visited.has(destination)) {
  //         visited.add(destination);
  //         queue.push(destination);
  //         console.log(destination);
  //       }
  //       // await sleep(1000);
  //     }
  //   }
  // };

  // await bfs('DAI');

  // let stop = false;
  // // Depth first search
  // const dfs = (start, visited = new Set()) => {
  //   if (stop) return;
  //   console.log(start);
  //
  //   visited.add(start);
  //
  //   const destinations = adjecencyList.get(start);
  //
  //   for (const destination of destinations) {
  //     if (destination === 'WBNB') {
  //       console.log('DFS found WBNB in steps');
  //       stop = true;
  //       return;
  //     }
  //
  //     if (!visited.has(destination)) {
  //       dfs(destination, visited);
  //     }
  //   }
  // };

  // dfs('FNX');
};

start();
