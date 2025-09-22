import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";
import { VantablackDeployer } from "../typechain";
import dotenv from "dotenv";
import { parseEther } from "ethers";

dotenv.config();

// Ethereum mainnet Uniswap V2 addresses
const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Uniswap V2 Router
const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"; // Uniswap V2 Factory

const waitTime = 5000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForContractDeployment(address: string, maxRetries: number = 10): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const code = await ethers.provider.getCode(address);
      if (code !== "0x") {
        console.log(`Contract at ${address} is deployed (attempt ${i + 1})`);
        return true;
      }
      console.log(`Contract at ${address} not yet deployed, waiting... (attempt ${i + 1}/${maxRetries})`);
      await sleep(5000);
    } catch (error) {
      console.log(`Error checking contract at ${address}: ${error}`);
      await sleep(5000);
    }
  }
  console.error(`Contract at ${address} failed to deploy after ${maxRetries} attempts`);
  return false;
}

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
  console.log("Deploying with account:", owner.address);

  const ownerBalance = await ethers.provider.getBalance(owner.address);
  console.log("Account balance:", ethers.formatEther(ownerBalance));

  const feeData = await ethers.provider.getFeeData();
  console.log("Gas Price:", feeData.gasPrice?.toString());
  console.log("Max Fee Per Gas:", feeData.maxFeePerGas?.toString());
  console.log("Max Priority Fee Per Gas:", feeData.maxPriorityFeePerGas?.toString());

  const gasOptions = await getGasOptions();

  // Deploy UniswapV2Locker
  const UniswapV2Locker = await ethers.getContractFactory("UniswapV2Locker");
  const uniswapV2Locker = await UniswapV2Locker.deploy(UNISWAP_V2_FACTORY, gasOptions);
  await uniswapV2Locker.waitForDeployment();
  console.log("UniswapV2Locker deployed at:", uniswapV2Locker.target);

  if (!await waitForContractDeployment(uniswapV2Locker.target as string)) {
    throw new Error("UniswapV2Locker deployment verification failed");
  }
  await sleep(waitTime);

  // Deploy LiquidityManager
  const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
  const liquidityManager = await LiquidityManager.deploy(UNISWAP_V2_ROUTER, gasOptions);
  await liquidityManager.waitForDeployment();
  console.log("LiquidityManager deployed at:", liquidityManager.target);

  if (!await waitForContractDeployment(liquidityManager.target as string)) {
    throw new Error("LiquidityManager deployment verification failed");
  }
  await sleep(waitTime);

  // Deploy VantablackDeployer as upgradeable proxy
  const VantablackDeployer = await ethers.getContractFactory("VantablackDeployer");
  const vantablackDeployer = (await upgrades.deployProxy(VantablackDeployer, [], {
    initializer: "initialize",
    txOverrides: gasOptions
  })) as VantablackDeployer;
  await vantablackDeployer.waitForDeployment();
  console.log("VantablackDeployer deployed at:", vantablackDeployer.target);

  if (!await waitForContractDeployment(vantablackDeployer.target as string)) {
    throw new Error("VantablackDeployer deployment verification failed");
  }
  await sleep(waitTime);

  // Deploy Deployer
  const Deployer = await ethers.getContractFactory("Deployer");
  const deployer = await Deployer.deploy(gasOptions);
  await deployer.waitForDeployment();
  console.log("Deployer deployed at:", deployer.target);

  if (!await waitForContractDeployment(deployer.target as string)) {
    throw new Error("Deployer deployment verification failed");
  }
  await sleep(waitTime);

  // Setup connections
  await vantablackDeployer.connect(owner).setLiquidityManager(liquidityManager.target, gasOptions);
  await sleep(waitTime);

  await liquidityManager.connect(owner).transferOwnership(vantablackDeployer.target, gasOptions);
  await sleep(waitTime);

  await vantablackDeployer.connect(owner).setUnicryptLocker(uniswapV2Locker.target, gasOptions);
  await sleep(waitTime);

  await vantablackDeployer.connect(owner).updateDeployerAddress(deployer.target, gasOptions);
  await sleep(waitTime);

  // transfer ownership of VantablackDeployer to multisig
  const vantablackDeployerOwner = "0xf2F807DB027acF9e6A7AcF78790B979E19B27fBb"; // Update this to actual multisig address
  await vantablackDeployer.connect(owner).transferOwnership(vantablackDeployerOwner, gasOptions);
  console.log(`VantablackDeployer ownership transferred to ${vantablackDeployerOwner}`);
  await sleep(waitTime);

  // // Fund contracts
  // const fundAmount = parseEther("200");
  // const txFund = await owner.sendTransaction({
  //   to: vantablackDeployer.target!,
  //   value: fundAmount,
  //   ...gasOptions,
  // });
  // await txFund.wait();
  // console.log(`Funded VantablackDeployer with ${ethers.formatEther(fundAmount)} ETH`);
  // await sleep(waitTime);

  // const fundLiquidityManagerAmount = parseEther("1");
  // const txFundLiquidityManager = await owner.sendTransaction({
  //   to: liquidityManager.target!,
  //   value: fundLiquidityManagerAmount,
  //   ...gasOptions,
  // });
  // await txFundLiquidityManager.wait();
  // console.log(`Funded LiquidityManager with ${ethers.formatEther(fundLiquidityManagerAmount)} ETH`);
  // await sleep(waitTime);

  // // Whitelist owner
  // await vantablackDeployer.connect(owner).addToApproved(owner.address, {
  //   ...gasOptions,
  //   gasLimit: 5_000_000,
  // });
  // await sleep(waitTime);
}

main()
  .then(() => {
    console.log("Deployment completed");
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
  });
