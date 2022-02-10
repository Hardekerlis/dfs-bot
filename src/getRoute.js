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

let calls = 0;

const getPriceFromRoute = async (route, tradeAmt, dexex, addresses, cb) => {
  console.log(route, 'myROute');
  if (calls !== 0) return;
  calls++;

  const doTest = async (dex, path, amt, cb) => {
    // await dex.setPair(path[0], path[1])
    // await dex.getReserves();
    // let quote = await this.#getPriceFromToken(
    //   dex,
    //   path,
    //   amt
    // )

    console.log('from:', addresses[path[0]]);
    console.log('to:', addresses[path[1]]);

    try {
      let quote = new BN(
        (await dex.methods.getAmountsOut(amt.toString(), path).call())[1],
      );

      cb(quote);
    } catch (err) {
      console.log(
        await pancake.factory.methods.getPair(path[0], path[1]).call(),
      );

      console.log('from:', addresses[path[0]]);
      console.log('to:', addresses[path[1]]);
      cb(new BN('-1'));
      console.log(err, 50);
      // logger.error(err);
    }

    // console.log("trade:", amt.toString())
    // console.log("quote:", quote.toString())
  };

  let priceRoute = [];
  let priceRouteData = [];
  let stop = false;

  console.log(route.length, 10);
  console.log(dexex.length, 10);

  await new Promise(async (resolve, reject) => {
    let toGet = route.length - 1;
    let got = 0;

    const gotQuoteData = (data) => {
      //got all quote data for a pair

      if (data.error) {
        stop = true;
        resolve();
        return;
      }

      priceRoute.push(data.index);
      priceRouteData.push(data);

      got++;
      if (toGet === got) {
        resolve();
      }
    };

    let routeIndex = 0;
    for (let token of route) {
      if (routeIndex + 1 === route.length) break;
      if (stop) break;

      // console.log("from:", token)
      // console.log("to:", route[routeIndex+1])

      await new Promise(async (_resolve, _reject) => {
        let data = {};
        let toGet = dexex.length;
        let got = 0;
        const gotTest = (dexName, dexIndex, quote) => {
          if (quote.eq(new BN('-1'))) {
            gotQuoteData({
              error: true,
            });
            _resolve();
            return;
          }

          data[dexIndex] = {
            dexName,
            dexIndex,
            quote,
          };
          got++;
          if (toGet === got) {
            let maxQuote = new BN('0');
            let maxQuoteIndex = -1;
            for (let key in data) {
              if (data[key].quote.gt(maxQuote)) {
                maxQuoteIndex = data[key].dexIndex;
                maxQuote = data[key].quote;
              }
            }

            gotQuoteData({
              quote: maxQuote,
              index: maxQuoteIndex,
            });
            _resolve();
          }
        };

        let dexIndex = 0;
        for (let dex of dexex) {
          let dIndex = dexIndex;
          if (stop) break;

          let amt;
          if (priceRouteData.length === 0) {
            amt = tradeAmt;
          } else {
            amt = priceRouteData[priceRouteData.length - 1].quote;
          }

          console.log('calling doTest', [token, route[routeIndex + 1]]);

          doTest(
            dex,
            [token, route[routeIndex + 1]],
            // latestQuote,
            amt,
            (quote) => gotTest('dex.name', dIndex, quote),
          );
          dexIndex++;
          if (stop) break;
        }
      });
      routeIndex++;
    }
  });

  if (stop === true) {
    return {
      error: true,
    };
  }

  // return {
  //   profitable: !tradeAmt
  //     .sub(priceRouteData[priceRouteData.length - 1].quote)
  //     .isNeg(),
  //   dexRoute: priceRoute,
  //   dexRouteData: priceRouteData,
  //   quoteIn: tradeAmt,
  //   quoteOut: priceRouteData[priceRouteData.length - 1].quote,
  // };

  let hej = new BN('0');

  console.log(hej.add(new BN('1')).toString());
  console.log(hej.toString());

  console.log(
    tradeAmt.sub(priceRouteData[priceRouteData.length - 1].quote).toString(),
  );

  cb({
    profitable: !tradeAmt
      .sub(priceRouteData[priceRouteData.length - 1].quote)
      .isNeg(),
    dexRoute: priceRoute,
    dexRouteData: priceRouteData,
    quoteIn: tradeAmt,
    quoteOut: priceRouteData[priceRouteData.length - 1].quote,
  });
};

const getData = async () => {
  const routes = JSON.parse(await client.get('routes'));

  // const routes = Object.entries(rawRoutes);

  const tokens = await client.sMembers('tokens');

  const allPairs = JSON.parse(await client.get('allPairs'));

  const addresses = await client.hGetAll('addresses');

  const adjecencyList = new Map();

  console.log(tokens);
  console.log(routes);

  const addNode = (token) => {
    adjecencyList.set(token, []);
  };

  const addEdge = (origin, destination) => {
    adjecencyList.get(origin).push(destination);
    adjecencyList.get(destination).push(origin);
  };

  tokens.forEach(addNode);
  routes.forEach((route) => addEdge(...route));

  // adjecencyList.forEach((destinations, start) => {
  //   if (!destinations[0]) adjecencyList.delete(start);
  // });

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

const getRoute = async () => {
  logger.info('Searching..');
  await client.connect();

  const { adjecencyList, routes, tokens, allPairs, addresses } =
    await getData();
  // console.log(adjecencyList);

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

  const dfs = async (inToken, outToken, cb, maxHops = 5, visited = []) => {
    if (stop) return;
    visited.push(inToken);
    // console.log('Visited', addresses[inToken]);
    // Shuffle array to add some randomization

    const destinations = shuffle(adjecencyList.get(inToken));
    // console.log(destinations.length);
    // const destinations = adjecencyList.get(inToken);
    // console.log(inToken);

    // for (const destination of destinations) {
    //   console.log(destination);
    // }

    if (!destinations[0]) return console.log('Cant hopp');

    for (const destination of destinations) {
      if (destination === outToken || maxHops === 0) {
        visited.push(destination);
        // console.log('Getting price for path', visited);

        if (visited.length > 3) return;
        console.log('Getting prices ; )');
        getPriceFromRoute(
          visited,
          new BN(web3.utils.toWei('1')),
          [pancake.router],
          addresses,
          (result) => {
            console.log(result.quoteIn.toString());
            console.log(result.quoteOut.toString());
            console.log(result.profitable, 281);
          },
        );

        // console.log(result.profitable);
        cb(visited);
        visited.pop();

        // stop = result.profitable;
        // stop = true;
        // if (stop) cb(visited);
        // // else dfs(destination, outToken, cb, maxHops - 1, visited);
        // return;
      }

      if (!visited.includes(destination)) {
        dfs(destination, outToken, cb, maxHops - 1, visited);
      }
    }
  };

  const startIndex = Math.floor(
    Math.random() * Array.from(adjecencyList.keys()).length,
  );

  // const res = await new Promise(async (resolve) => {
  //   await dfs(
  //     // '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
  //     // Array.from(adjecencyList.keys())[startIndex],
  //     WBNB,
  //     // '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  //     WBNB,
  //     async (visited) => {
  //       let temp = [];
  //       await visited.forEach((item) => {
  //         temp.push(addresses[item]);
  //       });
  //       resolve(temp);
  //     },
  //   );
  // });
  //
  // data.route = res;

  // console.log(
  //   await pancake.factory.methods
  //     .getPair(
  //       '0x9c9d4302A1A550b446401e56000F76Bc761C3A33',
  //       '0x57bb0f40479D7Dd0caa67f2A579273A8e9c038Ee',
  //     )
  //     .call(),
  // );

  await dfs(WBNB, WBNB, async (visited) => {
    let temp = [];
    await visited.forEach((item) => {
      // console.log(item);
      temp.push(addresses[item]);
    });
    console.log(temp);
  });

  // const dfs = async (
  //   tokenIn,
  //   tokenOut,
  //   maxHops,
  //   currentPairs,
  //   path,
  //   bestTrades,
  //   count = 5,
  // ) => {
  //   for (const pair of allPairs) {
  //     console.log(pair);
  //   }
  //
  //   // if (stop || iterations === 15) return;
  //   // iterations++;
  //   // logger.debug(`Start token: ${symbols[start]}`);
  //   //
  //   // visited.add(start);
  //   // data.route.push(start);
  //   //
  //   // const destinations = adjecencyList.get(start);
  //   //
  //   // for (const destination of destinations) {
  //   //   logger.debug(`Destination token: ${symbols[destination]}`);
  //   //
  //   //   // const res = await getPriceFromRoute(
  //   //   //   [...data.route, destination],
  //   //   //   new BN(web3.utils.toWei('0.005')),
  //   //   //   [pancake.router],
  //   //   // );
  //   //   //
  //   //   // if (res.error) {
  //   //   //   console.log(': (');
  //   //   //   visited.delete(start);
  //   //   //   data.route.pop();
  //   //   //
  //   //   //   continue;
  //   //   // }
  //   //
  //   //   // if (destination === 'WBNB') {
  //   //   //   console.log('DFS found WBNB in steps');
  //   //   //   stop = true;
  //   //   //   return;
  //   //   // }
  //   //   //
  //   //
  //   //   if (!visited.has(destination)) {
  //   //     // console.log(res.quoteIn.toString(), res.quoteOut.toString());
  //   //
  //   //     // if (res.profitable) {
  //   //     //   data.route.push(destination);
  //   //     //   return;
  //   //     // }
  //   //     dfs(destination, visited);
  //   //   }
  //   // }
  // };

  // dfs(WBNB, WBNB, 10, [WBNB], []);

  return data;
};

module.exports = getRoute;
