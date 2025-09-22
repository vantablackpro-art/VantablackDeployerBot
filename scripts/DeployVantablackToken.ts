import { ethers, upgrades } from 'hardhat'
import fs from "fs";
import path from "path";
import { VantablackDeployer } from "../typechain";
import dotenv from "dotenv";
import { parseEther } from 'ethers';
dotenv.config();

const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1"
const UNISWAP_V2_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"
const waitTime = 0; // 1 second
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Deploying with account:", owner.address);

  const token = await ethers.getContractFactory("TestToken");
  const deployedToken = await token.deploy("REFLECT", "REFLECT");
  console.log("Token deployed at:", deployedToken.target);
};

main().then(() => {
  console.log("Deployment completed");
}).catch((error) => {
  console.error("Deployment failed:", error);
});






