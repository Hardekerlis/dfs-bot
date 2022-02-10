require('dotenv').config();
const { logger } = require('./utils/logger.js');
const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');

const redis = require('redis');
const client = redis.createClient();

const web3 = new Web3(new HDWalletProvider(global.privateKey, global.rpcUrl));

const pancakeAbis = require('../abis/pancake.json');
const pancakeAddresses = require('../addresses/pancake.json');

const pancake = {
  factory: new web3.eth.Contract(pancakeAbis.factory, pancakeAddresses.factory),
  router: new web3.eth.Contract(pancakeAbis.router, pancakeAddresses.router),
};

const sushiAbis = require('../abis/sushi.json');
const sushiAddresses = require('../addresses/sushi.json');

const sushi = {
  factory: new web3.eth.Contract(sushiAbis.factory, sushiAddresses.factory),
  router: new web3.eth.Contract(sushiAbis.router, sushiAddresses.router),
};

const ibep20Abi = require('../abis/IBEP20.json');

const sleep = async (ms) => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

// const foundTokens = new Set();
// const routes = [];

const BN = require('bn.js');

const allPairs = new Set();

const getPairs = async () => {
  await client.connect();

  logger.info('Gettings pairs');

  let pairsLength = 4; // await pancake.factory.methods.allPairsLength().call();

  const pairs = [];

  let prevIndex = parseInt(await client.get('prevIndex'));
  if (isNaN(prevIndex)) prevIndex = 0;

  for (let i = prevIndex; i <= pairsLength; i++) {
    const pairAddr = await pancake.factory.methods.allPairs(i).call();
    const pairContract = new web3.eth.Contract(pancakeAbis.pair, pairAddr);
    const tokens = {
      0: {
        contract: new web3.eth.Contract(
          ibep20Abi.abi,
          await pairContract.methods.token0().call(),
        ),
        symbol: async function () {
          return await this.contract.methods.symbol().call();
        },
      },
      1: {
        contract: new web3.eth.Contract(
          ibep20Abi.abi,
          await pairContract.methods.token1().call(),
        ),
        symbol: async function () {
          return await this.contract.methods.symbol().call();
        },
      },
    };

    const token0Addr = tokens[0].contract._address;
    const token1Addr = tokens[1].contract._address;
    const reserves = await pairContract.methods.getReserves().call();

    // console.log(reserves);

    // ONLY FOR DEV
    // Change back to above for live
    // const token0Addr = await tokens[0].symbol();
    // const token1Addr = await tokens[1].symbol();

    // logger.debug(`Pair address: ${pairAddr}`);

    logger.info(
      `Found pair ${await tokens[0].symbol()}/${await tokens[1].symbol()}`,
    );

    if (reserves[0].length < 20 || reserves[1].length < 20) {
      logger.debug('Pair has insufficient liquidity');
      continue;
    } else {
      logger.debug('Pair has sufficient liquidity');
    }

    logger.info(`${((i + 1) / pairsLength) * 100}% crawled`);

    // console.log(
    //   web3.utils.fromWei(reserves[0]),
    //   web3.utils.fromWei(reserves[1]),
    //   82,
    // );

    // console.log(reserves[0].length, reserves[1].length, 82);
    //
    // console.log(
    //   await pancake.router.methods
    //     .getAmountsOut(web3.utils.toWei('10'), [token0Addr, token1Addr])
    //     .call(),
    // );

    await client.sAdd('tokens', token0Addr);
    await client.sAdd('tokens', token1Addr);

    pairs.push([token0Addr, token1Addr]);
    await client.set('routes', JSON.stringify(pairs));
    // await client.hSet('routes', token0Addr, token1Addr);
    // console.log(token0Addr, token1Addr);

    await client.hSet(
      'addresses',
      tokens[0].contract._address,
      await tokens[0].symbol(),
    );
    await client.hSet(
      'addresses',
      tokens[1].contract._address,
      await tokens[1].symbol(),
    );

    const pair = {
      pairAddress: pairAddr,
      reserve0: reserves[0],
      reserve1: reserves[1],
      token0: {
        decimal: await tokens[0].contract.methods.decimals().call(),
        address: tokens[0].contract._address,
        name: await tokens[0].contract.methods.name().call(),
        symbol: await tokens[0].contract.methods.symbol().call(),
      },
      token1: {
        decimal: await tokens[1].contract.methods.decimals().call(),
        address: tokens[1].contract._address,
        name: await tokens[1].contract.methods.name().call(),
        symbol: await tokens[1].contract.methods.symbol().call(),
      },
    };

    allPairs.add(pair);

    await client.set('prevIndex', i);
  }

  await client.set('allPairs', JSON.stringify(Array.from(allPairs)));

  // console.log(foundTokens);
  // console.log(routes);
  //
  // const adjecencyList = new Map();
  //
  // const addNode = (token) => {
  //   adjecencyList.set(token, []);
  // };
  //
  // const addEdge = (origin, destination) => {
  //   adjecencyList.get(origin).push(destination);
  //   adjecencyList.get(destination).push(origin);
  // };
  //
  // foundTokens.forEach(addNode);
  // routes.forEach((route) => addEdge(...route));
  //
  // console.log(adjecencyList);
  //
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
  //
  // // await bfs('DAI');
  //
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
  //
  // dfs('SURF');

  logger.debug('Finished fetching all pairs');

  return { success: true };
};

module.exports = getPairs;
