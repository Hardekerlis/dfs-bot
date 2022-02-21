const redis = require('redis');
const client = redis.createClient();
const { logger } = require('../utils/logger.js');
const shuffleArray = require('../lib/shuffleArray.js');
const BN = require('bn.js');

const parseData = async (rawPoolData) => {
  const allTokens = new Set();
  const poolData = [];
  for (const _poolData of rawPoolData) {
    poolData.push(JSON.parse(_poolData));
  }

  for (pool of poolData) {
    allTokens.add(pool.token0.address);
    allTokens.add(pool.token1.address);
  }

  const routes = [];
  for (const pair of poolData) {
    routes.push([pair.token0.address, pair.token1.address]);
  }

  const adjecencyList = new Map();

  const addNode = (token) => {
    adjecencyList.set(token, []);
  };

  const addEdge = (origin, destination) => {
    adjecencyList.get(origin).push(destination);
    adjecencyList.get(destination).push(origin);
  };

  await allTokens.forEach(addNode);
  await routes.forEach((route) => addEdge(...route));

  return { adjecencyList, poolData };
};

const r = 1 - 0.3;

const getOptimalAmount = (Ea, Eb) => {
  if (Ea > Eb) {
    return 0;
  }

  let A = (Math.sqrt(Ea * Eb * 0.3) - Ea) / r;

  if (A < 0) {
    return 0;
  }

  // TODO: Implement a fix for very small decimals
  // console.log('Before', A);
  // if (A.toString().includes('e')) {
  //   const temp = A.toString().split('e');
  //   console.log('Temp', temp);
  //
  //   const newNum = Math.pow(parseFloat(temp[0]), 10 * parseInt(temp[1]));
  //   A = newNum;
  // }
  //
  // console.log('After', A);

  return A;
};

const getOptimalInput = (route, poolData, cb) => {
  let Ea, Eb;
  let tokenIn = WBNB;
  let tokenOut = WBNB;

  const unorderedPairs = {};

  for (const pool of poolData) {
    const token0Index = route.indexOf(pool.token0.address);
    const token1Index = route.indexOf(pool.token1.address);

    const diff = token0Index - token1Index;

    if (token0Index !== -1 && token1Index !== -1 && Math.abs(diff) === 1) {
      let instertAt = token0Index < token1Index ? token0Index : token1Index;
      unorderedPairs[instertAt] = pool;
    }

    if (
      (pool.token0.address === route[route.length - 1] &&
        pool.token1.address === route[route.length - 2]) ||
      (pool.token0.address === route[route.length - 2] &&
        pool.token1.address === route[route.length - 1])
    ) {
      unorderedPairs[route.length - 2] = pool;
    }
  }

  const pairs = Object.values(unorderedPairs);

  let idx = 0;

  try {
    for (const pair of pairs) {
      if (tokenIn === pair.token0.address) {
        tokenOut = pair.token1;
      } else {
        tokenOut = pair.token0;
      }

      if (idx === 1) {
        let Ra = pairs[0].reserve0;
        let Rb = pairs[0].reserve1;

        if (tokenIn == pairs[0].token1.address) {
          let temp = Ra;
          Ra = Rb;
          Rb = temp;
        }

        let Rb1 = pair.reserve0;
        let Rc = pair.reserve1;

        if (tokenOut == pair.token1.address) {
          let temp = Rb1;
          Rb1 = Rc;
          Rc = temp;

          tokenOut = pair.token0;
        } else {
          tokenOut = pair.token1;
        }

        Ea = (Ra * Rb1) / (Rb1 + Rb * r);
        Eb = (r * Rb * Rc) / (Rb1 + Rb * r);
      }

      if (idx > 1) {
        let Ra = Ea;
        let Rb = Eb;
        let Rb1 = new BN(pair.reserve0);
        let Rc = new BN(pair.reserve1);

        if (tokenOut.address === pair.token1.address) {
          let temp = Rb1;
          Rb1 = Rc;
          Rc = temp;
          tokenOut = pair.token0;
        } else {
          tokenOut = pair.token1;
        }

        Ea = (Ra * Rb1) / (Rb1 + Rb * r);
        Eb = (r * Rb * Rc) / (Rb1 + Rb * r);
      }
      idx++;
    }

    const finisedCalc = getOptimalAmount(Ea, Eb);

    cb({
      profitable: finisedCalc === 0 ? false : true,
      route: route,
      optimalAmt: finisedCalc,
    });
  } catch (err) {
    console.log(err);
  }
};

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const getRoute = async (rawPoolData) => {
  logger.info('Starting route search ...');

  // 1. Parse data
  const { adjecencyList, poolData } = await parseData(rawPoolData);

  // 2. Find routes
  let stop = false;
  const dfs = (inToken, goal, cb, visited = []) => {
    if (stop) return;
    const connectedNodes = shuffleArray(adjecencyList.get(inToken));

    if (connectedNodes.length === 1) {
      return;
    }

    visited.push(inToken);
    for (const node of connectedNodes) {
      if (node === goal) {
        if (stop) return;

        visited.push(WBNB);
        stop = true;

        const visitedCopy = visited.slice();
        getOptimalInput(visitedCopy, poolData, (result) => {
          cb(result);
        });

        return;
      }

      if (!visited.includes(node)) dfs(node, goal, cb, visited);
    }
  };

  const dfsResult = await new Promise(async (resolve) => {
    await dfs(WBNB, WBNB, (result) => {
      resolve(result);
    });
  });

  // 3. Return routes
  return dfsResult;
};

module.exports = getRoute;
