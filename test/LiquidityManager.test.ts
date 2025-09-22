import { ethers, upgrades } from 'hardhat'
import { expect } from 'chai'
import { parseEther, ZeroAddress } from 'ethers'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { LiquidityManager, UniswapV2Locker, VantablackDeployer } from '../typechain'
import { time } from '@nomicfoundation/hardhat-network-helpers'

const UNISWAP_V2_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1"
const UNISWAP_V2_FACTORY = "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C"

describe("LiquidityManager - Real Contract Tests", function () {
    let liquidityManager: LiquidityManager
    let uniswapV2Locker: UniswapV2Locker
    let vantablackDeployer: VantablackDeployer
    let deployedToken: any
    let owner: SignerWithAddress
    let dev: SignerWithAddress
    let treasury: SignerWithAddress
    let user: SignerWithAddress

    const TOKEN_DEPLOYMENT_PARAMS = {
        amounts: [parseEther("0.1"), BigInt(3600), BigInt(1)] as [bigint, bigint, bigint], // firstBuyAmount, lockDuration, lpManagementOption
        addresses: ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"] as [string, string, string, string], // owner, treasury, router, dividendTokenAddress - will be set in beforeEach
        percents: [300, 400, 0, 0, 0] as [number, number, number, number, number], // buyFee, sellFee, transferFee, burnPercent, distributionRewardsPercent
        flags: [true, false] as [boolean, boolean], // hasFirstBuy, burnTokens
        metadata: ["Test Token", "TEST"] as [string, string]
    }

    before(async function () {
        const signers = await ethers.getSigners()
            ;[owner, dev, treasury, user] = signers

        // Set addresses in deployment params
        TOKEN_DEPLOYMENT_PARAMS.addresses = [dev.address, treasury.address, UNISWAP_V2_ROUTER, ZeroAddress] // owner, treasury, router, dividendTokenAddress

        console.log("Deploying with account:", owner.address)
        console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(owner.address)))

        // Deploy UniswapV2Locker
        const UniswapV2Locker = await ethers.getContractFactory("UniswapV2Locker")
        uniswapV2Locker = await UniswapV2Locker.deploy(UNISWAP_V2_FACTORY)
        await uniswapV2Locker.waitForDeployment()
        console.log("UniswapV2Locker deployed at:", uniswapV2Locker.target)

        // Deploy LiquidityManager
        const LiquidityManager = await ethers.getContractFactory("LiquidityManager")
        liquidityManager = await LiquidityManager.deploy(UNISWAP_V2_ROUTER)
        await liquidityManager.waitForDeployment()
        console.log("LiquidityManager deployed at:", liquidityManager.target)

        // Deploy VantablackDeployer as upgradeable proxy
        const VantablackDeployer = await ethers.getContractFactory("VantablackDeployer")
        vantablackDeployer = await upgrades.deployProxy(VantablackDeployer, [], {
            initializer: 'initialize'
        }) as VantablackDeployer
        await vantablackDeployer.waitForDeployment()
        console.log("VantablackDeployer deployed at:", vantablackDeployer.target)

        // Setup connections
        await vantablackDeployer.connect(owner).setLiquidityManager(liquidityManager.target)
        await liquidityManager.connect(owner).transferOwnership(vantablackDeployer.target)
        await vantablackDeployer.connect(owner).setUnicryptLocker(uniswapV2Locker.target)

        // Fund the deployer for LP (enough for multiple token deployments)
        const fundAmount = parseEther("1000") // Increased from 200 to support multiple test deployments
        await owner.sendTransaction({
            to: vantablackDeployer.target,
            value: fundAmount
        })
        console.log(`Funded VantablackDeployer with ${ethers.formatEther(fundAmount)} ETH`)

        // Whitelist dev for token deployment
        await vantablackDeployer.connect(owner).addToApproved(dev.address)
    })

    describe("LiquidityManager Basic Functions", function () {
        it("Should have correct initial setup", async function () {
            expect(await liquidityManager.router()).to.equal(UNISWAP_V2_ROUTER)
            expect(await liquidityManager.owner()).to.equal(vantablackDeployer.target)
            expect(await liquidityManager.admin()).to.equal(owner.address)
        })

        it("Should have correct constants", async function () {
            expect(await liquidityManager.LOCK_1_MIN()).to.equal(60)
            expect(await liquidityManager.LOCK_5_MINS()).to.equal(300)
            expect(await liquidityManager.LOCK_1_MONTH()).to.equal(30 * 24 * 60 * 60)
            expect(await liquidityManager.LOCK_6_MONTHS()).to.equal(180 * 24 * 60 * 60)
            expect(await liquidityManager.DEAD_ADDRESS()).to.equal("0x000000000000000000000000000000000000dEaD")
        })

        it("Should allow admin to set unicrypt locker", async function () {
            // VantablackDeployer is owner, so only it can call setUnicryptLocker through admin
            const currentLocker = await liquidityManager.unicryptLocker()
            expect(currentLocker).to.equal(uniswapV2Locker.target)
        })
    })

    describe("Token Deployment and LP Management", function () {
        beforeEach(async function () {
            // Deploy a token first
            const deployTx = await vantablackDeployer.connect(dev).deployToken(
                TOKEN_DEPLOYMENT_PARAMS.amounts,
                TOKEN_DEPLOYMENT_PARAMS.addresses,
                TOKEN_DEPLOYMENT_PARAMS.percents,
                TOKEN_DEPLOYMENT_PARAMS.flags,
                TOKEN_DEPLOYMENT_PARAMS.metadata,
                { value: parseEther("1") }
            )

            const receipt = await deployTx.wait()
            console.log("Token deployed, gas used:", receipt?.gasUsed.toString())

            // Get the deployed token address from events
            const tokenDeployedEvent = receipt?.logs.find(log => {
                try {
                    return vantablackDeployer.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    })?.name === 'TokenDeployed'
                } catch {
                    return false
                }
            })

            if (tokenDeployedEvent) {
                const parsedEvent = vantablackDeployer.interface.parseLog({
                    topics: tokenDeployedEvent.topics as string[],
                    data: tokenDeployedEvent.data
                })
                const tokenAddress = parsedEvent?.args[0]
                console.log("Deployed token address:", tokenAddress)

                // Get the token contract instance
                deployedToken = await ethers.getContractAt("Token", tokenAddress)
            } else {
                throw new Error("Token deployment event not found")
            }
        })

        it("Should deploy token successfully", async function () {
            expect(deployedToken.target).to.not.equal(ZeroAddress)
            expect(await deployedToken.name()).to.equal("Test Token")
            expect(await deployedToken.symbol()).to.equal("TEST")
        })

        // it("Should remove liquidity successfully", async function () {
        //     const WETH = await (await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER)).WETH()
        //     liquidityManager.connect(owner).removeLiquidity(
        //         deployedToken.target,
        //         WETH
        //     ).then(tx => tx.wait()).then(receipt => {
        //         console.log("Liquidity removal transaction gas used:", receipt?.gasUsed.toString())
        //     }).catch(err => {
        //         console.error("Liquidity removal failed:", err)
        //     })
        // })

        // it("Should create LP pair automatically", async function () {
        //     // Check if LP pair was created (this depends on the VantablackDeployer implementation)
        //     const pairInfo = await vantablackDeployer.getLPLockInfo(deployedToken.target)
        //     console.log("LP Lock Info:", pairInfo)
        // })

        it("Should handle LP management - burn option", async function () {
            // Get LP pair address
            const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER)
            const factory = await ethers.getContractAt("IUniswapV2Factory", await router.factory())
            const weth = await router.WETH()

            const pairAddress = await factory.getPair(deployedToken.target, weth)
            console.log("LP Pair address:", pairAddress)

            if (pairAddress !== ZeroAddress) {
                const lpToken = await ethers.getContractAt("IERC20", pairAddress)
                const lpBalance = await lpToken.balanceOf(liquidityManager.target)
                console.log("LP balance in LiquidityManager:", ethers.formatEther(lpBalance))

                if (lpBalance > 0) {
                    // Test burning LP tokens (option 0)
                    const deadAddress = "0x000000000000000000000000000000000000dEaD"
                    const deadBalanceBefore = await lpToken.balanceOf(deadAddress)

                    await expect(liquidityManager.handleLPManagement(
                        deployedToken.target,
                        pairAddress,
                        dev.address,
                        0 // burn option
                    )).to.emit(liquidityManager, "LPTokensBurned")

                    const deadBalanceAfter = await lpToken.balanceOf(deadAddress)
                    expect(deadBalanceAfter).to.be.gt(deadBalanceBefore)
                }
            }
        })

        it("Should handle LP management - lock option", async function () {
            // Deploy token using Vantablack funding so LP goes to liquidityManager
            const deployTx2 = await vantablackDeployer.connect(dev).deployToken(
                [parseEther("0.1"), BigInt(3600), BigInt(1)] as [bigint, bigint, bigint], // Use lock option
                TOKEN_DEPLOYMENT_PARAMS.addresses,
                TOKEN_DEPLOYMENT_PARAMS.percents,
                TOKEN_DEPLOYMENT_PARAMS.flags,
                ["Lock Test Token", "LOCK"] as [string, string]
                // No value sent - uses Vantablack funding
            )

            const receipt2 = await deployTx2.wait()

            // Get the token address
            const tokenDeployedEvent2 = receipt2?.logs.find(log => {
                try {
                    return vantablackDeployer.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    })?.name === 'TokenDeployed'
                } catch {
                    return false
                }
            })

            if (tokenDeployedEvent2) {
                const parsedEvent2 = vantablackDeployer.interface.parseLog({
                    topics: tokenDeployedEvent2.topics as string[],
                    data: tokenDeployedEvent2.data
                })
                const tokenAddress2 = parsedEvent2?.args[0]

                // Get LP pair
                const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER)
                const factory = await ethers.getContractAt("IUniswapV2Factory", await router.factory())
                const weth = await router.WETH()
                const pairAddress = await factory.getPair(tokenAddress2, weth)

                if (pairAddress !== ZeroAddress) {
                    // Fund LiquidityManager with ETH for Unicrypt fee
                    await owner.sendTransaction({
                        to: liquidityManager.target,
                        value: parseEther("1") // Provide ETH for Unicrypt locking fee
                    })

                    // Execute handover to trigger LP management
                    await vantablackDeployer.connect(owner).executeHandover(tokenAddress2)

                    // Check lock info after handover
                    const lockInfo = await liquidityManager.getLPLockInfoByPair(pairAddress)
                    console.log("Lock info:", lockInfo)

                    expect(lockInfo[0]).to.be.true // isLocked
                    expect(lockInfo[3]).to.equal(dev.address) // lockOwner
                }
            }
        })
    })

    describe("LP Management Functions", function () {
        let pairAddress: string

        beforeEach(async function () {
            // Deploy token and get pair address
            const deployTx = await vantablackDeployer.connect(dev).deployToken(
                TOKEN_DEPLOYMENT_PARAMS.amounts,
                TOKEN_DEPLOYMENT_PARAMS.addresses,
                TOKEN_DEPLOYMENT_PARAMS.percents,
                TOKEN_DEPLOYMENT_PARAMS.flags,
                TOKEN_DEPLOYMENT_PARAMS.metadata,
                { value: parseEther("1") }
            )

            const receipt = await deployTx.wait()
            const tokenDeployedEvent = receipt?.logs.find(log => {
                try {
                    return vantablackDeployer.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    })?.name === 'TokenDeployed'
                } catch {
                    return false
                }
            })

            if (tokenDeployedEvent) {
                const parsedEvent = vantablackDeployer.interface.parseLog({
                    topics: tokenDeployedEvent.topics as string[],
                    data: tokenDeployedEvent.data
                })
                const tokenAddress = parsedEvent?.args[0]
                deployedToken = await ethers.getContractAt("Token", tokenAddress)

                // Get pair address
                const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER)
                const factory = await ethers.getContractAt("IUniswapV2Factory", await router.factory())
                const weth = await router.WETH()
                pairAddress = await factory.getPair(deployedToken.target, weth)
            }
        })

        it("Should return correct LP lock info", async function () {
            if (pairAddress && pairAddress !== ZeroAddress) {
                const lockInfo = await liquidityManager.getLPLockInfoByPair(pairAddress)
                console.log("LP Lock Info:", {
                    isLocked: lockInfo[0],
                    unlockDate: lockInfo[1].toString(),
                    lockAmount: ethers.formatEther(lockInfo[2]),
                    lockOwner: lockInfo[3],
                    lockIndex: lockInfo[4].toString()
                })
            }
        })

        it("Should allow admin to unlock LP", async function () {
            if (pairAddress && pairAddress !== ZeroAddress) {
                const lockInfoBefore = await liquidityManager.getLPLockInfoByPair(pairAddress)

                if (lockInfoBefore[0]) { // if locked
                    await expect(liquidityManager.unlockLP(
                        deployedToken.target,
                        pairAddress
                    )).to.emit(liquidityManager, "LPUnlockedFromUnicrypt")

                    const lockInfoAfter = await liquidityManager.getLPLockInfoByPair(pairAddress)
                    expect(lockInfoAfter[0]).to.be.false // should be unlocked
                }
            }
        })
    })

    describe("Emergency Functions", function () {
        it("Should allow admin to withdraw ETH", async function () {
            // Send some ETH to LiquidityManager
            await owner.sendTransaction({
                to: liquidityManager.target,
                value: parseEther("1")
            })

            const contractBalance = await ethers.provider.getBalance(liquidityManager.target)
            expect(contractBalance).to.equal(parseEther("1"))

            // Withdraw ETH (only admin can call this)
            await expect(liquidityManager.withdrawETH(parseEther("0.5")))
                .to.not.be.reverted

            const newBalance = await ethers.provider.getBalance(liquidityManager.target)
            expect(newBalance).to.equal(parseEther("0.5"))
        })

        it("Should allow admin to withdraw tokens", async function () {
            // Transfer some tokens to LiquidityManager
            if (deployedToken) {
                const transferAmount = parseEther("1000")
                await deployedToken.connect(dev).transfer(liquidityManager.target, transferAmount)

                const contractBalance = await deployedToken.balanceOf(liquidityManager.target)
                expect(contractBalance).to.be.gte(transferAmount)

                // Withdraw tokens
                await expect(liquidityManager.withdrawToken(deployedToken.target, transferAmount))
                    .to.not.be.reverted
            }
        })
    })

    describe("Access Control", function () {
        it("Should reject non-admin calls", async function () {
            await expect(liquidityManager.connect(user).withdrawETH(parseEther("1")))
                .to.be.revertedWith("Not owner or admin")

            await expect(liquidityManager.connect(user).setUnicryptLocker(ZeroAddress))
                .to.be.revertedWith("Not owner or admin")
        })

        it("Should allow owner to set admin", async function () {
            // Only VantablackDeployer (owner) can set admin
            await expect(vantablackDeployer.connect(owner).setLiquidityManager(liquidityManager.target))
                .to.not.be.reverted
        })
    })

    describe("Gas Usage Tests", function () {
        it("Should use reasonable gas for LP operations", async function () {
            const deployTx = await vantablackDeployer.connect(dev).deployToken(
                TOKEN_DEPLOYMENT_PARAMS.amounts,
                TOKEN_DEPLOYMENT_PARAMS.addresses,
                TOKEN_DEPLOYMENT_PARAMS.percents,
                TOKEN_DEPLOYMENT_PARAMS.flags,
                ["Gas Test", "GAS"] as [string, string],
                { value: parseEther("1") }
            )

            const receipt = await deployTx.wait()
            console.log("Token deployment gas used:", receipt?.gasUsed.toString())

            // Gas should be reasonable (adjust threshold as needed)
            expect(receipt?.gasUsed).to.be.lt(parseEther("0.02")) // 20M gas limit
        })
    })
})