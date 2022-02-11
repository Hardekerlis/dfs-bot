// const ExecuteArbitrage = artifacts.require('./arbitrage/ExecuteArbitrage.sol');
const Trader = artifacts.require('./Trader.sol');

module.exports = function (deployer) {
  try {
    // deployer.deploy(
    //   ExecuteArbitrage,
    //   '0x10ED43C718714eb63d5aA57B78B54704E256024E', // Pancake router
    //   '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Sushi router
    // );

    deployer.deploy(
      Trader,
      '0x10ED43C718714eb63d5aA57B78B54704E256024E', // Pancake router
      '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // Pancake factory
      '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Sushi router
      '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', // Sushi factory
    );
  } catch (err) {
    console.error(err);
  }
};

// 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c WBNB
// 0x8301f2213c0eed49a7e28ae4c3e91722919b8b47 BUSD
