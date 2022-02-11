// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "@openzeppelin/contracts/utils/Strings.sol";

import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Callee.sol";

import "./interfaces/IPancakeRouter02.sol";
import "./interfaces/IPancakeFactory.sol";
import "./interfaces/IPancakePair.sol";
import "./interfaces/IBEP20.sol";
import "./interfaces/IPancakeCallee.sol";

import "./libraries/Ownable.sol";
import "./libraries/SafeMath.sol";
import "./libraries/Ownable.sol";
import "./libraries/UniswapV2Library.sol";
import "./libraries/PancakeLibrary.sol";
contract Trader is IPancakeCallee {
  using SafeMath for uint;

  IPancakeRouter02 public pancakeRouter;
  address public pancakeFactory;

  IUniswapV2Router02 public sushiRouter;
  address public sushiFactory;

  enum Direction { PANCAKE_TO_SUSHI, SUSHI_TO_PANCAKE }

  constructor(IPancakeRouter02 _pancakeRouter, address _pancakeFactory, IUniswapV2Router02 _sushiRouter, address _sushiFactory) public {
    pancakeRouter = IPancakeRouter02(_pancakeRouter);
    pancakeFactory = _pancakeFactory;

    sushiRouter = IUniswapV2Router02(_sushiRouter);
    sushiFactory = _sushiFactory;
  }

  function swap(address[] calldata _path, Direction[] calldata _directions, uint _amount0) external  {

    address pairAddress = IPancakeFactory(pancakeFactory).getPair(_path[0], _path[1]);

    require(pairAddress != address(0), "This pools doesn't exist");

    IPancakePair(pairAddress).swap(
        _amount0,
        0,
        address(this),
        abi.encode(_path, _directions)
    );
  }

  function toAsciiString(address x) internal pure returns (string memory) {
    bytes memory s = new bytes(40);
    for (uint i = 0; i < 20; i++) {
        bytes1 b = bytes1(uint8(uint(uint160(x)) / (2**(8*(19 - i)))));
        bytes1 hi = bytes1(uint8(b) / 16);
        bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
        s[2*i] = char(hi);
        s[2*i+1] = char(lo);
    }
    return string(s);
  }

  function char(bytes1 b) internal pure returns (bytes1 c) {
      if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
      else return bytes1(uint8(b) + 0x57);
  }


  function pancakeCall(
    address _sender,
    uint _amount0,
    uint _amount1,
    bytes calldata _data
  ) external override {
    (address[] memory path, Direction[] memory directions) = abi.decode(_data, (address[], Direction[]));

    for(uint index = 0; index < path.length - 1; index++) {
      IBEP20 token = IBEP20(path[index]);
      uint balanceOf = token.balanceOf(address(this));

      if(directions[index] == Direction.PANCAKE_TO_SUSHI) {
        token.approve(address(sushiRouter), balanceOf);

        address[] memory currentPath = new address[](2);
        currentPath[0] = path[index];
        currentPath[1] = path[index+1];

        uint amountOut = UniswapV2Library.getAmountsOut(
          sushiFactory,
          balanceOf,
          currentPath
        )[1];


        sushiRouter.swapExactTokensForTokens(
          balanceOf,
          amountOut,
          currentPath,
          msg.sender,
          block.timestamp
        );
        // require(false, Strings.toString(index));

      }else {

      }
    }

    uint balance = address(this).balance;

    require(false, Strings.toString(balance));

  }
}

// 9xmtg2GV554s8s
