require('dotenv').config();
const { logger } = require('./utils/logger.js');
const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');

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

const getPairs = async () => {
  logger.info('Gettings pairs');

  console.log(await pancake.factory.methods.allPairs(0).call());
};

module.exports = getPairs;
