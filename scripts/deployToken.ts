import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { VantablackDeployer } from "../typechain";

async function main() {
    const chatId = process.env.chatID;
    const pk = process.env.pk;
    if (!chatId) {
        throw new Error("Missing chatID environment variable");
    }
    if (!pk) {
        throw new Error("Missing pk environment variable");
    }

    const [signer] = await ethers.getSigners();
    console.log("Deploying with account:", signer.address);

    const deployArgsPath = path.resolve(`./data/deployArgs-${chatId}.json`);
    if (!fs.existsSync(deployArgsPath)) {
        throw new Error(`Deployment args file not found: ${deployArgsPath}`);
    }

    const deployArgs = JSON.parse(fs.readFileSync(deployArgsPath, 'utf8'));
    console.log('Deploy args loaded:', deployArgs);

    // Get VantablackDeployer contract (assume it's already deployed)
    const vantablackDeployerAddress = process.env.VENTABLACK_DEPLOYER || process.env.VANTABLACK_DEPLOYER_ADDRESS;
    if (!vantablackDeployerAddress) {
        throw new Error("VENTABLACK_DEPLOYER environment variable not set");
    }

    const vantablackDeployer = await ethers.getContractAt("VantablackDeployer", vantablackDeployerAddress);

    // Extract parameters from deployArgs
    const {
        constructorArgs: [
            name,
            symbol,
            [owner, , taxReceiver], // router not used
            [buyFee, sellFee, transferFee, burnPercent],
            isVantablackFunded,
            lpManagementOption,
            hasFirstBuy,
            firstBuyAmount
        ]
    } = deployArgs;

    // Prepare deployment parameters for VantablackDeployer
    const amounts: [bigint, bigint, bigint] = [
        BigInt(firstBuyAmount || 0),        // firstBuyAmount
        BigInt(0),                       // lockDuration (1 hour default)
        BigInt(lpManagementOption || 0)     // lpManagementOption
    ];

    const addresses: [string, string] = [
        owner,      // owner
        taxReceiver // treasury/tax receiver
    ];

    const percents: [number, number, number, number] = [
        buyFee,     // buyFee
        sellFee,    // sellFee
        transferFee, // transferFee
        burnPercent  // burnPercent
    ];

    const flags: [boolean, boolean, boolean] = [
        hasFirstBuy || false,        // hasFirstBuy
        lpManagementOption === 0,    // burnTokens
        lpManagementOption === 1 || lpManagementOption === 2, // lockTokens
    ];

    const metadata: [string, string] = [name, symbol];

    console.log('Deployment parameters:', {
        amounts,
        addresses,
        percents,
        flags,
        metadata
    });

    // Calculate required ETH (for self-funded tokens)
    let ethValue = "0";
    if (!isVantablackFunded) {
        const ethLP = deployArgs.ethLPAmount;
        ethValue = ethLP;
        console.log(`Self-funded deployment, sending ${ethers.formatEther(ethValue)} ETH`);
    } else {
        console.log('Vantablack-funded deployment');
    }

    // Check if deployer is whitelisted (for Vantablack funding)

    const isWhitelisted = await vantablackDeployer.isWhitelisted(signer.address);
    if (!isWhitelisted) {
        throw new Error(`Deployer ${signer.address} is not whitelisted for Vantablack funding`);
    }
    console.log('Deployer is whitelisted for Vantablack funding');


    // Deploy token through VantablackDeployer
    const tx = await vantablackDeployer.deployToken(
        amounts,
        addresses,
        percents,
        flags,
        metadata,
        { value: ethValue }
    );

    console.log("Deployment transaction hash:", tx.hash);
    const receipt = await tx.wait();
    if (!receipt) {
        throw new Error("Transaction failed - no receipt");
    }
    console.log("Transaction confirmed in block:", receipt.blockNumber);

    // Extract token address from events
    let tokenAddress: string | undefined;
    for (const log of receipt.logs) {
        try {
            const parsed = vantablackDeployer.interface.parseLog({
                topics: log.topics,
                data: log.data
            });
            if (parsed && parsed.name === 'TokenDeployed') {
                tokenAddress = parsed.args.tokenAddress;
                break;
            }
        } catch (e) {
            // Not a VantablackDeployer event, continue
        }
    }

    if (!tokenAddress) {
        // Fallback: get deployed tokens count and derive address
        const tokenCount = await vantablackDeployer.deployedTokensCount();
        const deployedToken = await vantablackDeployer.deployedTokens(tokenCount);
        tokenAddress = deployedToken.tokenAddress;
    }

    if (!tokenAddress) {
        throw new Error("Could not extract token address from deployment transaction");
    }

    console.log("Token deployed at:", tokenAddress);

    // Update the deployment args file with results
    const result = {
        ...deployArgs,
        tokenAddress,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString() || '0',
        success: true
    };

    fs.writeFileSync(deployArgsPath, JSON.stringify(result, null, 2));
    console.log("Deployment completed successfully");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });