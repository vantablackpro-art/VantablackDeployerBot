import { ethers, upgrades } from 'hardhat'
import { expect } from 'chai'
import { parseEther } from 'ethers'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { LiquidityManager, UniswapV2Locker, VantablackDeployer } from '../typechain'
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1"
const UNISWAP_V2_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"

const deploy = async () => {
  const [owner] = await ethers.getSigners();
  const ownerBalance = await ethers.provider.getBalance(owner.address);
  console.log("Deploying contracts with account:", owner.address);
  console.log("Account balance:", ethers.formatEther(ownerBalance));

  // Deploy UniswapV2Locker
  const UniswapV2Locker = await ethers.getContractFactory("UniswapV2Locker")
  const uniswapV2Locker = await UniswapV2Locker.deploy(UNISWAP_V2_FACTORY)
  await uniswapV2Locker.deploymentTransaction();
  console.log("UniswapV2Locker deployed at:", uniswapV2Locker.target);
  await sleep(20000); // Wait for 20 seconds to ensure balance is updated

  // Deploy LiquidityManager
  const LiquidityManager = await ethers.getContractFactory("LiquidityManager")
  const liquidityManager = await LiquidityManager.deploy(UNISWAP_V2_ROUTER)
  await liquidityManager.deploymentTransaction();
  console.log("LiquidityManager deployed at:", liquidityManager.target);
  await sleep(20000); // Wait for 20 seconds to ensure balance is updated

  // Deploy VantablackDeployer as upgradeable proxy
  const VantablackDeployer = await ethers.getContractFactory("VantablackDeployer")
  const vantablackDeployer = await upgrades.deployProxy(VantablackDeployer, [], {
    initializer: 'initialize'
  }) as VantablackDeployer
  console.log("VantablackDeployer deployed at:", vantablackDeployer.target);
  await sleep(20000); // Wait for 20 seconds to ensure balance is updated

  // Setup connections (use owner signer explicitly)
  await vantablackDeployer.connect(owner).setLiquidityManager(liquidityManager.target)
  await sleep(20000); // Wait for 20 seconds to ensure balance is updated

  // Transfer ownership of LiquidityManager to VantablackDeployer so it can manage it
  await liquidityManager.connect(owner).transferOwnership(vantablackDeployer.target)
  await sleep(20000); // Wait for 20 seconds to ensure balance is updated

  await vantablackDeployer.connect(owner).setUnicryptLocker(uniswapV2Locker.target)
  await sleep(20000); // Wait for 20 seconds to ensure balance is updated

  // Fund the deployer for LP
  await vantablackDeployer.connect(owner).fundLiquidityPool({ value: parseEther("0.2") })
  await sleep(20000); // Wait for 20 seconds to ensure balance is updated

  // Whitelist owner
  await vantablackDeployer.connect(owner).addToWhitelist(owner.address)
  await sleep(20000); // Wait for 20 seconds to ensure balance is updated


};

deploy().then(() => {
  console.log("Deployment completed");
}).catch((error) => {
  console.error("Deployment failed:", error);
});






