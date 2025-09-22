import { ethers } from "hardhat";

const UNISWAP_V2_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"

const deploy = async () => {
  const [deployer] = await ethers.getSigners();
  const UniswapV2LockerFactory = await ethers.getContractFactory("UniswapV2Locker");
  const uniswapV2Locker = await UniswapV2LockerFactory.deploy(UNISWAP_V2_FACTORY);
  await uniswapV2Locker.deploymentTransaction();
  console.log("UniswapV2Locker deployed at:", uniswapV2Locker.target);
};

deploy().then(() => {
  console.log("Deployment completed");
}).catch((error) => {
  console.error("Deployment failed:", error);
});




