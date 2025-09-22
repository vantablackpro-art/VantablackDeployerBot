import { ethers } from 'hardhat'
import { parseEther, formatEther } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

async function removeLiquidityViaManager() {
    const [deployer] = await ethers.getSigners()
    console.log("Removing liquidity with account:", deployer.address)
    console.log("Account balance:", formatEther(await ethers.provider.getBalance(deployer.address)), "ETH")

    // Configuration - Update these values
    const TOKEN_A_ADDRESS = "0x" // Add first token address here
    const TOKEN_B_ADDRESS = "0x" // Add second token address here (use WETH for ETH pairs)

    if (TOKEN_A_ADDRESS === "0x" || TOKEN_B_ADDRESS === "0x") {
        console.error("Please set TOKEN_A_ADDRESS and TOKEN_B_ADDRESS in the script")
        console.error("For ETH pairs, use WETH address: 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270")
        return
    }

    try {
        // Get LiquidityManager contract
        const liquidityManager = await ethers.getContractAt("LiquidityManager", process.env.LIQUIDITY_MANAGER!)
        console.log("LiquidityManager at:", liquidityManager.target)

        // Check if we're the owner or admin
        const owner = await liquidityManager.owner()
        const admin = await liquidityManager.admin()

        console.log("Contract owner:", owner)
        console.log("Contract admin:", admin)
        console.log("Our address:", deployer.address)

        if (deployer.address !== owner && deployer.address !== admin) {
            console.error("You must be the owner or admin to remove liquidity via LiquidityManager")
            return
        }

        // Get router and factory from LiquidityManager
        const routerAddress = await liquidityManager.router()
        const router = await ethers.getContractAt("IUniswapV2Router02", routerAddress)
        const factoryAddress = await router.factory()
        const factory = await ethers.getContractAt("IUniswapV2Factory", factoryAddress)

        console.log("Router address:", routerAddress)
        console.log("Factory address:", factoryAddress)

        // Get pair address
        const pairAddress = await factory.getPair(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS)
        console.log("LP Pair address:", pairAddress)

        if (pairAddress === ethers.ZeroAddress) {
            console.error("No liquidity pair found for this token pair")
            return
        }

        // Check LP balance in LiquidityManager
        const lpToken = await ethers.getContractAt("IERC20", pairAddress)
        const lpBalance = await lpToken.balanceOf(liquidityManager.target)
        console.log("LP balance in LiquidityManager:", formatEther(lpBalance))

        if (lpBalance === 0n) {
            console.error("No LP tokens in LiquidityManager to remove")
            return
        }

        // Get token contracts for balance checking
        const tokenA = await ethers.getContractAt("IERC20", TOKEN_A_ADDRESS)
        const tokenB = await ethers.getContractAt("IERC20", TOKEN_B_ADDRESS)

        // Check current balances in LiquidityManager
        const currentTokenABalance = await tokenA.balanceOf(liquidityManager.target)
        const currentTokenBBalance = await tokenB.balanceOf(liquidityManager.target)

        console.log("Current token A balance in LiquidityManager:", formatEther(currentTokenABalance))
        console.log("Current token B balance in LiquidityManager:", formatEther(currentTokenBBalance))

        // Remove liquidity using LiquidityManager
        console.log("Removing liquidity via LiquidityManager...")

        const removeTx = await liquidityManager.removeLiquidity(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS)

        console.log("Transaction sent:", removeTx.hash)
        const receipt = await removeTx.wait()
        console.log("Transaction confirmed in block:", receipt?.blockNumber)
        console.log("Gas used:", receipt?.gasUsed.toString())

        // Check balances after removal
        const newLpBalance = await lpToken.balanceOf(liquidityManager.target)
        const newTokenABalance = await tokenA.balanceOf(liquidityManager.target)
        const newTokenBBalance = await tokenB.balanceOf(liquidityManager.target)

        console.log("\n=== Results ===")
        console.log("Remaining LP tokens in LiquidityManager:", formatEther(newLpBalance))
        console.log("New token A balance in LiquidityManager:", formatEther(newTokenABalance))
        console.log("New token B balance in LiquidityManager:", formatEther(newTokenBBalance))

        console.log("\n=== Tokens Received ===")
        console.log("Token A received:", formatEther(newTokenABalance - currentTokenABalance))
        console.log("Token B received:", formatEther(newTokenBBalance - currentTokenBBalance))

        // Parse events from the receipt
        if (receipt) {
            for (const log of receipt.logs) {
                try {
                    const parsed = liquidityManager.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    })
                    if (parsed?.name === "LiquidityRemoved") {
                        console.log("\n=== Event Data ===")
                        console.log("Amount A removed:", formatEther(parsed.args[0]))
                        console.log("Amount B removed:", formatEther(parsed.args[1]))
                    }
                } catch (e) {
                    // Ignore parsing errors for other contracts' events
                }
            }
        }

    } catch (error: any) {
        console.error("Error removing liquidity:", error.message)
        if (error.reason) {
            console.error("Reason:", error.reason)
        }
    }
}

async function main() {
    console.log("=== Remove Liquidity via LiquidityManager Script ===\n")
    await removeLiquidityViaManager()
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })