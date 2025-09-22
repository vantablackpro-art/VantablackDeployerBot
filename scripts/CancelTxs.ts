const { ethers } = require("hardhat");

async function main() {
  // Get the signer (your wallet)
  const [signer] = await ethers.getSigners();
  const address = await signer.getAddress();

  console.log("🔍 Checking wallet:", address);

  // Get current nonce and pending nonce
  const currentNonce = await signer.getNonce("latest");
  const pendingNonce = await signer.getNonce("pending");

  console.log("📊 Current nonce (confirmed):", currentNonce);
  console.log("📊 Pending nonce:", pendingNonce);

  if (currentNonce === pendingNonce) {
    console.log("✅ No pending transactions found. Wallet is not stuck!");
    return;
  }

  console.log(`⚠️  Found ${pendingNonce - currentNonce} pending transaction(s)`);

  // Get current gas price and increase it for faster confirmation
  const feeData = await signer.provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  const maxFeePerGas = feeData.maxFeePerGas;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

  console.log("⛽ Current gas price:", ethers.formatUnits(gasPrice || 0, "gwei"), "gwei");

  // Calculate higher gas prices (increase by 20-50% for faster confirmation)
  const gasMultiplier = 4; // 400% increase
  const newGasPrice = gasPrice ? (gasPrice * BigInt(Math.floor(gasMultiplier * 100))) / BigInt(100) : null;
  const newMaxFeePerGas = maxFeePerGas ? (maxFeePerGas * BigInt(Math.floor(gasMultiplier * 100))) / BigInt(100) : null;
  const newMaxPriorityFeePerGas = maxPriorityFeePerGas ? (maxPriorityFeePerGas * BigInt(Math.floor(gasMultiplier * 100))) / BigInt(100) : null;

  // Ask for confirmation before proceeding
  console.log("\n🚀 Ready to cancel pending transactions by sending replacement transactions with higher gas prices.");
  console.log("This will cost gas fees for each transaction cancelled.");

  // In a real script, you might want to add a prompt here
  // For automation, we'll proceed automatically

  const balance = await signer.provider.getBalance(address);
  console.log("💰 Wallet balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.001")) {
    console.log("❌ Insufficient balance to pay for gas fees");
    return;
  }

  // Cancel each pending transaction
  for (let nonce = currentNonce; nonce < pendingNonce; nonce++) {
    try {
      console.log(`\n🔄 Cancelling transaction with nonce ${nonce}...`);

      // Create a cancellation transaction (send 0 ETH to yourself with same nonce but higher gas)
      const cancelTx = {
        to: address,
        value: 0,
        nonce: nonce,
        gasLimit: 21000, // Standard ETH transfer gas limit
      };

      // Add appropriate gas pricing based on network type
      if (newMaxFeePerGas && newMaxPriorityFeePerGas) {
        // EIP-1559 transaction (Ethereum mainnet, Polygon, etc.)
        cancelTx.maxFeePerGas = newMaxFeePerGas;
        cancelTx.maxPriorityFeePerGas = newMaxPriorityFeePerGas;
        cancelTx.type = 2;

        console.log(`   ⛽ Max fee per gas: ${ethers.formatUnits(newMaxFeePerGas, "gwei")} gwei`);
        console.log(`   ⛽ Max priority fee: ${ethers.formatUnits(newMaxPriorityFeePerGas, "gwei")} gwei`);
      } else if (newGasPrice) {
        // Legacy transaction
        cancelTx.gasPrice = newGasPrice;
        console.log(`   ⛽ Gas price: ${ethers.formatUnits(newGasPrice, "gwei")} gwei`);
      }

      // Send the cancellation transaction
      const tx = await signer.sendTransaction(cancelTx);
      console.log(`   📝 Cancellation tx hash: ${tx.hash}`);

      // Wait for confirmation
      console.log(`   ⏳ Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        console.log(`   ✅ Successfully cancelled transaction with nonce ${nonce}`);
      } else {
        console.log(`   ❌ Failed to cancel transaction with nonce ${nonce}`);
      }

      // Small delay to avoid overwhelming the network
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.log(`   ❌ Error cancelling nonce ${nonce}:`, error.message);

      if (error.message.includes("nonce too low")) {
        console.log(`   ℹ️  Nonce ${nonce} was already confirmed by another transaction`);
      } else if (error.message.includes("replacement transaction underpriced")) {
        console.log(`   ⚠️  Need higher gas price for nonce ${nonce}. Try increasing gasMultiplier in script.`);
      }
    }
  }

  // Final status check
  console.log("\n🔍 Final status check...");
  const finalCurrentNonce = await signer.getNonce("latest");
  const finalPendingNonce = await signer.getNonce("pending");

  console.log("📊 Final current nonce:", finalCurrentNonce);
  console.log("📊 Final pending nonce:", finalPendingNonce);

  if (finalCurrentNonce === finalPendingNonce) {
    console.log("🎉 Wallet successfully unstuck! All pending transactions cleared.");
  } else {
    console.log("⚠️  Some transactions may still be pending. You might need to:");
    console.log("   - Wait a bit longer for confirmations");
    console.log("   - Increase the gasMultiplier and run the script again");
    console.log("   - Check if you have sufficient balance for gas fees");
  }
}

// Helper function to check specific transaction status
async function checkTransactionStatus(txHash) {
  const [signer] = await ethers.getSigners();

  try {
    const tx = await signer.provider.getTransaction(txHash);
    if (!tx) {
      console.log("❌ Transaction not found");
      return;
    }

    console.log("📝 Transaction Details:");
    console.log("   Hash:", tx.hash);
    console.log("   Nonce:", tx.nonce);
    console.log("   Gas Price:", ethers.formatUnits(tx.gasPrice || 0, "gwei"), "gwei");
    console.log("   Gas Limit:", tx.gasLimit?.toString());

    const receipt = await signer.provider.getTransactionReceipt(txHash);
    if (receipt) {
      console.log("   Status: ✅ Confirmed");
      console.log("   Block:", receipt.blockNumber);
      console.log("   Gas Used:", receipt.gasUsed?.toString());
    } else {
      console.log("   Status: ⏳ Pending");
    }
  } catch (error) {
    console.log("❌ Error checking transaction:", error);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });

// Export helper function for use in other scripts
module.exports = { checkTransactionStatus };