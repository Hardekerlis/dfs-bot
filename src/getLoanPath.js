const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const BN = require('bn.js');

const web3 = new Web3(new HDWalletProvider(global.privateKey, global.rpcUrl));

const pancakeAbis = require('../abis/pancake.json');
const pancakeAddresses = require('../addresses/pancake.json');

const pancake = {
  factory: new web3.eth.Contract(pancakeAbis.factory, pancakeAddresses.factory),
  router: new web3.eth.Contract(pancakeAbis.router, pancakeAddresses.router),
};

const ibep20Abi = require('../abis/IBEP20.json');

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const getLoanPath = async (token0, token1, tradeAmt) => {
  if (!web3.utils.isAddress(token0) || !web3.utils.isAddress(token1)) {
    throw new Error('Token0 and token1 must be valid addresses');
  }

  if (token0 !== WBNB && token1 !== WBNB) {
    throw new Error('One of the tokens must be WBNB');
  }

  if (new BN(tradeAmt).lte(0)) {
    throw Error('Trade amount must be greater than zero');
  }

  const pairAddress = await pancake.factory.methods
    .getPair(token0, token1)
    .call();
  const pairContract = new web3.eth.Contract(pancakeAbis.pair, pairAddress);

  const pairToken0 = await pairContract.methods.token0().call();
  const pairToken1 = await pairContract.methods.token1().call();

  const data = [];

  data[0] = pairToken0 === WBNB ? tradeAmt : 0;
  data[1] = pairToken1 === WBNB ? tradeAmt : 0;

  return data;
};

module.exports = getLoanPath;
