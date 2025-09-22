import { ethers, upgrades } from 'hardhat'
import { expect } from 'chai'
import { parseEther } from 'ethers'
import { LiquidityManager, UniswapV2Locker, VantablackDeployer } from '../typechain'

import * as dotenv from 'dotenv'
import '@typechain/hardhat'
dotenv.config()

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1"
const UNISWAP_V2_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"

async function getGasOptions() {
  const feeData = await ethers.provider.getFeeData();
  if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
    throw new Error("Could not fetch EIP-1559 fee data");
  }

  // Increase by 5%
  const maxFeePerGas = (feeData.maxFeePerGas * 200n) / 100n;
  const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * 200n) / 100n;

  return {
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
}

const deploy = async () => {
  const [owner] = await ethers.getSigners();
  console.log("Owner address:", owner.address);
  // Deploy VantablackDeployer as upgradeable proxy
  const vantablackDeployer = await ethers.getContractAt("VantablackDeployer", "0x8B17824E02fe8285fb042b527C7bb84e05C2342d")
  console.log("VantablackDeployer at:", vantablackDeployer.target);

  const gasOptions = await getGasOptions();

  // Whitelist owner
  await vantablackDeployer.connect(owner).withdrawEth(parseEther("200"), {
    ...gasOptions,
    gasLimit: 1_000_000,
  });
  await sleep(20000); // Wait for 20 seconds to ensure balance is updated



  // // Setup connections (use owner signer explicitly)
  // await vantablackDeployer.connect(owner).setLiquidityManager(liquidityManager.target, { gasLimit: 500000 });
  // await sleep(20000); // Wait for 20 seconds to ensure balance is updated

  // // Transfer ownership of LiquidityManager to VantablackDeployer so it can manage it
  // await liquidityManager.connect(owner).transferOwnership(vantablackDeployer.target, { gasLimit: 500000 });
  // await sleep(20000); // Wait for 20 seconds to ensure balance is updated

  // await vantablackDeployer.connect(owner).setUnicryptLocker(uniswapV2Locker.target, { gasLimit: 500000 });
  // await sleep(20000); // Wait for 20 seconds to ensure balance is updated

  // // Fund the deployer for LP
  // await vantablackDeployer.connect(owner).fundLiquidityPool({ value: parseEther("0.2"), gasLimit: 500000 });
  // await sleep(20000); // Wait for 20 seconds to ensure balance is updated

  // // Whitelist owner
  // await vantablackDeployer.connect(owner).addToWhitelist("0xEb5aC7E48EF6cFFeFFC668Cbfb2F3f6763870269", { gasLimit: 500000 });
  // await sleep(20000); // Wait for 20 seconds to ensure balance is updated


};

deploy().then(() => {
  console.log("Deployment completed");
}).catch((error) => {
  console.error("Deployment failed:", error);
});






