import { ethers, upgrades } from "hardhat";
import { VantablackDeployer } from "../typechain";
import { parseEther } from "ethers";

const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1"; // UniSwap polygon
const UNISWAP_V2_FACTORY = "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C"; // UniSwap polygon

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

  // Increase by 5%
  const maxFeePerGas = (feeData.maxFeePerGas * 200n) / 100n;
  const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * 200n) / 100n;

  return {
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
}

describe("Deploy All Contracts", function () {
  it("should deploy all contracts including a sample token", async function () {
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
  const uniswapV2Locker = await UniswapV2Locker.deploy(UNISWAP_V2_FACTORY, {
    ...gasOptions,
  });
  await uniswapV2Locker.deploymentTransaction();
  console.log("UniswapV2Locker deployed at:", uniswapV2Locker.target);

  if (!await waitForContractDeployment(uniswapV2Locker.target as string)) {
    throw new Error("UniswapV2Locker deployment verification failed");
  }
  await sleep(waitTime);

  // Deploy LiquidityManager
  const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
  const liquidityManager = await LiquidityManager.deploy(UNISWAP_V2_ROUTER, {
    ...gasOptions,
  });
  await liquidityManager.deploymentTransaction();
  console.log("LiquidityManager deployed at:", liquidityManager.target);

  if (!await waitForContractDeployment(liquidityManager.target as string)) {
    throw new Error("LiquidityManager deployment verification failed");
  }
  await sleep(waitTime);

  // Deploy VantablackDeployer as upgradeable proxy
  const VantablackDeployer = await ethers.getContractFactory("VantablackDeployer");
  const vantablackDeployer = (await upgrades.deployProxy(VantablackDeployer, [], {
    initializer: "initialize",
    ...gasOptions,
  })) as VantablackDeployer;
  await vantablackDeployer.deploymentTransaction();
  console.log("VantablackDeployer deployed at:", vantablackDeployer.target);

  if (!await waitForContractDeployment(vantablackDeployer.target as string)) {
    throw new Error("VantablackDeployer deployment verification failed");
  }
  await sleep(waitTime);

  // Deploy Deployer
  const Deployer = await ethers.getContractFactory("Deployer");
  const deployer = await Deployer.deploy({
    ...gasOptions,
  });
  await deployer.deploymentTransaction();
  console.log("Deployer deployed at:", deployer.target);

  if (!await waitForContractDeployment(deployer.target as string)) {
    throw new Error("Deployer deployment verification failed");
  }
  await sleep(waitTime);

  // Setup connections
  await vantablackDeployer.connect(owner).setLiquidityManager(liquidityManager.target, {
    ...gasOptions,
    gasLimit: 1_000_000,
  });
  await sleep(waitTime);

  await liquidityManager.connect(owner).transferOwnership(vantablackDeployer.target, {
    ...gasOptions,
    gasLimit: 1_000_000,
  });
  await sleep(waitTime);

  await vantablackDeployer.connect(owner).setUnicryptLocker(uniswapV2Locker.target, {
    ...gasOptions,
    gasLimit: 1_000_000,
  });
  await sleep(waitTime);

  await vantablackDeployer.connect(owner).updateDeployerAddress(deployer.target, {
    ...gasOptions,
    gasLimit: 1_000_000,
  });
  await sleep(waitTime);

  // Fund contracts
  const fundAmount = parseEther("200");
  const txFund = await owner.sendTransaction({
    to: vantablackDeployer.target!,
    value: fundAmount,
    ...gasOptions,
  });
  await txFund.wait();
  console.log(`Funded VantablackDeployer with ${ethers.formatEther(fundAmount)} ETH`);
  await sleep(waitTime);

  const fundLiquidityManagerAmount = parseEther("1");
  const txFundLiquidityManager = await owner.sendTransaction({
    to: liquidityManager.target!,
    value: fundLiquidityManagerAmount,
    ...gasOptions,
  });
  await txFundLiquidityManager.wait();
  console.log(`Funded LiquidityManager with ${ethers.formatEther(fundLiquidityManagerAmount)} ETH`);
  await sleep(waitTime);

  // Whitelist owner
  await vantablackDeployer.connect(owner).addToApproved(owner.address, {
    ...gasOptions,
    gasLimit: 1_000_000,
  });
  await sleep(waitTime);

  // Deploy a sample token
  const amounts: [bigint, bigint, bigint] = [parseEther("0.1"), 0n, 0n]; // firstBuyAmount, lockDuration, lpManagementOption
  const addrs: [string, string, string, string] = [owner.address, owner.address, UNISWAP_V2_ROUTER, ethers.ZeroAddress]; // owner, treasury, router, dividendTokenAddress
  const percents: [number, number, number, number, number] = [500, 500, 0, 0, 0]; // buyFee, sellFee, transferFee, burnPercent, distributionRewardsPercent
  const flags: [boolean, boolean] = [false, false]; // hasFirstBuy, burnTokens
  const metadata: [string, string] = ["Test Token", "TEST"]; // name, symbol

  const txDeployToken = await vantablackDeployer.connect(owner).deployToken(
    amounts,
    addrs,
    percents,
    flags,
    metadata,
    {
      value: parseEther("200"), // Funding amount
      ...gasOptions,
      gasLimit: 3_000_000,
    }
  );
  await txDeployToken.wait();
  console.log("Sample token deployed");
  await sleep(waitTime);
  });
});