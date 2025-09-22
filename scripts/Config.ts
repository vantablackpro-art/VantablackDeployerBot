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

const deploy = async () => {
  const [owner] = await ethers.getSigners();
  const ownerBalance = await ethers.provider.getBalance(owner.address);
  console.log("Deploying contracts with account:", owner.address);
  console.log("Account balance:", ethers.formatEther(ownerBalance));


  // Deploy UniswapV2Locker
  const uniswapV2Locker = await ethers.getContractAt("UniswapV2Locker", process.env.UNISWAP_V2_LOCKER!)
  console.log("UniswapV2Locker at:", uniswapV2Locker.target);

  // Deploy LiquidityManager
  const liquidityManager = await ethers.getContractAt("LiquidityManager", process.env.LIQUIDITY_MANAGER!)
  console.log("LiquidityManager at:", liquidityManager.target);


  // Deploy VantablackDeployer as upgradeable proxy
  const vantablackDeployer = await ethers.getContractAt("VantablackDeployer", process.env.VENTABLACK_DEPLOYER!)
  console.log("VantablackDeployer at:", vantablackDeployer.target);

  // Whitelist owner
  const tx = await vantablackDeployer.connect(owner).setLpFundingAmount(parseEther("200"));
  // const tx = await vantablackDeployer.connect(owner).addToApproved("0xF19cFEA9b234E679bE4B177A60A78BC900F3387B");
  // const tx = await vantablackDeployer.connect(owner).setLpFundingAmount(parseEther("200"));
  console.log(tx)




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






