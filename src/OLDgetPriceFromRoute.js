
const BN = require('bn.js');

let calls = 0;

const getPriceFromRoute = async (routePath, tradeAmt, dexex, addresses, callback) => {
  console.log(routePath, 'myROute');
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
      // console.log(
      //   await pancake.factory.methods.getPair(path[0], path[1]).call(),
      // );
      console.log("ERRROROROROOROR")
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

  let completed = false;

  console.log(routePath.length, 10);
  console.log(dexex.length, 10);

  await new Promise(async (resolve, reject) => {
    let toGet = routePath.length - 1;
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
        completed = true;
        resolve();
      }
    };

    let routePathIndex = 0;
    let routePathLength = routePath.length
    console.log(routePathLength, 101)
    console.log("routePath", routePath)
    for (let token of routePath) {
      console.log(routePath.length)
      if (routePathIndex + 1 === routePathLength) break;
      if (stop) break;

      // console.log(routePath, "myRoutePath")

      console.log("routePathIndex", routePathIndex, routePathLength)

      // console.log("from:", token)
      // console.log("to:", routePath[routePathIndex+1])

      await new Promise(async (_resolve, _reject) => {
        let data = {};
        let toGet = dexex.length;
        let got = 0;
        const gotTest = (dexName, dexIndex, quote) => {
          console.log("gotTest")

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

          // console.log(data)


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

          // console.log(routePath, "routePath 154")

          // console.log('calling doTest', [token, routePath[routePathIndex + 1]]);

          doTest(
            dex,
            [token, routePath[routePathIndex + 1]],
            // latestQuote,
            amt,
            (quote) => gotTest('dex.name', dIndex, quote),
          );
          dexIndex++;
          if (stop) break;
        }
      });
      routePathIndex++;
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

  callback({
    profitable: !tradeAmt
      .sub(priceRouteData[priceRouteData.length - 1].quote)
      .isNeg(),
    dexRoute: priceRoute,
    dexRouteData: priceRouteData,
    quoteIn: tradeAmt,
    quoteOut: priceRouteData[priceRouteData.length - 1].quote,
  });
};

module.exports = getPriceFromRoute;
