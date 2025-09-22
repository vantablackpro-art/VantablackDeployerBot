import { ethers } from 'hardhat'
import { parseEther, formatEther, formatUnits } from 'ethers'

const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1" // Polygon mainnet
const UNISWAP_V2_FACTORY = "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C"

async function removeLiquidityTokens() {
    const [deployer] = await ethers.getSigners()
    console.log("Removing liquidity with account:", deployer.address)
    console.log("Account balance:", formatEther(await ethers.provider.getBalance(deployer.address)), "ETH")

    // Get router and factory contracts
    const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER)
    const factory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_V2_FACTORY)

    // Configuration - Update these values for your specific pair
    const TOKEN_A_ADDRESS = "0x" // Add first token address here
    const TOKEN_B_ADDRESS = "0x" // Add second token address here
    const LIQUIDITY_AMOUNT = parseEther("0") // Amount of LP tokens to remove (0 = all)
    const MIN_TOKEN_A_AMOUNT = 0 // Minimum tokenA amount to receive (0 = no minimum)
    const MIN_TOKEN_B_AMOUNT = 0 // Minimum tokenB amount to receive (0 = no minimum)

    if (TOKEN_A_ADDRESS === "0x" || TOKEN_B_ADDRESS === "0x") {
        console.error("Please set TOKEN_A_ADDRESS and TOKEN_B_ADDRESS in the script")
        return
    }

    try {
        console.log("Token A address:", TOKEN_A_ADDRESS)
        console.log("Token B address:", TOKEN_B_ADDRESS)

        // Get token contracts to check decimals
        const tokenA = await ethers.getContractAt("IERC20", TOKEN_A_ADDRESS)
        const tokenB = await ethers.getContractAt("IERC20", TOKEN_B_ADDRESS)

        // Try to get decimals (fallback to 18 if not available)
        let decimalsA = 18
        let decimalsB = 18
        try {
            const tokenAExtended = await ethers.getContractAt("IERC20Metadata", TOKEN_A_ADDRESS)
            decimalsA = await tokenAExtended.decimals()
        } catch (e) {
            console.log("Could not get decimals for token A, assuming 18")
        }
        try {
            const tokenBExtended = await ethers.getContractAt("IERC20Metadata", TOKEN_B_ADDRESS)
            decimalsB = await tokenBExtended.decimals()
        } catch (e) {
            console.log("Could not get decimals for token B, assuming 18")
        }

        console.log(`Token A decimals: ${decimalsA}`)
        console.log(`Token B decimals: ${decimalsB}`)

        // Get pair address
        const pairAddress = await factory.getPair(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS)
        console.log("LP Pair address:", pairAddress)

        if (pairAddress === ethers.ZeroAddress) {
            console.error("No liquidity pair found for this token pair")
            return
        }

        // Get LP token contract
        const lpToken = await ethers.getContractAt("IERC20", pairAddress)

        // Check LP balance
        const lpBalance = await lpToken.balanceOf(deployer.address)
        console.log("LP token balance:", formatEther(lpBalance))

        if (lpBalance === 0n) {
            console.error("No LP tokens to remove")
            return
        }

        // Determine amount to remove
        const amountToRemove = LIQUIDITY_AMOUNT > 0 ? LIQUIDITY_AMOUNT : lpBalance
        console.log("Amount to remove:", formatEther(amountToRemove))

        if (amountToRemove > lpBalance) {
            console.error("Insufficient LP token balance")
            return
        }

        // Check current allowance
        const currentAllowance = await lpToken.allowance(deployer.address, UNISWAP_V2_ROUTER)
        console.log("Current router allowance:", formatEther(currentAllowance))

        // Approve router if needed
        if (currentAllowance < amountToRemove) {
            console.log("Approving router to spend LP tokens...")
            const approveTx = await lpToken.approve(UNISWAP_V2_ROUTER, amountToRemove)
            await approveTx.wait()
            console.log("Approval successful")
        }

        // Get pair reserves to estimate what we'll receive
        // Using manual interface for pair-specific methods
        const pairContract = new ethers.Contract(pairAddress, [
            "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
            "function token0() external view returns (address)",
            "function token1() external view returns (address)"
        ], deployer)

        const reserves = await pairContract.getReserves()
        const totalSupply = await lpToken.totalSupply()

        const token0 = await pairContract.token0()
        const isTokenAFirst = token0.toLowerCase() === TOKEN_A_ADDRESS.toLowerCase()

        const tokenAReserve = isTokenAFirst ? reserves[0] : reserves[1]
        const tokenBReserve = isTokenAFirst ? reserves[1] : reserves[0]

        const estimatedTokenAOut = (tokenAReserve * amountToRemove) / totalSupply
        const estimatedTokenBOut = (tokenBReserve * amountToRemove) / totalSupply

        console.log("Estimated token A out:", formatUnits(estimatedTokenAOut, decimalsA))
        console.log("Estimated token B out:", formatUnits(estimatedTokenBOut, decimalsB))

        // Check current token balances
        const currentTokenABalance = await tokenA.balanceOf(deployer.address)
        const currentTokenBBalance = await tokenB.balanceOf(deployer.address)
        console.log("Current token A balance:", formatUnits(currentTokenABalance, decimalsA))
        console.log("Current token B balance:", formatUnits(currentTokenBBalance, decimalsB))

        // Remove liquidity
        console.log("Removing liquidity...")
        const deadline = Math.floor(Date.now() / 1000) + 600 // 10 minutes from now

        const removeTx = await router.removeLiquidity(
            TOKEN_A_ADDRESS,
            TOKEN_B_ADDRESS,
            amountToRemove,
            MIN_TOKEN_A_AMOUNT,
            MIN_TOKEN_B_AMOUNT,
            deployer.address,
            deadline
        )

        console.log("Transaction sent:", removeTx.hash)
        const receipt = await removeTx.wait()
        console.log("Transaction confirmed in block:", receipt?.blockNumber)
        console.log("Gas used:", receipt?.gasUsed.toString())

        // Check balances after removal
        const newLpBalance = await lpToken.balanceOf(deployer.address)
        const newTokenABalance = await tokenA.balanceOf(deployer.address)
        const newTokenBBalance = await tokenB.balanceOf(deployer.address)

        console.log("\n=== Results ===")
        console.log("Remaining LP tokens:", formatEther(newLpBalance))
        console.log("New token A balance:", formatUnits(newTokenABalance, decimalsA))
        console.log("New token B balance:", formatUnits(newTokenBBalance, decimalsB))

        console.log("\n=== Received ===")
        console.log("Token A received:", formatUnits(newTokenABalance - currentTokenABalance, decimalsA))
        console.log("Token B received:", formatUnits(newTokenBBalance - currentTokenBBalance, decimalsB))

    } catch (error: any) {
        console.error("Error removing liquidity:", error.message)
        if (error.reason) {
            console.error("Reason:", error.reason)
        }
    }
}

async function main() {
    console.log("=== Remove Token/Token Liquidity Script ===\n")
    await removeLiquidityTokens()
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })