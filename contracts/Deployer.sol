// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./Token.sol";
contract Deployer {
    function deployToken(
        address[5] memory addrs, // [owner, treasury, router, dividendTokenAddress]
        uint16[5] memory percents, // [buyFee, sellFee, transferFee, burnPercent, distributionRewardsPercent]
        bool[2] memory flags, // [hasFirstBuy, burnTokens]
        string[2] memory metadata // [name, symbol]
    ) external returns (address) {
        Token newToken = new Token(addrs, percents, metadata, flags[0]);
        return address(newToken);
    }
}
