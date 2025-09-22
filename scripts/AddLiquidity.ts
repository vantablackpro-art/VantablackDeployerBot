import { ethers } from 'hardhat'
import dotenv from "dotenv";
import { parseEther, formatEther } from 'ethers';
dotenv.config();

// Uniswap V2 Router address (Base network)
const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1"

// Interface for Uniswap V2 Router
const UNISWAP_V2_ROUTER_ABI = [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
    "function WETH() external pure returns (address)"
];

// ERC20 Interface
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)"
];

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Adding liquidity with account:", deployer.address);
    
    // Configuration - Update these values before running
    const TOKEN_ADDRESS = "0x54307AecF7E097bd6745Eab05dECB762Dae7bEc3"; // Set your token address
    const TOKEN_AMOUNT = "1000000000"; // Amount of tokens to add (in token units)
    const ETH_AMOUNT = "1"; // Amount of ETH to add
    const SLIPPAGE_PERCENT = 2; // 2% slippage tolerance
    
    if (!TOKEN_ADDRESS) {
        throw new Error("Please set TOKEN_ADDRESS in your .env file");
    }
    
    // Get current balance
    const ethBalance = await ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", formatEther(ethBalance));
    
    // Connect to token contract
    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, deployer);
    const tokenBalance = await token.balanceOf(deployer.address);
    const decimals = await token.decimals();
    const tokenSymbol = await token.symbol();
    const tokenName = await token.name();
    
    console.log(`\nToken Details:`);
    console.log(`Name: ${tokenName}`);
    console.log(`Symbol: ${tokenSymbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Balance: ${ethers.formatUnits(tokenBalance, decimals)} ${tokenSymbol}`);
    
    // Parse amounts
    const tokenAmountWei = ethers.parseUnits(TOKEN_AMOUNT, decimals);
    const ethAmountWei = parseEther(ETH_AMOUNT);
    
    // Check if we have enough balance
    if (tokenBalance < tokenAmountWei) {
        throw new Error(`Insufficient token balance. Need: ${TOKEN_AMOUNT} ${tokenSymbol}, Have: ${ethers.formatUnits(tokenBalance, decimals)}`);
    }
    
    if (ethBalance < ethAmountWei) {
        throw new Error(`Insufficient ETH balance. Need: ${ETH_AMOUNT} ETH, Have: ${formatEther(ethBalance)}`);
    }
    
    // Connect to Uniswap V2 Router
    const router = new ethers.Contract(UNISWAP_V2_ROUTER, UNISWAP_V2_ROUTER_ABI, deployer);
    
    console.log(`\nAdding Liquidity:`);
    console.log(`Token Amount: ${TOKEN_AMOUNT} ${tokenSymbol}`);
    console.log(`ETH Amount: ${ETH_AMOUNT} ETH`);
    console.log(`Slippage: ${SLIPPAGE_PERCENT}%`);
    
    // Calculate minimum amounts with slippage protection
    const amountTokenMin = tokenAmountWei * BigInt(100 - SLIPPAGE_PERCENT) / BigInt(100);
    const amountETHMin = ethAmountWei * BigInt(100 - SLIPPAGE_PERCENT) / BigInt(100);
    
    console.log(`\nMinimum amounts (with ${SLIPPAGE_PERCENT}% slippage protection):`);
    console.log(`Min Token Amount: ${ethers.formatUnits(amountTokenMin, decimals)} ${tokenSymbol}`);
    console.log(`Min ETH Amount: ${formatEther(amountETHMin)} ETH`);
    
    // Step 1: Approve tokens for router
    console.log(`\n1. Approving ${TOKEN_AMOUNT} ${tokenSymbol} for router...`);
    const approveTx = await token.approve(UNISWAP_V2_ROUTER, tokenAmountWei);
    await approveTx.wait();
    console.log(`   ✅ Approval confirmed: ${approveTx.hash}`);
    
    // Step 2: Add liquidity
    console.log(`\n2. Adding liquidity...`);
    
    // Set deadline (10 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + 600;
    
    try {
        const addLiquidityTx = await router.addLiquidityETH(
            TOKEN_ADDRESS,        // token
            tokenAmountWei,       // amountTokenDesired
            amountTokenMin,       // amountTokenMin
            amountETHMin,         // amountETHMin
            deployer.address,     // to (recipient of LP tokens)
            deadline,             // deadline
            { value: ethAmountWei } // ETH amount to send
        );
        
        console.log(`   ⏳ Transaction submitted: ${addLiquidityTx.hash}`);
        console.log(`   ⏳ Waiting for confirmation...`);
        
        const receipt = await addLiquidityTx.wait();
        console.log(`   ✅ Liquidity added successfully!`);
        console.log(`   📊 Gas used: ${receipt!.gasUsed.toString()}`);
        console.log(`   🔗 Transaction: ${addLiquidityTx.hash}`);
        
        // Get the liquidity amount from events (optional)
        for (const log of receipt!.logs) {
            try {
                const parsed = router.interface.parseLog(log);
                if (parsed && parsed.name === 'AddLiquidity') {
                    console.log(`   💧 LP tokens received: ${parsed.args.liquidity.toString()}`);
                }
            } catch (e) {
                // Not a router event, continue
            }
        }
        
    } catch (error) {
        console.error(`❌ Failed to add liquidity:`, error);
        
        if (error instanceof Error && error.message.includes("INSUFFICIENT_")) {
            console.log(`\n💡 Troubleshooting tips:`);
            console.log(`   • Make sure the token has been deployed with initial liquidity`);
            console.log(`   • Check if there's existing liquidity for this token pair`);
            console.log(`   • Try reducing the token amount or ETH amount`);
            console.log(`   • Increase slippage tolerance if markets are volatile`);
        }
        
        throw error;
    }
    
    // Check final balances
    console.log(`\n📈 Final Balances:`);
    const finalEthBalance = await ethers.provider.getBalance(deployer.address);
    const finalTokenBalance = await token.balanceOf(deployer.address);
    
    console.log(`ETH: ${formatEther(finalEthBalance)} (was ${formatEther(ethBalance)})`);
    console.log(`${tokenSymbol}: ${ethers.formatUnits(finalTokenBalance, decimals)} (was ${ethers.formatUnits(tokenBalance, decimals)})`);
}

main()
    .then(() => {
        console.log("\n🎉 Liquidity addition completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });