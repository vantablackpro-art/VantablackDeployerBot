import { ethers } from 'hardhat'
import { parseEther, formatEther } from 'ethers'

// const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1" // Polygon mainnet
// const UNISWAP_V2_FACTORY = "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C"

const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1" // QuickSwap
const UNISWAP_V2_FACTORY = "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C" // QuickSwap

const PairAbi = [
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function nonces(address owner) external view returns (uint256)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)"
];

async function removeLiquidity() {
    const [deployer] = await ethers.getSigners()
    console.log("Removing liquidity with account:", deployer.address)
    console.log("Account balance:", formatEther(await ethers.provider.getBalance(deployer.address)), "ETH")

    // Get router and factory contracts
    const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER)
    const factory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_V2_FACTORY)

    // Configuration - Update these values for your specific pair
    const TOKEN_ADDRESS = "0x46A8e3685Bd46B7Ac8924227E26D4eAdB0c30845" // Add your token address here
    const LIQUIDITY_AMOUNT = parseEther("0") // Amount of LP tokens to remove (0 = all)
    const MIN_TOKEN_AMOUNT = 0 // Minimum token amount to receive (0 = no minimum)
    const MIN_ETH_AMOUNT = 0 // Minimum ETH amount to receive (0 = no minimum)

    // if (TOKEN_ADDRESS === "0x") {
    //     console.error("Please set TOKEN_ADDRESS in the script")
    //     return
    // }

    try {
        // Get WETH address
        const weth = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"
        console.log("WETH address:", weth)
        console.log("Token address:", TOKEN_ADDRESS)

        // Get pair address
        const pairAddress = await factory.getPair(TOKEN_ADDRESS, weth)
        console.log("LP Pair address:", pairAddress)

        if (pairAddress === ethers.ZeroAddress) {
            console.error("No liquidity pair found for this token/ETH pair")
            return
        }

        // Get pair contract with extended ABI
        const pair = await ethers.getContractAt(PairAbi, pairAddress)

        // Check LP balance
        const lpBalance = await pair.balanceOf(deployer.address)
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

        // Using permit method - no prior approval needed
        console.log("Using permit method - no prior approval required")

        // Get pair reserves to estimate what we'll receive
        const reserves = await pair.getReserves()
        const totalSupply = await pair.totalSupply()

        const token0 = await pair.token0()
        const isTokenFirst = token0.toLowerCase() === TOKEN_ADDRESS.toLowerCase()

        const tokenReserve = isTokenFirst ? reserves[0] : reserves[1]
        const ethReserve = isTokenFirst ? reserves[1] : reserves[0]

        const estimatedTokenOut = (tokenReserve * amountToRemove) / totalSupply
        const estimatedEthOut = (ethReserve * amountToRemove) / totalSupply

        console.log("Estimated token out:", formatEther(estimatedTokenOut))
        console.log("Estimated ETH out:", formatEther(estimatedEthOut))

        // Remove liquidity using permit (no prior approval needed)
        console.log("Removing liquidity with permit...")

        const chainId = (await ethers.provider.getNetwork()).chainId
        const nonce = await pair.nonces(deployer.address)
        const deadline = 2648069985 // Saturday, 29 November 2053 22:59:45

        console.log("Chain ID:", chainId)
        console.log("Nonce:", nonce.toString())
        console.log("Amount to remove:", formatEther(amountToRemove))

        // EIP-712 domain and types
        const EIP712Domain = [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
        ]

        const domain = {
            name: 'Pancake LPs',
            version: '1',
            chainId: chainId,
            verifyingContract: pairAddress
        }

        const Permit = [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' }
        ]

        const message = {
            owner: deployer.address,
            spender: UNISWAP_V2_ROUTER,
            value: amountToRemove.toString(),
            nonce: nonce.toString(),
            deadline: deadline
        }

        const data = {
            types: {
                EIP712Domain,
                Permit
            },
            domain,
            primaryType: 'Permit',
            message
        }

        console.log("Signing permit...")
        const signature = await deployer.signTypedData(domain, { Permit }, message)
        const { v, r, s } = ethers.Signature.from(signature)

        console.log("Signature:", { v, r, s })

        // Remove liquidity with permit
        const removeTx = await router.removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
            TOKEN_ADDRESS,
            amountToRemove,
            MIN_TOKEN_AMOUNT,
            MIN_ETH_AMOUNT,
            deployer.address,
            deadline,
            false, // approveMax
            v,
            r,
            s
        )

        console.log("Transaction sent:", removeTx.hash)
        const receipt = await removeTx.wait()
        console.log("Transaction confirmed in block:", receipt?.blockNumber)
        console.log("Gas used:", receipt?.gasUsed.toString())

        // Check balances after removal
        const newLpBalance = await pair.balanceOf(deployer.address)
        const newEthBalance = await ethers.provider.getBalance(deployer.address)
        const token = await ethers.getContractAt("IERC20", TOKEN_ADDRESS)
        const newTokenBalance = await token.balanceOf(deployer.address)

        console.log("\n=== Results ===")
        console.log("Remaining LP tokens:", formatEther(newLpBalance))
        console.log("New ETH balance:", formatEther(newEthBalance))
        console.log("New token balance:", formatEther(newTokenBalance))

        // Parse events to get exact amounts received
        if (receipt) {
            for (const log of receipt.logs) {
                try {
                    const parsed = router.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    })
                    if (parsed?.name === "LiquidityRemoved") {
                        console.log("Exact amounts removed:")
                        console.log("- Token amount:", formatEther(parsed.args[1]))
                        console.log("- ETH amount:", formatEther(parsed.args[2]))
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
    console.log("=== Remove Liquidity Script ===\n")
    await removeLiquidity()
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })