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
    allTokens.add(pool.token0.symbol);
    allTokens.add(pool.token1.symbol);
  }

  const routes = [];
  for (const pair of poolData) {
    routes.push([pair.token0.symbol, pair.token1.symbol]);
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

  return A;
};

const getOptimalInput = (route, poolData, cb) => {
  let Ea, Eb;
  let tokenIn = WBNB;
  let tokenOut = WBNB;

  const unorderedPairs = {};

  for (const pool of poolData) {
    const token0Index = route.indexOf(pool.token0.symbol);
    const token1Index = route.indexOf(pool.token1.symbol);

    const diff = token0Index - token1Index;

    if (token0Index !== -1 && token1Index !== -1 && Math.abs(diff) === 1) {
      let instertAt = token0Index < token1Index ? token0Index : token1Index;
      unorderedPairs[instertAt] = pool;
    }

    if (
      (pool.token0.symbol === route[route.length - 1] &&
        pool.token1.symbol === route[route.length - 2]) ||
      (pool.token0.symbol === route[route.length - 2] &&
        pool.token1.symbol === route[route.length - 1])
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

  const routes = [];

  let stop = false;
  // const dfs = async (inToken, startToken, cb, maxHops = 5, visited = []) => {
  //   if (stop) return;
  //
  //   if (maxHops <= 0) {
  //     return;
  //   }
  //   if (!visited.includes(startToken)) {
  //     visited.push(inToken);
  //   }
  //
  //   const destinations = shuffleArray(adjecencyList.get(inToken));
  //   const hasStartToken = destinations.indexOf(startToken);
  //
  //   if (hasStartToken !== -1 && destinations.length !== 1)
  //     if (!destinations[0])
  //       // destinations.splice(hasStartToken, 1);
  //
  //       return logger.warn('Cant hopp');
  //   // console.log(destinations);
  //
  //   for (const destination of destinations) {
  //     // TODO: Add a check to limit array length before getOptimalInput
  //     if (
  //       visited.length >= 2 &&
  //       adjecencyList.get(destination).includes(startToken)
  //     ) {
  //       if (hasStartToken === -1) {
  //         dfs(destination, startToken, cb, maxHops - 1, visited);
  //         continue;
  //       }
  //
  //       const tempVisted = visited.slice();
  //       tempVisted.push(destination);
  //
  //       // TODO: Fix this bad code. There is no garantee that destination can swap to startToken
  //
  //       // console.log(destination);
  //       // if (destination !== startToken) {
  //       //   console.log(adjecencyList.get(destination).includes(startToken));
  //       //   if (adjecencyList.get(destination).includes(startToken)) {
  //       //     console.log('PUSHING STARTTOKEN');
  //       //     tempVisted.push(startToken);
  //       //   } else {
  //       //     dfs(destination, startToken, cb, maxHops - 1, visited);
  //       //     continue;
  //       //   }
  //       // }
  //
  //       const indexOfBSCUSD = tempVisted.indexOf(
  //         '0x55d398326f99059fF775485246999027B3197955',
  //       );
  //
  //       if (indexOfBSCUSD !== -1) {
  //         if (
  //           tempVisited[indexOfBSCUSD - 1] === WBNB ||
  //           tempVisited[indexOfBSCUSD + 1] === WBNB
  //         ) {
  //           continue;
  //         }
  //       }
  //
  //       getOptimalInput(tempVisted, poolData, (result) => {
  //         if (!result.profitable || result.error) {
  //           dfs(destination, startToken, cb, maxHops - 1, visited);
  //           return;
  //         }
  //
  //         routes.push({ route: result.route, optimalAmt: result.optimalAmt });
  //         if (routes.length >= 3) stop = true;
  //       });
  //     } else dfs(destination, startToken, cb, maxHops - 1, visited);
  //   }
  // };

  // const dfs = (start, visited = []) => {
  //   if (stop) return;
  //   console.log(start);
  //
  //   visited.push(start);
  //
  //   const destinations = adjecencyList.get(start);
  //
  //   for (const destination of destinations) {
  //     if (destination === 'WBNB') {
  //       const tempVisted = visited.slice();
  //       routes.push(tempVisted);
  //       console.log('DFS found WBNB in steps');
  //
  //       if (routes.length >= 4) stop = true;
  //       return;
  //     }
  //
  //     if (!visited.includes(destination)) {
  //       dfs(destination, visited);
  //     }
  //   }
  // };
  //

  // console.log(adjecencyList);

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

        visited.push('WBNB');
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

  await dfs('WBNB', 'WBNB', (result) => {
    console.log(result);
  });

  // await dfs('WBNB', 'WBNB', (result) => {
  //   // console.log(result);
  //   routes.push(result);
  // });

  // console.log(routes);

  // 3. Return routes
  return routes;
};

module.exports = getRoute;
