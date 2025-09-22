import { ethers, upgrades } from "hardhat";

async function main() {
    // Get the signer
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    console.log("🔧 Deployer address:", deployerAddress);

    // STEP 1: Find the exact nonce sequence used in the canceled proxy deployment
    // Proxy deployment typically uses 2-3 nonces:
    // 1. Deploy implementation contract
    // 2. Deploy ProxyAdmin (if not already deployed)
    // 3. Deploy TransparentUpgradeableProxy

    const canceledProxyNonce = 161; // Replace with the nonce that created the proxy contract (usually the highest nonce from the deployment)
    console.log("📋 Using proxy nonce from canceled deployment:", canceledProxyNonce);

    // For proxy deployments, we need to predict the proxy address, not implementation
    // The proxy is what receives ETH in most cases
    const predictedProxyAddress = ethers.getCreateAddress({
        from: deployerAddress,
        nonce: canceledProxyNonce
    });

    console.log("🎯 Predicted proxy address:", predictedProxyAddress);


    // // STEP 2: Check if there's ETH stuck at the proxy address
    const stuckEth = await deployer.provider.getBalance(predictedProxyAddress);
    console.log("💰 ETH stuck at proxy address:", ethers.formatEther(stuckEth), "ETH");

    if (stuckEth === 0n) {
        console.log("❌ No ETH found at the predicted proxy address");
        // Also check if ETH might be at the implementation address
        console.log("🔍 Checking for alternative scenarios...");

        // Calculate implementation address (usually deployed 2 nonces before proxy)
        const implNonce = canceledProxyNonce - 2;
        const predictedImplAddress = ethers.getCreateAddress({
            from: deployerAddress,
            nonce: implNonce
        });

        const stuckEthImpl = await deployer.provider.getBalance(predictedImplAddress);
        console.log("💰 ETH at implementation address:", ethers.formatEther(stuckEthImpl), "ETH");

        if (stuckEthImpl === 0n) {
            console.log("❌ No ETH found at any predicted addresses");
            return;
        }
    }


    // STEP 3: Check current nonce and plan nonce alignment
    const currentNonce = await deployer.getNonce();
    console.log("📊 Current nonce:", currentNonce);

    // For proxy deployment, we need to align to the FIRST nonce of the sequence
    // Typically: implementation (nonce-2), ProxyAdmin (nonce-1), Proxy (nonce)
    const startingNonce = canceledProxyNonce - 2; // Adjust based on your deployment pattern
    console.log("📊 Target starting nonce:", startingNonce);
    console.log("📊 Target proxy nonce:", canceledProxyNonce);

    if (currentNonce > startingNonce) {
        console.log("❌ Current nonce is higher than target starting nonce. Cannot redeploy to same addresses.");
        console.log("💡 The contract addresses are now permanently unreachable.");
        return;
    }

    // if (currentNonce < startingNonce) {
    //     console.log("⚠️  Need to increment nonce to match canceled deployment sequence");
    //     console.log(`🔄 Need to send ${startingNonce - currentNonce} transactions to reach target starting nonce`);

    //     // Send dummy transactions to increment nonce
    //     for (let i = currentNonce; i < startingNonce; i++) {
    //         console.log(`📤 Sending dummy transaction ${i + 1}/${startingNonce}...`);

    //         const dummyTx = await deployer.sendTransaction({
    //             to: deployerAddress, // Send to self
    //             value: 0,
    //             gasLimit: 21000,
    //             nonce: i
    //         });

    //         console.log(`   Hash: ${dummyTx.hash}`);
    //         await dummyTx.wait();
    //         console.log(`   ✅ Confirmed`);
    //     }

    //     console.log("🎯 Nonce alignment complete!");
    // }


    // // STEP 4: Deploy the proxy with exact same parameters
    // console.log("🚀 Deploying proxy to recover stuck ETH...");

    // // Get the contract factory for your implementation
    // const VantablackDeployer = await ethers.getContractFactory("VantablackDeployer");

    // // Gas options (match your original deployment)
    // const gasOptions = {
    //     gasLimit: 3000000, // Adjust as needed
    //     // gasPrice: ethers.parseUnits("20", "gwei"), // Optional: set specific gas price
    // };

    // // Deploy proxy with EXACT same parameters as canceled deployment
    // const vantablackDeployer = await upgrades.deployProxy(VantablackDeployer, [], {
    //     initializer: "initialize",
    //     ...gasOptions,
    //     // Force specific nonce sequence if needed (this might not work with upgrades plugin)
    // });

    // console.log("⏳ Waiting for proxy deployment...");
    // await vantablackDeployer.waitForDeployment();

    // const deployedProxyAddress = await vantablackDeployer.getAddress();
    // console.log("📍 Proxy deployed at:", deployedProxyAddress);

    // // Verify the proxy address matches
    // if (deployedProxyAddress.toLowerCase() !== predictedProxyAddress.toLowerCase()) {
    //     console.log("❌ ERROR: Deployed proxy address doesn't match predicted address!");
    //     console.log("   Predicted:", predictedProxyAddress);
    //     console.log("   Actual:   ", deployedProxyAddress);
    //     console.log("💡 This might be due to ProxyAdmin reuse or different deployment order");

    //     // Check if ETH is at the actual deployed address
    //     const actualBalance = await deployer.provider.getBalance(deployedProxyAddress);
    //     console.log("💰 ETH at actual deployed address:", ethers.formatEther(actualBalance), "ETH");

    //     if (actualBalance === 0n) {
    //         console.log("❌ ETH recovery failed - addresses don't match and no ETH at new address");
    //         return;
    //     }
    // }

    // console.log("✅ SUCCESS: Proxy deployed!");

    // // STEP 5: Check contract balance and withdraw
    // const contractBalance = await deployer.provider.getBalance(deployedProxyAddress);
    // console.log("💰 Contract balance:", ethers.formatEther(contractBalance), "ETH");

    // if (contractBalance > 0) {
    //     console.log("💸 Attempting to withdraw ETH...");

    //     // Call the withdrawEth function on the proxy
    //     try {
    //         // Make sure your VantablackDeployer contract has a withdrawEth function
    //         const provider = deployer.provider;
    //         const vantablackDeployerEthBalance = await provider.getBalance(deployedProxyAddress);
    //         const withdrawTx = await vantablackDeployer.withdrawEth(vantablackDeployerEthBalance);
    //         console.log("📤 Withdraw transaction hash:", withdrawTx.hash);

    //         const receipt = await withdrawTx.wait();
    //         console.log("✅ Withdraw successful!");

    //         const finalBalance = await deployer.provider.getBalance(deployedProxyAddress);
    //         console.log("💰 Final contract balance:", ethers.formatEther(finalBalance), "ETH");

    //     } catch (error) {
    //         console.log("❌ Withdraw failed:", error);
    //         console.log("💡 Make sure your VantablackDeployer contract has a proper withdrawEth function");
    //         console.log("💡 Also check if the function has proper access controls (onlyOwner, etc.)");
    //     }
    // } else {
    //     console.log("ℹ️  No ETH found at the deployed proxy address");
    // }

    // console.log("\n🎉 Proxy recovery process complete!");

    // // Additional info for debugging
    // console.log("\n📋 Deployment Summary:");
    // console.log("   Proxy Address:", deployedProxyAddress);

    // // Get implementation address
    // const implementationAddress = await upgrades.erc1967.getImplementationAddress(deployedProxyAddress);
    // console.log("   Implementation Address:", implementationAddress);

    // // Get admin address
    // const adminAddress = await upgrades.erc1967.getAdminAddress(deployedProxyAddress);
    // console.log("   ProxyAdmin Address:", adminAddress);
}

// Helper function to analyze proxy deployment pattern
async function analyzeProxyDeployment() {
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    console.log("🔍 Analyzing proxy deployment pattern...");
    console.log("💡 Proxy deployments typically use this nonce sequence:");
    console.log("   Nonce N:   Implementation contract");
    console.log("   Nonce N+1: ProxyAdmin (if not already deployed)");
    console.log("   Nonce N+2: TransparentUpgradeableProxy");
    console.log("");
    console.log("🎯 To recover ETH, you need:");
    console.log("   1. The nonce that created the proxy (highest nonce from deployment)");
    console.log("   2. Check if ProxyAdmin was reused (affects nonce calculation)");
    console.log("   3. Ensure identical deployment parameters");

    // Check if ProxyAdmin already exists (affects nonce sequence)
    const currentNonce = await deployer.getNonce();
    console.log("📊 Current deployer nonce:", currentNonce);
}

// Alternative recovery if standard proxy deployment fails
async function manualProxyRecovery(implementationNonce: any, proxyNonce: any) {
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    console.log("🔧 Manual proxy recovery mode...");

    // Step 1: Deploy implementation at specific nonce
    const currentNonce = await deployer.getNonce();

    if (currentNonce !== implementationNonce) {
        console.log(`⚠️  Aligning nonce from ${currentNonce} to ${implementationNonce}`);
        // Send dummy transactions to align nonce
        for (let i = currentNonce; i < implementationNonce; i++) {
            const dummyTx = await deployer.sendTransaction({
                to: deployerAddress,
                value: 0,
                gasLimit: 21000,
                nonce: i
            });
            await dummyTx.wait();
        }
    }

    // Deploy implementation manually
    const VantablackDeployer = await ethers.getContractFactory("VantablackDeployer");
    const implementation = await VantablackDeployer.deploy({
        nonce: implementationNonce,
        gasLimit: 3000000
    });

    await implementation.waitForDeployment();
    console.log("📍 Implementation deployed at:", await implementation.getAddress());

    // Continue with proxy deployment...
    // This is more complex and might require manually deploying ProxyAdmin and Proxy
    console.log("💡 For complete manual recovery, you may need to deploy ProxyAdmin and Proxy separately");
}

// Run the main recovery script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Recovery failed:", error);
        process.exit(1);
    });
