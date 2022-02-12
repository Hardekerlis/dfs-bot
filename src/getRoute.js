require('dotenv').config();
const { logger } = require('./utils/logger.js');
const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const BN = require('bn.js');

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

// const { getPriceFromRoute, setForcedDex } = require('./getPriceFromRoute.js');
const PriceRoute = require('./getPriceFromRoute.js');

const getData = async () => {
  const routes = JSON.parse(await client.get('routes'));

  const tokens = await client.sMembers('tokens');

  const allPairs = JSON.parse(await client.get('allPairs'));

  const addresses = await client.hGetAll('addresses');

  const adjecencyList = new Map();

  const addNode = (token) => {
    adjecencyList.set(token, []);
  };

  const addEdge = (origin, destination) => {
    adjecencyList.get(origin).push(destination);
    adjecencyList.get(destination).push(origin);
  };

  tokens.forEach(addNode);
  routes.forEach((route) => addEdge(...route));

  return { adjecencyList, routes, tokens, allPairs, addresses };
};

const getRandomIndex = (max) => {
  return Math.floor(Math.random() * max);
};

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const sleep = async (ms) => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

const BigNumber = require('bignumber.js');

const r = 1 - 0.3;

const getOptimalAmount = (Ea, Eb) => {
  if (Ea > Eb) {
    // console.log('No profit');
    return 0;
  }

  let A = (Math.sqrt(Ea * Eb * 0.3) - Ea) / r;

  return A;
};

const getOptimalInput = async (path, cb) => {
  const pairs = [];

  let compiledDataTries = 0;

  const compileData = async (i, cb) => {
    try {
      const pairAddress = await pancake.factory.methods
        .getPair(path[i], path[i + 1])
        .call();

      const pairContract = new web3.eth.Contract(pancakeAbis.pair, pairAddress);
      const reserves = await pairContract.methods.getReserves().call();

      const token0Address = await pairContract.methods.token0().call();
      const token0Contract = new web3.eth.Contract(
        ibep20Abi.abi,
        token0Address,
      );
      const token1Address = await pairContract.methods.token1().call();
      const token1Contract = new web3.eth.Contract(
        ibep20Abi.abi,
        token1Address,
      );

      const tokens = {
        0: {
          address: token0Address,
          contract: token0Contract,
          symbol: await token0Contract.methods.symbol().call(),
          name: await token0Contract.methods.name().call(),
          decimals: await token0Contract.methods.decimals().call(),
        },
        1: {
          address: token1Address,
          contract: token1Contract,
          symbol: await token1Contract.methods.symbol().call(),
          name: await token1Contract.methods.name().call(),
          decimals: await token1Contract.methods.decimals().call(),
        },
      };

      cb({
        pairAddress,
        reserve0: reserves[0],
        reserve1: reserves[1],
        error: false,
        index: i,
        ...tokens,
      });
    } catch (err) {
      if (compiledDataTries <= 5) await compileData(i);
      await sleep(2000);
      console.error('Ran into an error');
      console.error(err);
      cb({ error: false });
    }
  };

  let encounteredError = false;
  await new Promise((resolve) => {
    let counter = 0;
    const gotData = (data) => {
      counter++;

      if (data.error) encounteredError = true;
      else {
        const { index } = data;
        delete data.index;
        delete data.error;

        pairs[index] = data;
      }

      if (counter === path.length - 1) resolve();
    };

    for (let i = 0; i < path.length; i++) {
      if (i === path.length - 1) break;
      const index = i;

      compileData(index, gotData);
    }
  });

  if (encounteredError) return { error: true };

  let Ea, Eb;
  let tokenIn = WBNB;
  let tokenOut = WBNB;

  let idx = 0;
  for (const pair of pairs) {
    if (tokenIn === pair[0].address) {
      tokenOut = pair[1];
    } else {
      tokenOut = pair[0];
    }

    if (idx === 1) {
      let Ra = pairs[0].reserve0;
      let Rb = pairs[0].reserve1;

      if (tokenIn == pairs[0][1].address) {
        let temp = Ra;
        Ra = Rb;
        Rb = temp;
      }

      let Rb1 = pair.reserve0;
      let Rc = pair.reserve1;

      if (tokenOut == pair[1].address) {
        let temp = Rb1;
        Rb1 = Rc;
        Rc = temp;

        tokenOut = pair[0];
      } else {
        tokenOut = pair[1];
      }

      Ea = (Ra * Rb1) / (Rb1 + Rb * r);
      Eb = (r * Rb * Rc) / (Rb1 + Rb * r);
    }

    if (idx > 1) {
      let Ra = Ea;
      let Rb = Eb;
      let Rb1 = new BN(pair.reserve0);
      let Rc = new BN(pair.reserve1);

      if (tokenOut.address === pair[1].address) {
        let temp = Rb1;
        Rb1 = Rc;
        Rc = temp;
        tokenOut = pair[0];
      } else {
        tokenOut = pair[1];
      }

      Ea = (Ra * Rb1) / (Rb1 + Rb * r);
      Eb = (r * Rb * Rc) / (Rb1 + Rb * r);
    }
    idx++;
  }

  // getOptimalAmount(Ea, Eb)
  return { error: false, optimalAmt: 1 };
};

let ran = false;
const validateRoute = async (route, cb) => {
  const optimalAmtRes = await getOptimalInput(route);
  if (optimalAmtRes.error) return cb({ error: optimalAmt.error });
  if (optimalAmtRes.optimalAmt === 0) cb({ profitable: false });

  let precision = 18;
  const doNum = (num) => {
    if (precision <= 0) {
      return;
    }
    num = parseFloat(num).toPrecision(precision);
    let n;
    try {
      n = new BN(web3.utils.toWei(num + ''));

      return n;
    } catch (err) {
      precision--;
      doNum(num);
    }
  };

  console.log(optimalAmtRes.optimalAmt.toString());
  let amt = doNum(optimalAmtRes.optimalAmt.toString());
  logger.debug(`AMT: ${amt}`);

  if (amt === -1 || !amt) {
    logger.error('amt from getOptimalInput() was fucked. returning...');
    logger.error('amt:', amt);
    return {
      error: true,
    };
  }

  const gasPrice = await web3.eth.getGasPrice();

  const newRoute = new PriceRoute(
    route,
    amt,
    [pancake.router, sushi.router],
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

  cb(result);
};

const getLoanPath = require('./getLoanPath.js');

const traderAbi = require('../build/contracts/Trader.json');

const traderAddress = traderAbi.networks['56'].address;
const traderContract = new web3.eth.Contract(traderAbi.abi, traderAddress);

const doTrade = async (result) => {
  const path = ['0x55d398326f99059ff775485246999027b3197955', ...result.path];

  console.log(path);

  try {
    await traderContract.methods
      .swap(
        path,
        // [0, ...result.dexRoute],
        await getLoanPath(path[0], path[1], result.quoteIn.toString()),
      )
      .send({
        from: global.walletAddress,
      });
  } catch (err) {
    logger.error('Contract ran into an error');
    console.error(err);
  }
};

const getRoute = async () => {
  logger.info('Searching..');
  await client.connect();

  const { adjecencyList, routes, tokens, allPairs, addresses } =
    await getData();

  const data = {
    route: [],
    profit: 0,
  };

  let iterations = 0;

  let stop = false;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const dfs = async (inToken, startToken, cb, maxHops = 6, visited = []) => {
    if (stop) return;
    if (maxHops <= 0) return;
    visited.push(inToken);

    // Shuffle array to add some randomization
    const destinations = shuffle(adjecencyList.get(inToken));
    const hasStartToken = destinations.indexOf(startToken);

    if (hasStartToken !== -1 && destinations.length !== 1)
      destinations.splice(hasStartToken, 1);

    if (!destinations[0]) return console.log('Cant hopp');

    for (const destination of destinations) {
      // visited.push(destination);
      if (visited.length >= 2) {
        if (hasStartToken === -1) {
          dfs(destination, startToken, cb, maxHops - 1, visited);
          continue;
        }

        const tempVisited = visited.slice();
        tempVisited.push(destination);

        if (destination !== startToken) {
          tempVisited.push(startToken);
        }

        const indexOfBSCUSD = tempVisited.indexOf(
          '0x55d398326f99059fF775485246999027B3197955',
        );

        if (indexOfBSCUSD !== -1) {
          if (
            tempVisited[indexOfBSCUSD - 1] === WBNB ||
            tempVisited[indexOfBSCUSD + 1] === WBNB
          ) {
            continue;
          }
        }

        logger.debug('Validating route');
        validateRoute(tempVisited, (result) => {
          if (!result.profitable || result.error)
            dfs(destination, startToken, cb, maxHops - 1, visited);

          doTrade(result);
        });
      } else dfs(destination, startToken, cb, maxHops - 1, visited);
      //
      // if (destination === startToken || maxHops === 0) {
      //   visited.push(destination);
      //   console.log('pushing destination', visited.length);
      //   console.log('Getting price for path', visited);
      //
      //   if (visited.length > 8) return;
      //   console.log(visited);
      //   // getPriceFromRoute(
      //   //   visited,
      //   //   new BN(web3.utils.toWei('0.1')),
      //   //   [pancake.router],
      //   //   await web3.eth.getGasPrice(),
      //   //   addresses,
      //   //   (result) => {
      //   //     if (result.error)
      //   //       return logger.error(
      //   //         'Ran into an error when checking profitability of route',
      //   //       );
      //   //     console.log(result.profitable);
      //   //     console.log(result.profit.toString());
      //   //   },
      //   // );
      //
      //   // cb(visited);
      //   visited.pop();
      //
      //   // stop = result.profitable;
      //   // stop = true;
      //   if (stop) cb(visited);
      //   // else dfs(destination, startToken, cb, maxHops - 1, visited);
      //   return;
      // }

      // if (!visited.includes(destination)) {
      //   dfs(destination, startToken, cb, maxHops - 1, visited);
      // }
    }
  };

  // console.log(adjecencyList);
  // return;

  // Depth first search
  // let results = [];
  // const dfs = async (start, visited = new Set()) => {
  //   if (stop) return;
  //   console.log(addresses[start]);
  //
  //   visited.add(start);
  //
  //   const destinations = adjecencyList.get(start);
  //
  //   for (const destination of destinations) {
  //     if (destination === WBNB) {
  //       console.log('DFS found WBNB in steps');
  //       // stop = true;
  //       break;
  //     }
  //
  //     if (!visited.has(destination)) {
  //       dfs(destination, visited);
  //     }
  //   }
  //   results.push(visited);
  // };
  //
  // logger.info('running DFS');
  //
  // await dfs(WBNB);
  //
  // console.log(results, 478);

  await dfs(WBNB, WBNB, async (visited) => {
    let temp = [];
    await visited.forEach((item) => {
      temp.push(addresses[item]);
    });
    console.log(temp);
  });

  return data;
};

module.exports = getRoute;
