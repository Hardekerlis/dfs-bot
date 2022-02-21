const BN = require('bn.js');

const DEFAULT_GAS = '25000';

class Routing {
  constructor(route, tradeAmt, dexex, gasPrice) {
    console.log('new ROUTING');
    this.route = route.slice();
    try {
      if (BN.isBN(tradeAmt)) this.tradeAmt = new BN(tradeAmt);
      else this.tradeAmt = new BN(tradeAmt.toString());
    } catch (err) {
      console.log(tradeAmt, 13);
      console.log('Invalid tradeAmt');
      console.log("tradeAmt couldn't be converted to BN (prob)");
    }
    this.dexex = dexex.slice();
    this.gas = new BN('25000'); //default gas
    this.gasPrice = gasPrice;
    this.forcedDex = -1;
  }

  forceDex(dexIndex) {
    this.forcedDex = dexIndex;
  }

  async fetchQuote(dex, path, amt) {
    try {
      let quote = new BN(
        (await dex.methods.getAmountsOut(amt.toString(), path).call())[1],
      );

      let gas = new BN(this.gas).mul(this.gasPrice);
      quote = quote.sub(gas);

      return quote;
    } catch (err) {
      console.log(err);
      return new BN('-1');
    }
  }

  async fetchQuotes(_path, _amt) {
    let arrToReturn = [new BN('-1'), -1];

    await new Promise((resolve, reject) => {
      let info = {};

      let quotesGot = 0;
      const doFetch = async (dexIndex) => {
        let quote = await this.fetchQuote(this.dexex[dexIndex], _path, _amt);
        info[dexIndex] = {
          quote,
          dexIndex,
        };
        quotesGot++;
        if (this.dexex.length === quotesGot || this.forcedDex !== -1) {
          for (let dIndex in info) {
            if (info[dIndex].quote.gt(arrToReturn[0])) {
              arrToReturn = [info[dIndex].quote, info[dIndex].dexIndex];
            }
          }
          resolve();
        }
      };

      if (this.forcedDex !== -1) {
        doFetch(this.forcedDex);
        return;
      }

      let dexIndex = 0;
      for (let dex of this.dexex) {
        doFetch(dexIndex);
        dexIndex++;
      }
    });

    return arrToReturn;
  }

  async getPrice(cb) {
    let dexRoute = [];
    let dexRouteData = [];
    let error = false;

    let tokensToGet = this.route.length;
    let tokensGot = 0;

    let amtToTrade = this.tradeAmt;

    let routePathIndex = 0;
    for (let token of this.route) {
      if (error) return;
      if (routePathIndex + 1 === this.route.length) break;

      let tokenPath = [token, this.route[routePathIndex + 1]];

      let [quote, dexIndex] = await this.fetchQuotes(tokenPath, amtToTrade);

      if (quote.eq(new BN('-1'))) {
        error = true;
        break;
      }

      dexRoute.push(dexIndex);
      dexRouteData.push({
        dexIndex,
        tokenPath,
        quoteOut: quote,
        quoteIn: amtToTrade,
      });

      amtToTrade = quote;
      routePathIndex++;
    }

    if (error) {
      return cb({
        error: true,
      });
    }

    const profit = amtToTrade.sub(this.tradeAmt);

    cb({
      quoteIn: this.tradeAmt,
      quoteOut: amtToTrade,
      profit,
      profitable: !profit.isNeg(),
      dexRoute,
      dexRouteData,
      error: false,
      path: this.route,
    });
  }

  async sleep(ms) {
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  async tryGetPrice(times) {
    if (!times) times = 10;
    let result;
    for (let i = 0; i < times; i++) {
      console.log('Trying', i);
      result = await new Promise(async (resolve) => {
        this.getPrice((tempResult) => {
          resolve(tempResult);
        });
      });

      if (!result.error) break;

      await this.sleep(2000);
    }

    return result;
  }
}

module.exports = Routing;

// const getPriceFromRoute = async (
//   route,
//   tradeAmt,
//   dexex,
//   gasPrice,
//   addresses,
//   cb,
// ) => {
//   const routePath = route.slice();
//
//   const fetchQuote = async (dex, path, amt) => {
//     try {
//       let quote = new BN(
//         (await dex.methods.getAmountsOut(amt.toString(), path).call())[1],
//       );
//
//       let gas = new BN(DEFAULT_GAS).mul(gasPrice);
//       quote = quote.sub(gas);
//
//       return quote;
//     } catch (err) {
//       return new BN('-1');
//     }
//   };
//
//   const fetchQuotes = async (_path, _amt) => {
//     //fetchQuote() on all dexex
//
//     let arrToReturn = [new BN('-1'), -1];
//
//     await new Promise((resolve, reject) => {
//       let info = {};
//
//       let quotesGot = 0;
//       const doFetch = async (dexIndex) => {
//         let quote = await fetchQuote(dexex[dexIndex], _path, _amt);
//         info[dexIndex] = {
//           quote,
//           dexIndex,
//         };
//         // console.log(_path)
//         // console.log("got quote: " + quote + " from: " + dexIndex)
//         quotesGot++;
//         if (dexex.length === quotesGot) {
//           for (let dIndex in info) {
//             if (info[dIndex].quote.gt(arrToReturn[0])) {
//               arrToReturn = [info[dIndex].quote, info[dIndex].dexIndex];
//             }
//           }
//           // console.log(arrToReturn[0].toString(), arrToReturn[1])
//           resolve();
//         }
//       };
//
//       let dexIndex = 0;
//       for (let dex of dexex) {
//         doFetch(dexIndex);
//         dexIndex++;
//       }
//     });
//
//     return arrToReturn;
//   };
//
//   let dexRoute = [];
//   let dexRouteData = [];
//   let error = false;
//
//   let tokensToGet = routePath.length;
//   let tokensGot = 0;
//
//   let amtToTrade = tradeAmt;
//
//   let routePathIndex = 0;
//   for (let token of routePath) {
//     if (error) return;
//     if (routePathIndex + 1 === routePath.length) break;
//
//     let tokenPath = [token, routePath[routePathIndex + 1]];
//
//     let [quote, dexIndex] = await fetchQuotes(tokenPath, amtToTrade);
//
//     if (quote.eq(new BN('-1'))) {
//       error = true;
//       break;
//     }
//
//     dexRoute.push(dexIndex);
//     dexRouteData.push({
//       dexIndex,
//       tokenPath,
//       quoteOut: quote,
//       quoteIn: amtToTrade,
//     });
//
//     amtToTrade = quote;
//     routePathIndex++;
//   }
//
//   if (error) {
//     return cb({
//       error: true,
//     });
//   }
//
//   const profit = amtToTrade.sub(tradeAmt);
//
//   cb({
//     quoteIn: tradeAmt,
//     quoteOut: amtToTrade,
//     profit,
//     profitable: !profit.isNeg(),
//     dexRoute,
//     dexRouteData,
//     error: false,
//   });
// };
//
// const sleep = async (ms) => {
//   await new Promise((resolve) => {
//     setTimeout(() => {
//       resolve();
//     }, ms);
//   });
// };
//
// const wrapper = async (route, tradeAmt, dexex, gasPrice, addresses) => {
//   let result;
//   for (let i = 0; i < 10; i++) {
//     result = await new Promise(async (resolve) => {
//       getPriceFromRoute(
//         route,
//         tradeAmt,
//         dexex,
//         gasPrice,
//         addresses,
//         (tempResult) => {
//           resolve(tempResult);
//         },
//       );
//     });
//
//     if (!result.error) break;
//
//     await sleep(2000);
//   }
//
//   return result;
// };

// module.exports = wrapper;
