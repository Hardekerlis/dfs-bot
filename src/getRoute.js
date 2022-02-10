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

const getPriceFromRoute = require('./getPriceFromRoute.js');

const getData = async () => {
  const routes = JSON.parse(await client.get('routes'));

  // const routes = Object.entries(rawRoutes);

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

const BigNumber = require('bignumber.js');

const getOptimalInput = async (path, cb) => {
  const pairs = [
    {
      0: {
        address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        symbol: 'WBNB',
        name: 'Wrapped BNB',
        decimals: '18',
      },
      1: {
        address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        symbol: 'BUSD',
        name: 'BUSD Token',
        decimals: '18',
      },
      pairAddress: '0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16',
      reserve0: '469114900700641891621321',
      reserve1: '196139861593054695257779875',
    },
    {
      0: {
        address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        symbol: 'Cake',
        name: 'PancakeSwap Token',
        decimals: '18',
      },
      1: {
        address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        symbol: 'BUSD',
        name: 'BUSD Token',
        decimals: '18',
      },
      pairAddress: '0x804678fa97d91B974ec2af3c843270886528a9E6',
      reserve0: '1039469596105351857517679',
      reserve1: '8440353660266187094816855',
    },
    {
      0: {
        address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        symbol: 'Cake',
        name: 'PancakeSwap Token',
        decimals: '18',
      },
      1: {
        address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        symbol: 'WBNB',
        name: 'Wrapped BNB',
        decimals: '18',
      },
      pairAddress: '0x0eD7e52944161450477ee417DE9Cd3a859b14fD0',
      reserve0: '14726703704952133852697358',
      reserve1: '286606820030676363240432',
    },
  ];
  // await path.forEach(async (token, i) => {
  //   if (i === path.length - 1) return;
  //   const pair = await pancake.factory.methods
  //     .getPair(token, path[i + 1])
  //     .call();
  //   data.push(pair);
  // });

  // for (let i = 0; i < path.length; i++) {
  //   if (i === path.length - 1) break;
  //   const pairAddress = await pancake.factory.methods
  //     .getPair(path[i], path[i + 1])
  //     .call();
  //
  //   const pairContract = new web3.eth.Contract(pancakeAbis.pair, pairAddress);
  //   const reserves = await pairContract.methods.getReserves().call();
  //
  //   const token0Address = await pairContract.methods.token0().call();
  //   const token0Contract = new web3.eth.Contract(ibep20Abi.abi, token0Address);
  //   const token1Address = await pairContract.methods.token1().call();
  //   const token1Contract = new web3.eth.Contract(ibep20Abi.abi, token1Address);
  //
  //   const tokens = {
  //     0: {
  //       address: token0Address,
  //       contract: token0Contract,
  //       symbol: await token0Contract.methods.symbol().call(),
  //       name: await token0Contract.methods.name().call(),
  //       decimals: await token0Contract.methods.decimals().call(),
  //     },
  //     1: {
  //       address: token1Address,
  //       contract: token1Contract,
  //       symbol: await token1Contract.methods.symbol().call(),
  //       name: await token1Contract.methods.name().call(),
  //       decimals: await token1Contract.methods.decimals().call(),
  //     },
  //   };
  //
  //   data.push({
  //     pairAddress,
  //     reserve0: reserves[0],
  //     reserve1: reserves[1],
  //     ...tokens,
  //   });
  // }

  // const r = new BigNumber(0.4);
  //
  // const R0 = new BigNumber(data[0].reserve0);
  // const R1 = new BigNumber(data[0].reserve1);
  //
  // const R2 = new BigNumber(data[1].reserve0);
  // const R3 = new BigNumber(data[1].reserve1);
  //
  // // const R4 = new BigNumber(data[2].reserve0);
  // // const R5 = new BigNumber(data[2].reserve1);
  //
  // const E0top = new BigNumber(R0).multipliedBy(R2);
  // const E0bot = R2.plus(R1.multipliedBy(r));
  // const E0 = E0top.dividedBy(E0bot);
  //
  // let E1top = r.multipliedBy(R1).multipliedBy(R3);
  // let E1bot = R2.plus(R1.multipliedBy(r));
  // const E1 = E1top.dividedBy(E1bot);

  // const getOptimalAmount = (Ea, Eb) => {
  //   console.log(Ea.toString(), 'Ea');
  //   console.log(Eb.toString(), 'Eb');
  //
  //   const one = new BigNumber(
  //     Ea.mul(Eb).mul(new BN('997')).sub(Ea).toString(),
  //   ).sqrt();
  //
  //   // console.log(new BigNumber(one.toString()).sqrt().toString(), 'one');
  //
  //   // const two = new BigNumber(
  //   //   Ea.mul(new BN('1000')).div(new BN('997')).toString(),
  //   // );
  //   // console.log(one.minus(two).toString(), 'two');
  //
  //   const result = one.dividedBy('997').toFormat([0]);
  //
  //   console.log(web3.utils.fromWei(result));
  //
  //   return result.toString();
  // };

  const r = 1 - 0.3;

  const getOptimalAmount = (Ea, Eb) => {
    if (Ea > Eb) {
      // console.log('No profit');
      return 0;
    }
    // console.log(Ea, 'Ea');
    // console.log(Eb, 'Eb');

    let A = (Math.sqrt(Ea * Eb * 0.3) - Ea) / r;

    return A.toPrecision(15);
  };

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

  return getOptimalAmount(Ea, Eb);
};

getOptimalInput(
  [
    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  ],
  async (result) => {
    // console.log(web3.utils.toWei(result.toString()));
    // return;
    const amt = web3.utils.toWei(result.toString());
    const gasPrice = await web3.eth.getGasPrice();
    getPriceFromRoute(
      [
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      ],
      new BN(amt),
      [pancake.router],
      new BN(gasPrice),
      [],
      (res) => {
        console.log('Optimal input amt', web3.utils.fromWei(amt));
        console.log(res.profit.toString());
      },
    );
    console.log(amt);
    for (let i = 0; i < 6; i++) {
      const temp = (Math.random() / 1000).toPrecision(14);

      getPriceFromRoute(
        [
          '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
          '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
          '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
          '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        ],
        new BN(web3.utils.toWei(temp + '')),
        [pancake.router],
        new BN(gasPrice),
        [],
        (res) => {
          console.log('Random input amt', temp);
          console.log(res.profit.toString());
        },
      );
    }
  },
);

const validateRoute = async (route, cb) => {
  const optimalAmt = await getOptimalInput(route);
  if (optimalAmt === 0) cb({ profitable: false });

  const gasPrice = await web3.eth.getGasPrice();
  const result = await getPriceFromRoute(
    route,
    new BN(web3.utils.toWei(optimalAmt.toString())),
    [pancake.router],
    new BN(gasPrice),
    [],
  );

  return result;
};

const doTrade = async (data) => {};

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

  const dfs = async (inToken, startToken, cb, maxHops = 8, visited = []) => {
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
      if (visited.length >= 2) {
        if (maxHops === 0) return;

        validateRoute(visited);
      }

      if (destination === startToken || maxHops === 0) {
        visited.push(destination);
        console.log('pushing destination', visited.length);
        console.log('Getting price for path', visited);

        if (visited.length > 8) return;
        console.log(visited);
        // getPriceFromRoute(
        //   visited,
        //   new BN(web3.utils.toWei('0.1')),
        //   [pancake.router],
        //   await web3.eth.getGasPrice(),
        //   addresses,
        //   (result) => {
        //     if (result.error)
        //       return logger.error(
        //         'Ran into an error when checking profitability of route',
        //       );
        //     console.log(result.profitable);
        //     console.log(result.profit.toString());
        //   },
        // );

        // cb(visited);
        visited.pop();

        // stop = result.profitable;
        // stop = true;
        if (stop) cb(visited);
        // else dfs(destination, startToken, cb, maxHops - 1, visited);
        return;
      }

      if (!visited.includes(destination)) {
        dfs(destination, startToken, cb, maxHops - 1, visited);
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

  // while (true) {
  //   await dfs(WBNB, WBNB, async (visited) => {
  //     let temp = [];
  //     await visited.forEach((item) => {
  //       temp.push(addresses[item]);
  //     });
  //     console.log(temp);
  //   });
  //   await sleep(3000);
  // }

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
