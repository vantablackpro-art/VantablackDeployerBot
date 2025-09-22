const constructorArgs = [
    [
        "0xC7182B7603BBbb8F5DEEFebf24c8a29d35036748", // owner
        "0xC7182B7603BBbb8F5DEEFebf24c8a29d35036748", // treasury
        "0xedf6066a2b290C185783862C7F4776A2C8077AD1", // router
        "0x0000000000000000000000000000000000000000", // dividendTokenAddress
        "0xb66E6e5fD683E65693E71434CA4D2e3e3662E507" // vantablack deployer
    ],
    [
        200, // buyFee (example, update with correct values!)
        300, // sellFee
        0,   // transferFee
        0,   // burnPercent
        0  // distributionRewardsPercent
    ],
    ["T10", "T10"], // metadata [name, symbol]
    false // hasFirstBuy
];

export default constructorArgs;
