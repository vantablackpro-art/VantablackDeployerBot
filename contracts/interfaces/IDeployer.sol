// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IDeployer {
    function deployToken(
        address[5] memory addrs, // [owner, treasury, router, dividendTokenAddress, vantablackDeployerAddress]
        uint16[5] memory percents, // [buyFee, sellFee, transferFee, burnPercent, distributionRewardsPercent]
        bool[2] memory flags, // [hasFirstBuy, burnTokens]
        string[2] memory metadata // [name, symbol]
    ) external returns (address);
}
