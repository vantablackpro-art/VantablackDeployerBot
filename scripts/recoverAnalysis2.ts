import { ethers, upgrades } from 'hardhat'

async function main() {
    const [deployer] = await ethers.getSigners();
    const stuckAddress = "0x8B17824E02fe8285fb042b527C7bb84e05C2342d"; // Your stuck ETH address

    console.log("🔍 CHECKING STUCK ADDRESS STATUS");
    console.log("📍 Address:", stuckAddress);
    console.log("🌐 Network:", await deployer.provider.getNetwork());
    console.log("");

    // Check basic info
    const provider = deployer.provider;
    const balance = await provider.getBalance(stuckAddress);
    const code = await provider.getCode(stuckAddress);
     const nonce = 161 // await provider.getTransactionCount(stuckAddress);

    console.log("💰 ETH Balance:", ethers.formatEther(balance), "ETH");
    console.log("📄 Code Length:", code.length - 2, "bytes"); // -2 for 0x prefix
    console.log("🔢 Nonce:", nonce);

    if (code === "0x") {
        console.log("❌ No contract code at address - it's an EOA or undeployed contract");
        console.log("💡 This confirms the ETH is stuck at an address with no code");
        return;
    }

    console.log("✅ CONTRACT CODE FOUND!");
    console.log("📋 Code preview:", code.slice(0, 100) + "...");

    // Check if it's a proxy contract
    console.log("\n🔍 CHECKING FOR PROXY PATTERNS...");

    // EIP-1967 Implementation slot
    const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    let implementation;

    try {
        // Try different ways to access storage
        if (provider.getStorage) {
            implementation = await provider.getStorage(stuckAddress, implementationSlot);
        } else {
            // Fallback - make direct RPC call
            implementation = await provider.send("eth_getStorage", [stuckAddress, implementationSlot, "latest"]);
        }
    } catch (error) {
        console.log("⚠️  Could not access storage:", error);
        console.log("💡 Trying alternative methods...");
        implementation = "0x" + "0".repeat(64); // Default to empty
    }

    console.log("🎯 Implementation slot:", implementation);

    if (implementation !== "0x" + "0".repeat(64)) {
        const implementationAddress = "0x" + implementation.slice(-40);
        console.log("🎉 PROXY DETECTED!");
        console.log("📍 Implementation Address:", implementationAddress);

        // Check implementation code
        const implCode = await provider.getCode(implementationAddress);
        console.log("📄 Implementation Code Length:", implCode.length - 2, "bytes");

        // Try to interact with the contract
        console.log("\n💸 ATTEMPTING TO INTERACT WITH CONTRACT...");
        await attemptContractInteraction(stuckAddress, deployer);

    } else {
        // Check EIP-1967 Admin slot
        const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
        let admin;

        try {
            if (provider.getStorage) {
                admin = await provider.getStorage(stuckAddress, adminSlot);
            } else {
                admin = await provider.send("eth_getStorage", [stuckAddress, adminSlot, "latest"]);
            }
        } catch (error) {
            console.log("⚠️  Could not access admin storage");
            admin = "0x" + "0".repeat(64);
        }

        console.log("👤 Admin slot:", admin);

        if (admin !== "0x" + "0".repeat(64)) {
            console.log("🎉 PROXY ADMIN DETECTED!");
            console.log("👤 Admin Address:", "0x" + admin.slice(-40));
        }

        // Check for other proxy patterns
        await checkOtherProxyPatterns(stuckAddress, provider);
    }

    // Check for common function signatures
    console.log("\n🔍 CHECKING FOR COMMON FUNCTIONS...");
    await checkCommonFunctions(stuckAddress, deployer);
}

async function attemptContractInteraction(contractAddress: any, deployer: any) {
    try {
        console.log("🔧 Attempting to create contract instance...");

        // Try common withdrawal function signatures
        const withdrawSignatures = [
            "withdrawEth()",
            "withdraw()",
            "emergencyWithdraw()",
            "rescueETH()",
            "recoverETH()",
            "claimETH()"
        ];

        for (const sig of withdrawSignatures) {
            try {
                console.log(`🧪 Testing function: ${sig}`);

                // Create a minimal ABI with just this function
                const abi = [`function ${sig}`];
                const contract = new ethers.Contract(contractAddress, abi, deployer);

                // Try to call the function (this will fail if function doesn't exist)
                const gasEstimate = await contract[sig.split('(')[0]].estimateGas();
                console.log(`✅ Found function ${sig} - estimated gas: ${gasEstimate}`);

                // Ask user if they want to execute
                console.log(`💡 Function ${sig} exists! You could potentially call it to recover ETH`);

            } catch (error) {
                console.log(`❌ Function ${error} not found or would revert`);
            }
        }

    } catch (error) {
        console.log("❌ Could not interact with contract:", error);
    }
}

async function checkOtherProxyPatterns(contractAddress: any, provider: any) {
    console.log("🔍 Checking other proxy patterns...");

    // Check for OpenZeppelin's older proxy patterns
    const slots = [
        { name: "Legacy Implementation", slot: "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3" },
        { name: "Beacon Proxy", slot: "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50" },
        { name: "UUPS Implementation", slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" },
    ];

    for (const { name, slot } of slots) {
        try {
            let value;
            if (provider.getStorage) {
                value = await provider.getStorage(contractAddress, slot);
            } else if (provider.getStorage) {
                value = await provider.getStorage(contractAddress, slot);
            } else {
                value = await provider.send("eth_getStorage", [contractAddress, slot, "latest"]);
            }

            if (value !== "0x" + "0".repeat(64)) {
                console.log(`🎯 ${name} found:`, "0x" + value.slice(-40));
            }
        } catch (error) {
            console.log(`⚠️  Could not check ${name}:`, error);
        }
    }
}

async function checkCommonFunctions(contractAddress: any, deployer: any) {
    const commonFunctions = [
        "owner()",
        "admin()",
        "implementation()",
        "proxiableUUID()",
        "supportsInterface(bytes4)",
    ];

    for (const func of commonFunctions) {
        try {
            const abi = [`function ${func} view returns (address)`];
            const contract = new ethers.Contract(contractAddress, abi, deployer);

            if (func === "supportsInterface(bytes4)") {
                // Check for ERC165 support
                const result = await contract.supportsInterface("0x01ffc9a7");
                console.log(`📋 ERC165 support: ${result}`);
            } else {
                const result = await contract[func.split('(')[0]]();
                console.log(`📋 ${func}:`, result);
            }

        } catch (error) {
            // Function doesn't exist or failed
        }
    }
}

// Helper function to try calling withdrawEth with your current wallet
async function tryWithdraw(contractAddress : string) {
    const [deployer] = await ethers.getSigners();

    console.log("💸 ATTEMPTING WITHDRAWAL...");
    console.log("🔧 Your address:", await deployer.getAddress());

    try {
        const abi = ["function withdrawEth()"];
        const contract = new ethers.Contract(contractAddress, abi, deployer);

        console.log("⏳ Estimating gas...");
        const gasEstimate = await contract.withdrawEth.estimateGas();
        console.log("⛽ Estimated gas:", gasEstimate.toString());

        console.log("🚀 Executing withdrawal...");
        const tx = await contract.withdrawEth({
            gasLimit: gasEstimate + BigInt(50000) // Add buffer
        });

        console.log("📤 Transaction hash:", tx.hash);
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log("🎉 WITHDRAWAL SUCCESSFUL!");

            const newBalance = await deployer.provider.getBalance(contractAddress);
            console.log("💰 Contract balance now:", ethers.formatEther(newBalance), "ETH");
        } else {
            console.log("❌ Transaction failed");
        }

    } catch (error) {
        console.log("❌ Withdrawal failed:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Check failed:", error);
        process.exit(1);
    });

module.exports = { tryWithdraw };