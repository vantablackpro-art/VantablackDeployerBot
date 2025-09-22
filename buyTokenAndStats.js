const { ethers } = require("hardhat");
require('dotenv').config();

// const UNISWAP_V2_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff" // QuickSwap
// const UNISWAP_V2_FACTORY = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32" // QuickSwap

const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1" // UniSwap polygon
const UNISWAP_V2_FACTORY = "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C" // UniSwap polygon

async function main() {
    // Get command line arguments
    // const tokenAddress = process.argv[2];
    // const ethAmount = process.argv[3] || "0.01"; // Default 0.01 ETH
    const tokenAddress = "0x115CC1aBfe001834878e11E61810bF987FDE3718"
    const reflectionTokenAddress = "0x54307AecF7E097bd6745Eab05dECB762Dae7bEc3"
    const ethAmount = "30"

    if (!tokenAddress) {
        console.log("Usage: node buyTokenAndStats.js <TOKEN_ADDRESS> [ETH_AMOUNT]");
        console.log("Example: node buyTokenAndStats.js 0x1234... 0.01");
        process.exit(1);
    }

    console.log(`\n🚀 Buying ${ethAmount} ETH worth of tokens from ${tokenAddress}`);
    // console.log("="=".repeat(80));

    // Setup
    // const [signer] = await ethers.getSigners();
    const provider = ethers.provider;
    const signer = new ethers.Wallet("464f7b184f64e2b200469dff73be9f8b32770c3d354c622e20846efd1251b2e0", provider);

    // Contract addresses
    const VANTABLACK_DEPLOYER_ADDRESS = process.env.VENTABLACK_DEPLOYER;

    // Load ABIs
    const TokenAbi = require("./artifacts/contracts/Token.sol/Token.json").abi;
    const VantablackDeployerAbi = require("./artifacts/contracts/VantablackDeployer.sol/VantablackDeployer.json").abi;
    const RouterAbi = [
        "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
        "function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)",
        "function WETH() external pure returns (address)"
    ];

    const PairAbi = [
        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
        "function token0() external view returns (address)",
        "function token1() external view returns (address)"
    ];

    // Initialize contracts
    const token = new ethers.Contract(tokenAddress, TokenAbi, signer);
    const reflectionToken = new ethers.Contract(reflectionTokenAddress, TokenAbi, signer);
    const vantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider);
    const router = new ethers.Contract(UNISWAP_V2_ROUTER, RouterAbi, signer);

    try {
        // Get initial stats
        console.log("📊 BEFORE PURCHASE:");
        await displayTokenStats(token, vantablackDeployer, signer.address, tokenAddress);
        await displayReflectionBalance(reflectionToken, signer.address, "BEFORE PURCHASE");

        // Buy tokens
        console.log(`\n💰 PURCHASING TOKENS...`);
        const weth = await router.WETH();
        const path = [weth, tokenAddress];
        const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes

        const tx = await router.swapExactETHForTokens(
            0, // Accept any amount of tokens
            path,
            signer.address,
            deadline,
            { value: ethers.parseEther(ethAmount) }
        );

        console.log(`Transaction hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Purchase completed in block ${receipt.blockNumber}`);

        // Get updated stats
        console.log("\n📊 AFTER PURCHASE:");
        await displayTokenStats(token, vantablackDeployer, signer.address, tokenAddress);
        await displayReflectionBalance(reflectionToken, signer.address, "AFTER PURCHASE");

    } catch (error) {
        console.error("❌ Error:", error.message);
        if (error.reason) console.error("Reason:", error.reason);
    }
}

async function displayTokenStats(token, vantablackDeployer, userAddress, tokenAddress) {
    try {
        // Basic token info
        const name = await token.name();
        const symbol = await token.symbol();
        const totalSupply = await token.totalSupply();
        const userBalance = await token.balanceOf(userAddress);
        const contractTokenBalance = await token.balanceOf(tokenAddress);

        console.log(`\n🪙 TOKEN INFO:`);
        console.log(`   Name: ${name} (${symbol})`);
        console.log(`   Address: ${tokenAddress}`);
        console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} tokens`);
        console.log(`   Your Balance: ${ethers.formatEther(userBalance)} tokens`);
        console.log(`   Contract Token Balance: ${ethers.formatEther(contractTokenBalance)} tokens`);

        // LP and liquidity info
        const addresses = await token.getAddresses();
        const lpPair = addresses.lpPair;
        const treasury = addresses.treasury;

        // Get detailed pool reserves using pair contract
        const pairContract = new ethers.Contract(lpPair, [
            "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
            "function token0() external view returns (address)",
            "function token1() external view returns (address)"
        ], ethers.provider);

        const [reserve0, reserve1] = await pairContract.getReserves();
        const token0 = await pairContract.token0();
        const token1 = await pairContract.token1();

        // Determine which reserve is ETH (WETH) and which is token
        const routerContract = new ethers.Contract("0xedf6066a2b290C185783862C7F4776A2C8077AD1", ["function WETH() external pure returns (address)"], ethers.provider);
        const wethAddress = await routerContract.WETH();

        let ethReserve, tokenReserve;
        if (token0.toLowerCase() === wethAddress.toLowerCase()) {
            ethReserve = reserve0;
            tokenReserve = reserve1;
        } else {
            ethReserve = reserve1;
            tokenReserve = reserve0;
        }

        console.log(`\n💧 LIQUIDITY INFO:`);
        console.log(`   LP Pair: ${lpPair}`);
        console.log(`   ETH Reserve (Pair): ${ethers.formatEther(ethReserve)} ETH`);
        console.log(`   Token Reserve (Pair): ${ethers.formatEther(tokenReserve)} tokens`);
        console.log(`   Treasury: ${treasury}`);

        // Calculate pool ratio and impact
        if (ethReserve > 0 && tokenReserve > 0) {
            const pricePerToken = Number(ethers.formatEther(ethReserve)) / Number(ethers.formatEther(tokenReserve));
            console.log(`\n💹 POOL METRICS:`);
            console.log(`   Price per Token: ${pricePerToken.toExponential(4)} ETH`);
            console.log(`   Pool Health: ${ethReserve > 0 ? '✅ Has ETH liquidity' : '❌ No ETH liquidity'}`);
        } else {
            console.log(`\n💹 POOL METRICS:`);
            console.log(`   Pool Health: ❌ Empty pool or no reserves`);
        }

        // Tax and handover info
        console.log(`\n💸 TAX & HANDOVER STATUS:`);
        try {
            const isVantablackToken = await vantablackDeployer.isTokenDeployedByVantablack(tokenAddress);
            if (isVantablackToken) {
                const taxBalance = await vantablackDeployer.getProjectTaxBalance(tokenAddress);
                const lpLockInfo = await vantablackDeployer.getLPLockInfo(tokenAddress);

                const roiThreshold = ethers.parseEther("1.5"); // 1.5 ETH threshold
                const roiAchieved = taxBalance >= roiThreshold;

                console.log(`   Tax Collected: ${ethers.formatEther(taxBalance)} ETH`);
                console.log(`   ROI Threshold: ${ethers.formatEther(roiThreshold)} ETH`);
                console.log(`   ROI Achieved: ${roiAchieved ? '✅ YES' : '❌ NO'}`);
                console.log(`   Progress: ${((Number(ethers.formatEther(taxBalance)) / 1.5) * 100).toFixed(2)}%`);

                // LP Management info
                const managementTexts = {
                    0: "🔥 Burn LP",
                    1: "🔒 Lock 1 Month (Unicrypt)",
                    2: "🔐 Lock 6 Months (Unicrypt)",
                    3: "⏱️ Lock 1 Minute (Testing)",
                    4: "⏰ Lock 5 Minutes (Testing)"
                };

                console.log(`\n🔒 LP MANAGEMENT:`);
                console.log(`   Option: ${managementTexts[lpLockInfo.lpManagementOption] || 'Unknown'}`);
                console.log(`   Lock Duration: ${lpLockInfo.lockDuration} seconds`);

                const isLocked = lpLockInfo.lockDuration > 0;

                if (isLocked && lpLockInfo.lpLockExpiry > 0) {
                    const now = Math.floor(Date.now() / 1000);
                    const timeRemaining = lpLockInfo.lpLockExpiry - now;
                    const expiredDate = new Date(lpLockInfo.lpLockExpiry * 1000);

                    console.log(`   Lock Expiry: ${expiredDate.toLocaleString()}`);
                    if (timeRemaining > 0) {
                        const hours = Math.floor(timeRemaining / 3600);
                        const minutes = Math.floor((timeRemaining % 3600) / 60);
                        const seconds = timeRemaining % 60;
                        console.log(`   Time Remaining: ${hours}h ${minutes}m ${seconds}s`);
                        console.log(`   Status: 🔒 LOCKED`);
                    } else {
                        console.log(`   Status: 🔓 UNLOCKED`);
                    }
                } else {
                    console.log(`   Status: ⏳ Not locked yet (${roiAchieved ? 'Handover executed' : 'Waiting for handover'})`);
                }
            } else {
                console.log(`   ❌ Not a Vantablack deployed token`);
            }
        } catch (error) {
            console.log(`   ❌ Could not fetch Vantablack info: ${error.message}`);
        }

        // Current taxes
        try {
            const currentTaxes = await token.getCurrentTaxes();
            const deploymentTime = currentTaxes[3] > 0 ? "Active" : "Completed";

            console.log(`\n📈 CURRENT TAXES:`);
            console.log(`   Buy Tax: ${(Number(currentTaxes[0]) / 100).toFixed(2)}%`);
            console.log(`   Sell Tax: ${(Number(currentTaxes[1]) / 100).toFixed(2)}%`);
            console.log(`   Transfer Tax: ${(Number(currentTaxes[2]) / 100).toFixed(2)}%`);
            console.log(`   Tax Reduction: ${deploymentTime}`);
            if (currentTaxes[3] > 0) {
                const minutes = Math.floor(Number(currentTaxes[3]) / 60);
                console.log(`   Time Until Reduction: ${minutes}m ${Number(currentTaxes[3]) % 60}s`);
            }
        } catch (error) {
            console.log(`   ❌ Could not fetch current taxes: ${error.message}`);
        }

        // Platform info
        try {
            const platformAddress = await token.getPlatformAddress();
            const tokenOwner = await token.owner();

            // Get LP owner from deployedTokens mapping
            let lpOwner = "N/A";
            try {
                const isVantablackToken = await vantablackDeployer.isTokenDeployedByVantablack(tokenAddress);
                if (isVantablackToken) {
                    const tokenId = await vantablackDeployer.deployedTokensIds(tokenAddress);
                    const deployedToken = await vantablackDeployer.deployedTokens(tokenId);
                    lpOwner = deployedToken.lpOwner || "Not set";
                } else {
                    lpOwner = "Not a Vantablack token";
                }
            } catch (error) {
                lpOwner = `Error fetching: ${error.message}`;
            }

            console.log(`\n🏢 PLATFORM INFO:`);
            console.log(`   Platform Address: ${platformAddress}`);
            console.log(`   Token Owner: ${tokenOwner}`);
            console.log(`   LP Owner: ${lpOwner}`);
        } catch (error) {
            console.log(`   ❌ Could not fetch platform info: ${error.message}`);
        }

    } catch (error) {
        console.error("❌ Error fetching token stats:", error.message);
    }
}

async function displayReflectionBalance(reflectionToken, userAddress, phase) {
    try {
        const balance = await reflectionToken.balanceOf(userAddress);
        const symbol = await reflectionToken.symbol();
        const name = await reflectionToken.name();

        console.log(`\n🪙 REFLECTION TOKEN ${phase}:`);
        console.log(`   Token: ${name} (${symbol})`);
        console.log(`   Your Balance: ${ethers.formatEther(balance)} ${symbol}`);

    } catch (error) {
        console.log(`   ❌ Could not fetch reflection token balance: ${error.message}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });