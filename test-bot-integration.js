// Test script for bot integration with deployed contracts
const { ethers } = require("ethers");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

async function testBotIntegration() {
    console.log("🧪 Testing Bot Integration with Deployed Contracts\n");
    
    // Check environment variables
    const requiredEnvVars = {
        'VENTABLACK_DEPLOYER': process.env.VENTABLACK_DEPLOYER,
        'LIQUIDITY_MANAGER': process.env.LIQUIDITY_MANAGER,
        'UNISWAP_V2_LOCKER': process.env.UNISWAP_V2_LOCKER,
        'BOT_TOKEN': process.env.BOT_TOKEN,
        'DEBUG_PVKEY': process.env.DEBUG_PVKEY
    };
    
    console.log("📋 Environment Variables Check:");
    let allVarsPresent = true;
    
    for (const [key, value] of Object.entries(requiredEnvVars)) {
        const status = value ? '✅' : '❌';
        console.log(`${status} ${key}: ${value ? `${value.substring(0, 10)}...` : 'MISSING'}`);
        if (!value && key !== 'DEBUG_PVKEY') {
            allVarsPresent = false;
        }
    }
    
    if (!allVarsPresent) {
        console.log("\n❌ Missing required environment variables. Please update .env file.");
        return false;
    }
    
    // Test RPC connection
    console.log("\n🌐 Testing RPC Connection:");
    try {
        const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
        const blockNumber = await provider.getBlockNumber();
        console.log(`✅ Sepolia RPC: Connected (Block ${blockNumber})`);
    } catch (error) {
        console.log(`❌ Sepolia RPC: Failed - ${error.message}`);
        return false;
    }
    
    // Test contract connections
    console.log("\n📄 Testing Contract Connections:");
    const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
    
    const contracts = {
        'VantablackDeployer': process.env.VENTABLACK_DEPLOYER,
        'LiquidityManager': process.env.LIQUIDITY_MANAGER,
        'UniswapV2Locker': process.env.UNISWAP_V2_LOCKER
    };
    
    for (const [name, address] of Object.entries(contracts)) {
        try {
            const code = await provider.getCode(address);
            if (code === '0x') {
                console.log(`❌ ${name}: No contract at ${address}`);
                return false;
            } else {
                console.log(`✅ ${name}: Contract found at ${address.substring(0, 10)}...`);
            }
        } catch (error) {
            console.log(`❌ ${name}: Error - ${error.message}`);
            return false;
        }
    }
    
    // Test VantablackDeployer specific functions
    console.log("\n🔧 Testing VantablackDeployer Functions:");
    try {
        // Load ABI
        const VantablackDeployerArtifact = require("./resources/VantablackDeployerArtifact.json");
        const vantablackDeployer = new ethers.Contract(
            process.env.VENTABLACK_DEPLOYER,
            VantablackDeployerArtifact.abi,
            provider
        );
        
        // Test basic read functions
        const deployedTokensCount = await vantablackDeployer.deployedTokensCount();
        console.log(`✅ deployedTokensCount(): ${deployedTokensCount}`);
        
        const lpFundingAmount = await vantablackDeployer.lpFundingAmount();
        console.log(`✅ lpFundingAmount(): ${ethers.formatEther(lpFundingAmount)} ETH`);
        
        const maxFee = await vantablackDeployer.MAX_FEE();
        console.log(`✅ MAX_FEE(): ${maxFee / 100}%`);
        
        // Test with debug wallet if available
        if (process.env.DEBUG_PVKEY) {
            const debugWallet = new ethers.Wallet(process.env.DEBUG_PVKEY);
            const isWhitelisted = await vantablackDeployer.isWhitelisted(debugWallet.address);
            console.log(`✅ isWhitelisted(${debugWallet.address.substring(0, 10)}...): ${isWhitelisted}`);
        }
        
    } catch (error) {
        console.log(`❌ VantablackDeployer function test failed: ${error.message}`);
        return false;
    }
    
    // Test bot file loading
    console.log("\n🤖 Testing Bot File Structure:");
    const fs = require('fs');
    const requiredFiles = [
        './index.js',
        './resources/TokenArtifact.json',
        './resources/VantablackDeployerArtifact.json',
        './resources/UniswapV2Router.json'
    ];
    
    for (const file of requiredFiles) {
        if (fs.existsSync(file)) {
            console.log(`✅ ${file}: Found`);
        } else {
            console.log(`❌ ${file}: Missing`);
            return false;
        }
    }
    
    console.log("\n🎉 All integration tests passed!");
    console.log("\nNext steps:");
    console.log("1. Run 'node index.js' to start the telegram bot");
    console.log("2. Test basic bot functions like /start and wallet connection");
    console.log("3. Test token deployment with a small amount on Sepolia testnet");
    console.log("4. Verify LP management functions work correctly");
    
    return true;
}

// Helper function to validate Telegram bot token format
function isValidTelegramToken(token) {
    return /^\d{8,10}:[a-zA-Z0-9_-]{35}$/.test(token);
}

// Run the test
if (require.main === module) {
    testBotIntegration()
        .then(success => {
            if (success) {
                console.log("\n✅ Integration test completed successfully");
                process.exit(0);
            } else {
                console.log("\n❌ Integration test failed");
                process.exit(1);
            }
        })
        .catch(error => {
            console.error("\n💥 Integration test crashed:", error);
            process.exit(1);
        });
}

module.exports = { testBotIntegration };