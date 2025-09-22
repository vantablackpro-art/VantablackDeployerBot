import { ethers, upgrades } from 'hardhat'
import fs from "fs";
import path from "path";
import { VantablackDeployer } from "../typechain";
import dotenv from "dotenv";
import { parseEther } from 'ethers';
dotenv.config();

const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1"
const UNISWAP_V2_FACTORY = "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C"
const waitTime = 1000; // 1 second
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));



async function main() {
    const [owner] = await ethers.getSigners();
    console.log("Deploying with account:", owner.address);


    const ownerBalance = await ethers.provider.getBalance(owner.address);
    console.log("Deploying contracts with account:", owner.address);
    console.log("Account balance:", ethers.formatEther(ownerBalance));

    // Deploy UniswapV2Locker
    const UniswapV2Locker = await ethers.getContractFactory("UniswapV2Locker")
    const uniswapV2Locker = await UniswapV2Locker.deploy(UNISWAP_V2_FACTORY)
    await uniswapV2Locker.deploymentTransaction();
    console.log("UniswapV2Locker deployed at:", uniswapV2Locker.target);
    await sleep(waitTime); // Wait for 20 seconds to ensure balance is updated

    // Deploy LiquidityManager
    const LiquidityManager = await ethers.getContractFactory("LiquidityManager")
    const liquidityManager = await LiquidityManager.deploy(UNISWAP_V2_ROUTER)
    await liquidityManager.deploymentTransaction();
    console.log("LiquidityManager deployed at:", liquidityManager.target);
    await sleep(waitTime); // Wait for 20 seconds to ensure balance is updated

    // Deploy VantablackDeployer as upgradeable proxy
    const VantablackDeployer = await ethers.getContractFactory("VantablackDeployer")
    const vantablackDeployer = await upgrades.deployProxy(VantablackDeployer, [], {
        initializer: 'initialize'
    }) as VantablackDeployer
    console.log("VantablackDeployer deployed at:", vantablackDeployer.target);
    await sleep(waitTime); // Wait for 20 seconds to ensure balance is updated

    // Setup connections (use owner signer explicitly)
    await vantablackDeployer.connect(owner).setLiquidityManager(liquidityManager.target)
    await sleep(waitTime); // Wait for 20 seconds to ensure balance is updated

    // Transfer ownership of LiquidityManager to VantablackDeployer so it can manage it
    await liquidityManager.connect(owner).transferOwnership(vantablackDeployer.target)
    await sleep(waitTime); // Wait for 20 seconds to ensure balance is updated

    await vantablackDeployer.connect(owner).setUnicryptLocker(uniswapV2Locker.target)
    await sleep(waitTime); // Wait for 20 seconds to ensure balance is updated

    // Fund the deployer for LP, transfer 10 eth
    const fundAmount = parseEther("10")
    const txFund = await owner.sendTransaction({
        to: vantablackDeployer.target!,
        value: fundAmount
    })
    await txFund.wait()
    console.log(`Funded VantablackDeployer with ${ethers.formatEther(fundAmount)} ETH`);
    await sleep(waitTime); // Wait for 20 seconds to ensure balance is updated

    // Whitelist owner
    await vantablackDeployer.connect(owner).addToWhitelist(owner.address)
    await sleep(waitTime); // Wait for 20 seconds to ensure balance is updated

    // // Get VantablackDeployer contract (assume it's already deployed)
    // const vantablackDeployerAddress = process.env.VENTABLACK_DEPLOYER;
    // if (!vantablackDeployerAddress) {
    //     throw new Error("VENTABLACK_DEPLOYER environment variable not set");
    // }

    // const vantablackDeployer = await ethers.getContractAt("VantablackDeployer", vantablackDeployerAddress);

    // Extract parameters from deployArgs
    let name = "test";
    let symbol = "TST";
    let [tokenOwner, taxReceiver, router] = [owner.address, owner.address, UNISWAP_V2_ROUTER]; // owner and receiver
    let [buyFee, sellFee, transferFee, burnPercent] = [2, 3, 0, 0];
    let isVantablackFunded = await vantablackDeployer.canVantablackFund(owner.address);
    let lpManagementOption = 0;
    let hasFirstBuy = false;
    let firstBuyAmount = 0;
    let distributionAddress = "0x0000000000000000000000000000000000000000"
    let distribuitionPercent = 0;

    // Prepare deployment parameters for VantablackDeployer
    const amounts: [bigint, bigint, bigint] = [
        BigInt(firstBuyAmount || 0),        // firstBuyAmount
        BigInt(0),                       // lockDuration (1 hour default)
        BigInt(lpManagementOption || 0)     // lpManagementOption
    ];

    const addresses: [string, string, string, string] = [
        tokenOwner,      // owner
        taxReceiver, // treasury/tax receiver
        router,
        distributionAddress // distribution address
    ];

    const percents: [number, number, number, number, number] = [
        buyFee,     // buyFee
        sellFee,    // sellFee
        transferFee, // transferFee
        burnPercent,  // burnPercent
        distribuitionPercent  // distributionPercent
    ];

    const flags: [boolean, boolean] = [
        hasFirstBuy || false,        // hasFirstBuy
        lpManagementOption === 0,    // burnTokens
    ];

    const metadata: [string, string] = [name, symbol];

    // console.log('Deployment parameters:', {
    //     amounts,
    //     addresses,
    //     percents,
    //     flags,
    //     metadata
    // });

    // Calculate required ETH (for self-funded tokens)
    let ethValue = await vantablackDeployer.lpFundingAmount();
    // if (!isVantablackFunded) {
    //     const ethLP = deployArgs.ethLPAmount;
    //     ethValue = ethLP;
    //     console.log(`Self-funded deployment, sending ${ethers.formatEther(ethValue)} ETH`);
    // } else {
    //     console.log('Vantablack-funded deployment');
    // }

    // Check if deployer is whitelisted (for Vantablack funding)

    const isWhitelisted = await vantablackDeployer.isWhitelisted(owner.address);
    if (!isWhitelisted) {
        throw new Error(`Deployer ${owner.address} is not whitelisted for Vantablack funding`);
    }
    console.log('Deployer is whitelisted for Vantablack funding');

    console.log('Deploying with VantablackDeployer:', {
        amounts,
        addresses,
        percents,
        flags,
        metadata,
        ethValue: ethValue.toString()
    })


    // Deploy token through VantablackDeployer
    const tx = await vantablackDeployer.deployToken(
        amounts,
        addresses,
        percents,
        flags,
        metadata,
        { value: ethValue }
    );

    const receipt = await tx.wait()

    // Extract token address from events
    let deployedTokenAddress = null
    for (const log of receipt!.logs) {
        try {
            const parsed = vantablackDeployer.interface.parseLog(log)
            if (parsed && parsed.name === 'TokenDeployed') {
                deployedTokenAddress = parsed.args.tokenAddress
                break
            }
        } catch (e) {
            // Not a VantablackDeployer event, continue
        }
    }

    const r = await vantablackDeployer.deployedTokens(1)
    console.log("Deployed token address from mapping:", r)


    const txHash = tx.hash
    console.log({
        deployedTokenAddress,
        txHash
    })

    const lpFundingBalance = await vantablackDeployer.lpFundingBalance()
    console.log("Remaining LP funding balance in VantablackDeployer:", ethers.formatEther(lpFundingBalance));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });