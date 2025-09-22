import { ethers } from "hardhat";
import { VantablackDeployer } from "../typechain";
import dotenv from "dotenv";

dotenv.config();

async function getGasOptions() {
  const feeData = await ethers.provider.getFeeData();
  if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
    throw new Error("Could not fetch EIP-1559 fee data");
  }

  // Increase by 20% for better reliability
  const maxFeePerGas = (feeData.maxFeePerGas * 120n) / 100n;
  const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * 120n) / 100n;

  return {
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasLimit: 5_000_000
  };
}

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Transferring ownership with account:", owner.address);

  const ownerBalance = await ethers.provider.getBalance(owner.address);
  console.log("Account balance:", ethers.formatEther(ownerBalance));

  const feeData = await ethers.provider.getFeeData();
  console.log("Gas Price:", feeData.gasPrice?.toString());
  console.log("Max Fee Per Gas:", feeData.maxFeePerGas?.toString());
  console.log("Max Priority Fee Per Gas:", feeData.maxPriorityFeePerGas?.toString());

  const gasOptions = await getGasOptions();

  // Get VantablackDeployer address from environment
  const vantablackDeployerAddress = process.env.VENTABLACK_DEPLOYER!;
  if (!vantablackDeployerAddress) {
    throw new Error("VENTABLACK_DEPLOYER address not found in environment variables");
  }

  console.log("VantablackDeployer at:", vantablackDeployerAddress);

  // Get contract instance
  const VantablackDeployer = await ethers.getContractFactory("VantablackDeployer");
  const vantablackDeployer = VantablackDeployer.attach(vantablackDeployerAddress) as VantablackDeployer;

  // Check current owner
  const currentOwner = await vantablackDeployer.owner();
  console.log("Current owner:", currentOwner);

  // Verify that the caller is the current owner
  if (currentOwner.toLowerCase() !== owner.address.toLowerCase()) {
    throw new Error(`Caller ${owner.address} is not the current owner ${currentOwner}`);
  }

  // New owner address
  const newOwner = "0xf2F807DB027acF9e6A7AcF78790B979E19B27fBb";
  console.log("New owner:", newOwner);

  // Transfer ownership
  console.log("Transferring ownership...");
  const tx = await vantablackDeployer.connect(owner).transferOwnership(newOwner, gasOptions);
  await tx.wait();
  console.log(`VantablackDeployer ownership transferred to ${newOwner}`);
  console.log("Transaction hash:", tx.hash);

  // Verify the ownership transfer
  const updatedOwner = await vantablackDeployer.owner();
  console.log("Updated owner:", updatedOwner);

  if (updatedOwner.toLowerCase() === newOwner.toLowerCase()) {
    console.log("✅ Ownership transfer successful!");
  } else {
    console.error("❌ Ownership transfer failed!");
  }
}

main()
  .then(() => {
    console.log("Ownership transfer completed");
  })
  .catch((error) => {
    console.error("Ownership transfer failed:", error);
  });