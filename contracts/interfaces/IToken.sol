// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

struct TokenAddresses {
    address lpPair;
    address treasury;
    address dividendToken;
}
interface IToken {
    function getAddresses() external view returns (TokenAddresses memory);
}
