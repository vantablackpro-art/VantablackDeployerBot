// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUniswapV2Router {
    address public factory;
    address public WETH;

    uint256 private _amountA = 100 ether;
    uint256 private _amountB = 10 ether;
    uint256 private _liquidity = 50 ether;

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }

    function setFactory(address _factory) external {
        factory = _factory;
    }

    function setRemoveLiquidityResults(uint256 amountA, uint256 amountB) external {
        _amountA = amountA;
        _amountB = amountB;
    }

    function setAddLiquidityResult(uint256 liquidity) external {
        _liquidity = liquidity;
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        // Transfer tokens from sender
        IERC20(token).transferFrom(msg.sender, address(this), amountTokenDesired);

        // Return mock values
        amountToken = amountTokenDesired;
        amountETH = msg.value;
        liquidity = _liquidity;
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB) {
        // Transfer LP tokens from sender
        IERC20(tokenA).transferFrom(msg.sender, address(this), liquidity);

        // Transfer tokens to recipient
        IERC20(tokenA).transfer(to, _amountA);
        IERC20(tokenB).transfer(to, _amountB);

        return (_amountA, _amountB);
    }

    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountToken, uint256 amountETH) {
        // Transfer LP tokens from sender
        IERC20(token).transferFrom(msg.sender, address(this), liquidity);

        // Transfer tokens to recipient
        IERC20(token).transfer(to, _amountA);

        // Transfer ETH to recipient
        payable(to).transfer(_amountB);

        return (_amountA, _amountB);
    }

    // Allow contract to receive ETH
    receive() external payable {}
}