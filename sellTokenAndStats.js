const { parseEther } = require("ethers");
const { ethers } = require("hardhat");
require('dotenv').config();

const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1" // UniSwap polygon
const UNISWAP_V2_FACTORY = "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C" // UniSwap polygon

async function main() {
    // Get command line arguments
    // const tokenAddress = process.argv[2];
    // const tokenAmount = process.argv[3] || "1000"; // Default 1000 tokens

    const tokenAddress = "0xd00e6648b61B59Bd1Bc33772e706a60Fa11c851a"
    const reflectionTokenAddress = "0x54307AecF7E097bd6745Eab05dECB762Dae7bEc3"


    if (!tokenAddress) {
        console.log("Usage: node sellTokenAndStats.js <TOKEN_ADDRESS> [TOKEN_AMOUNT]");
        console.log("Example: node sellTokenAndStats.js 0x1234... 1000");
        process.exit(1);
    }


    // Setup
    // const [signer] = await ethers.getSigners();
    const provider = ethers.provider;
    const signer = new ethers.Wallet("464f7b184f64e2b200469dff73be9f8b32770c3d354c622e20846efd1251b2e0", provider);

    // Contract addresses
    const VANTABLACK_DEPLOYER_ADDRESS = process.env.VENTABLACK_DEPLOYER;
    const UNISWAP_ROUTER = UNISWAP_V2_ROUTER;

    // Load ABIs
    const TokenAbi = require("./artifacts/contracts/Token.sol/Token.json").abi;
    const VantablackDeployerAbi = require("./artifacts/contracts/VantablackDeployer.sol/VantablackDeployer.json").abi;
    const RouterAbi = [
        "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        "function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)",
        "function WETH() external pure returns (address)",
        "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external"
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
    const router = new ethers.Contract(UNISWAP_ROUTER, RouterAbi, signer);
    const tokenAmount = await token.balanceOf(signer.address)
    // const tokenAmount = parseEther("1000")

    console.log(`\n💸 Selling ${tokenAmount} tokens of ${tokenAddress}`);
    console.log("=".repeat(80));


    try {
        // Get initial stats
        console.log("📊 BEFORE SALE:");
        await displayTokenStats(token, vantablackDeployer, signer.address, tokenAddress);
        await displayReflectionBalance(reflectionToken, signer.address, "BEFORE SALE");

        // Check user token balance
        const userBalance = await token.balanceOf(signer.address);
        const sellAmount = tokenAmount //ethers.parseEther(tokenAmount);

        if (userBalance < sellAmount) {
            console.log(`❌ Insufficient token balance. You have ${ethers.formatEther(userBalance)} tokens but trying to sell ${tokenAmount} tokens`);
            return;
        }

        // Get expected ETH output
        const weth = await router.WETH();
        const path = [tokenAddress, weth];
        try {
            const amountsOut = await router.getAmountsOut(sellAmount, path);
            const expectedETH = ethers.formatEther(amountsOut[1]);
            console.log(`💰 Expected ETH output: ${expectedETH} ETH`);
        } catch (error) {
            console.log("⚠️  Could not estimate ETH output:", error.message);
        }

        // Sell tokens
        console.log(`\n💸 SELLING TOKENS...`);
        const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes

        // // Always approve max amount to avoid approval issues
        console.log('Approving router to spend tokens...');
        const maxApproval = ethers.MaxUint256;

        // check allowance first
        // const currentAllowance = await token.allowance(signer.address, router.target);
        // if (currentAllowance.gte(sellAmount)) {
        //     console.log('✅ Sufficient allowance already granted to router');
        // } else {
        //     console.log('No or insufficient allowance, approving max amount...');
        //     const approveTx = await token.approve(router.target, maxApproval);
        //     await approveTx.wait();
        //     console.log('✅ Maximum approval confirmed');
        // }



        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            sellAmount,
            0, // Accept any amount of ETH (could be improved with slippage protection)
            path,
            signer.address,
            deadline
        );

        console.log(`Transaction hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Sale completed in block ${receipt.blockNumber}`);

        // Get updated stats
        console.log("\n📊 AFTER SALE:");
        await displayTokenStats(token, vantablackDeployer, signer.address, tokenAddress);
        await displayReflectionBalance(reflectionToken, signer.address, "AFTER SALE");

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
            "function token1() external view returns (address)",
            "function balanceOf(address owner) external view returns (uint256)",
            "function totalSupply() external view returns (uint256)"
        ], ethers.provider);

        const [reserve0, reserve1] = await pairContract.getReserves();
        const token0 = await pairContract.token0();
        const token1 = await pairContract.token1();

        // Determine which reserve is ETH (WETH) and which is token
        const routerContract = new ethers.Contract(UNISWAP_V2_ROUTER, ["function WETH() external pure returns (address)"], ethers.provider);
        const wethAddress = await routerContract.WETH();

        let ethReserve, tokenReserve;
        if (token0.toLowerCase() === wethAddress.toLowerCase()) {
            ethReserve = reserve0;
            tokenReserve = reserve1;
        } else {
            ethReserve = reserve1;
            tokenReserve = reserve0;
        }

        const tokenBalance = await token.balanceOf(lpPair);

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

            // Check if contract swap would exceed available ETH
            const contractBalance = await token.balanceOf(tokenAddress);
            if (contractBalance > 0) {
                const swapThreshold = 1000000; // 1M tokens from contract
                const contractBalanceNumber = Number(ethers.formatEther(contractBalance));
                const ethReserveNumber = Number(ethers.formatEther(ethReserve));
                const tokenReserveNumber = Number(ethers.formatEther(tokenReserve));

                if (contractBalanceNumber >= swapThreshold) {
                    // Calculate potential ETH output using constant product formula
                    const swapAmount = swapThreshold;
                    const ethOutput = (ethReserveNumber * swapAmount) / (tokenReserveNumber + swapAmount);
                    const percentOfEthReserve = (ethOutput / ethReserveNumber) * 100;

                    console.log(`\n⚠️  SWAP IMPACT ANALYSIS:`);
                    console.log(`   Contract Balance: ${contractBalanceNumber.toLocaleString()} tokens`);
                    console.log(`   Swap Threshold: ${swapThreshold.toLocaleString()} tokens`);
                    console.log(`   Estimated ETH Output: ${ethOutput.toFixed(6)} ETH`);
                    console.log(`   Impact on ETH Reserve: ${percentOfEthReserve.toFixed(2)}%`);

                    if (percentOfEthReserve > 90) {
                        console.log(`   ❌ WARNING: Swap would drain >90% of ETH reserves!`);
                    } else if (percentOfEthReserve > 50) {
                        console.log(`   ⚠️  CAUTION: Large swap impact (>50% of reserves)`);
                    } else {
                        console.log(`   ✅ Swap impact acceptable (<50% of reserves)`);
                    }
                }
            }
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

                const roiThreshold = ethers.parseEther("50"); // 1.5 ETH threshold
                const roiAchieved = taxBalance >= roiThreshold;

                console.log(`   Tax Collected: ${ethers.formatEther(taxBalance)} ETH`);
                console.log(`   ROI Threshold: ${ethers.formatEther(roiThreshold)} ETH`);
                console.log(`   ROI Achieved: ${roiAchieved ? '✅ YES' : '❌ NO'}`);
                console.log(`   Progress: ${((Number(ethers.formatEther(taxBalance)) / 50) * 100).toFixed(2)}%`);

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

        // User ETH balance
        const ethBalance = await ethers.provider.getBalance(userAddress);
        console.log(`\n💰 YOUR BALANCES:`);
        console.log(`   ETH: ${ethers.formatEther(ethBalance)} ETH`);
        console.log(`   ${symbol}: ${ethers.formatEther(userBalance)} tokens`);

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