const BN = require('bn.js');

const DEFAULT_GAS = '25000';

const getPriceFromRoute = async (
  route,
  tradeAmt,
  dexex,
  gasPrice,
  addresses,
  cb,
) => {
  const routePath = route.slice();

  const fetchQuote = async (dex, path, amt) => {
    try {
      let quote = new BN(
        (await dex.methods.getAmountsOut(amt.toString(), path).call())[1],
      );

      let gas = new BN(DEFAULT_GAS).mul(gasPrice);
      quote = quote.sub(gas);

      return quote;
    } catch (err) {
      return new BN('-1');
    }
  };

  const fetchQuotes = async (_path, _amt) => {
    //fetchQuote() on all dexex

    let arrToReturn = [new BN('-1'), -1];

    await new Promise((resolve, reject) => {
      let info = {};

      let quotesGot = 0;
      const doFetch = async (dexIndex) => {
        let quote = await fetchQuote(dexex[dexIndex], _path, _amt);
        info[dexIndex] = {
          quote,
          dexIndex,
        };
        // console.log(_path)
        // console.log("got quote: " + quote + " from: " + dexIndex)
        quotesGot++;
        if (dexex.length === quotesGot) {
          for (let dIndex in info) {
            if (info[dIndex].quote.gt(arrToReturn[0])) {
              arrToReturn = [info[dIndex].quote, info[dIndex].dexIndex];
            }
          }
          // console.log(arrToReturn[0].toString(), arrToReturn[1])
          resolve();
        }
      };

      let dexIndex = 0;
      for (let dex of dexex) {
        doFetch(dexIndex);
        dexIndex++;
      }
    });

    return arrToReturn;
  };

  let dexRoute = [];
  let dexRouteData = [];
  let error = false;

  let tokensToGet = routePath.length;
  let tokensGot = 0;

  let amtToTrade = tradeAmt;

  let routePathIndex = 0;
  for (let token of routePath) {
    if (error) return;
    if (routePathIndex + 1 === routePath.length) break;

    let tokenPath = [token, routePath[routePathIndex + 1]];

    let [quote, dexIndex] = await fetchQuotes(tokenPath, amtToTrade);

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

  const profit = amtToTrade.sub(tradeAmt);

  cb({
    quoteIn: tradeAmt,
    quoteOut: amtToTrade,
    profit,
    profitable: !profit.isNeg(),
    dexRoute,
    dexRouteData,
    error: false,
  });
};

const sleep = async (ms) => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

const wrapper = async (route, tradeAmt, dexex, gasPrice, addresses) => {
  let result;
  for (let i = 0; i < 10; i++) {
    result = await new Promise(async (resolve) => {
      getPriceFromRoute(
        route,
        tradeAmt,
        dexex,
        gasPrice,
        addresses,
        (tempResult) => {
          resolve(tempResult);
        },
      );
    });

    if (!result.error) break;

    await sleep(2000);
  }

  return result;
};

module.exports = wrapper;
