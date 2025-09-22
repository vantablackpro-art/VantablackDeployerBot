// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUnicryptV2Locker.sol";

/**
 * @title LiquidityManager
 */
contract LiquidityManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct LPLockInfo {
        bool isLocked;
        uint256 lockId; // if available from locker
        uint256 lockIndex; // index returned by getUserNumLocksForToken - 1
        uint256 lockAmount;
        uint256 lockDate;
        uint256 unlockDate;
        address lockOwner;
    }

    uint256 public constant LOCK_1_MIN = 1 minutes;
    uint256 public constant LOCK_5_MINS = 5 minutes;
    uint256 public constant LOCK_1_MONTH = 30 days;
    uint256 public constant LOCK_6_MONTHS = 180 days;
    address public constant DEAD_ADDRESS =
        0x000000000000000000000000000000000000dEaD;

    IUniswapV2Router02 public router;
    IUnicryptV2Locker public unicryptLocker;

    // track locks per LP pair (keyed by lpPair address)
    mapping(address => LPLockInfo) public lpLockInfoByPair;

    // kept for backward compatibility with external callers; prefer using lpPair keyed mapping
    // mapping(address => LPLockInfo) public lpLockInfo; // removed to avoid confusion

    address public admin;

    event LPTokensBurned(address indexed tokenAddress, uint256 lpAmount);
    event LPTokensLocked(
        address indexed tokenAddress,
        uint256 lpAmount,
        uint256 unlockTime
    );
    event LPTokensUnlocked(address indexed tokenAddress, uint256 lpAmount);
    event LPLockedWithUnicrypt(
        address indexed tokenAddress,
        address indexed lpPair,
        uint256 amount,
        uint256 unlockDate,
        uint256 lockId,
        uint256 lockIndex
    );
    event LPUnlockedFromUnicrypt(
        address indexed tokenAddress,
        address indexed lpPair,
        uint256 amount
    );
    event LiquidityRemoved(uint256 amountA, uint256 amountB);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    modifier onlyOwnerOrAdmin() {
        require(
            msg.sender == owner() || msg.sender == admin,
            "Not owner or admin"
        );
        _;
    }

    constructor(address _router) Ownable(msg.sender) {
        require(_router != address(0), "Router zero");
        router = IUniswapV2Router02(_router);
        admin = msg.sender;
    }

    /**
     * @notice Set Unicrypt locker address
     */
    function setUnicryptLocker(
        address _unicryptLocker
    ) external onlyOwnerOrAdmin {
        unicryptLocker = IUnicryptV2Locker(_unicryptLocker);
    }

    /**
     * @notice Set or change admin
     */
    function setAdmin(address _admin) external onlyOwner {
        emit AdminChanged(admin, _admin);
        admin = _admin;
    }

    /**
     * @notice Manage LP stored in this contract according to option.
     * @param tokenAddress Token address (for bookkeeping/events)
     * @param lpPair LP token pair address
     * @param dev Developer address to be set as lock owner on Unicrypt
     * @param lpManagementOption Option: 0 burn, 1 lock 1 month, 2 lock 6 months, 3/4 testing short locks
     */
    function handleLPManagement(
        address tokenAddress,
        address lpPair,
        address dev,
        uint8 lpManagementOption
    ) external onlyOwnerOrAdmin nonReentrant returns (address lpOwner) {
        require(lpPair != address(0), "LP pair zero");

        uint256 lpBalance = IERC20(lpPair).balanceOf(address(this));
        if (lpBalance == 0) return address(0);

        if (lpManagementOption == 0) {
            // burn (send to dead address) using safeTransfer
            IERC20(lpPair).safeTransfer(DEAD_ADDRESS, lpBalance);
            emit LPTokensBurned(tokenAddress, lpBalance);
            return DEAD_ADDRESS; // LP tokens burned, owner is dead address
        } else if (lpManagementOption == 1) {
            _lockLPWithUnicrypt(
                tokenAddress,
                lpPair,
                lpBalance,
                dev,
                LOCK_1_MONTH
            );
            return dev; // LP tokens locked, owner is dev
        } else if (lpManagementOption == 2) {
            _lockLPWithUnicrypt(
                tokenAddress,
                lpPair,
                lpBalance,
                dev,
                LOCK_6_MONTHS
            );
            return dev; // LP tokens locked, owner is dev
        } else if (lpManagementOption == 3) {
            _lockLPWithUnicrypt(
                tokenAddress,
                lpPair,
                lpBalance,
                dev,
                LOCK_1_MIN
            );
            return dev; // LP tokens locked for 1 minute (testing)
        } else if (lpManagementOption == 4) {
            _lockLPWithUnicrypt(
                tokenAddress,
                lpPair,
                lpBalance,
                dev,
                LOCK_5_MINS
            );
            return dev; // LP tokens locked for 5 minutes (testing)
        } else {
            revert("Invalid option");
        }
    }

    /**
     * @dev Internal helper to lock LP into Unicrypt. This function does basic checks
     * and records lock index and amount. Because different Unicrypt versions have
     * different return values, we read user lock count after the call and store index safely.
     */
    function _lockLPWithUnicrypt(
        address tokenAddress,
        address lpPair,
        uint256 amount,
        address dev,
        uint256 lockDuration
    ) internal {
        require(address(unicryptLocker) != address(0), "No locker");
        require(amount > 0, "No LP to lock");
        require(lpPair != address(0), "LP pair zero");
        require(dev != address(0), "Dev zero");

        uint256 unlockDate = block.timestamp + lockDuration;

        // Approve locker to transfer LP tokens from this contract
        IERC20(lpPair).approve(address(unicryptLocker), 0);
        IERC20(lpPair).approve(address(unicryptLocker), type(uint256).max);

        // Read fee and ensure we have ETH to pay it
        (uint256 ethFee, , , , , , , , ) = unicryptLocker.gFees();
        require(address(this).balance >= ethFee, "Insufficient ETH for fee");

        // Use try/catch to bubble revert reason where possible
        try
            unicryptLocker.lockLPToken{value: ethFee}(
                lpPair,
                amount,
                unlockDate,
                payable(address(0)),
                true,
                payable(dev)
            )
        {
            // After successful lock we query number of locks for the user to determine index
            uint256 userLocks = unicryptLocker.getUserNumLocksForToken(
                dev,
                lpPair
            );
            require(userLocks > 0, "No user locks reported");

            uint256 lockIndex = userLocks - 1;

            // We can't always reliably read lockId from the return value of lockLPToken
            // because Unicrypt implementations differ, so we store 0 if not available.
            // Consumer can call getLPLockInfoByPair to see recorded unlock date and lockIndex.

            lpLockInfoByPair[lpPair] = LPLockInfo({
                isLocked: true,
                lockId: 0,
                lockIndex: lockIndex,
                lockAmount: amount,
                lockDate: block.timestamp,
                unlockDate: unlockDate,
                lockOwner: dev
            });

            emit LPLockedWithUnicrypt(
                tokenAddress,
                lpPair,
                amount,
                unlockDate,
                0,
                lockIndex
            );
        } catch {
            revert("Lock fail");
        }

        // reset approval to 0 as a best practice
        IERC20(lpPair).approve(address(unicryptLocker), 0);
    }

    /**
     * @notice Remove liquidity from a token/WETH pair held by this contract.
     * The function checks pair existence and that the LP balance > 0.
     */
    function removeLiquidity(
        address tokenA,
        address tokenB
    ) external onlyOwnerOrAdmin nonReentrant returns (uint256, uint256) {
        address token0 = tokenA;
        address token1 = tokenB;
        if (tokenA > tokenB) {
            token0 = tokenB;
            token1 = tokenA;
        }
        address pair = IUniswapV2Factory(router.factory()).getPair(
            token0,
            token1
        );
        require(pair != address(0), "Pair doesn't exist");

        uint256 liquidity = IERC20(pair).balanceOf(address(this));
        require(liquidity > 0, "No liquidity");
        IERC20(pair).approve(address(router), 0);
        IERC20(pair).approve(address(router), liquidity);

        (uint256 amountA, uint256 amountB) = router.removeLiquidity(
            token0,
            token1,
            liquidity,
            0,
            0,
            address(this),
            block.timestamp
        );

        uint256 amountToken;
        uint256 amountETH;
        if (token0 == router.WETH()) {
            amountETH = amountA;
            amountToken = amountB;
        } else if (token1 == router.WETH()) {
            amountETH = amountB;
            amountToken = amountA;
        } else {
            revert("No WETH pair");
        }

        emit LiquidityRemoved(amountToken, amountETH);
        return (amountToken, amountETH);
    }

    /**
     * @notice Add liquidity (token + ETH) and send LP tokens to lpOwner
     */
    function addLiquidity(
        address token,
        address lpOwner,
        uint256 tokenAmount,
        uint256 ethAmount
    ) external payable onlyOwnerOrAdmin nonReentrant returns (uint256 liquidity) {
        require(token != address(0), "Token zero");
        require(lpOwner != address(0), "LP owner zero");
        require(tokenAmount > 0 || ethAmount > 0, "Zero amounts");

        IERC20(token).approve(address(router), 0);
        IERC20(token).approve(address(router), type(uint256).max);

        (, , liquidity) = router.addLiquidityETH{value: ethAmount}(
            token,
            tokenAmount,
            0,
            0,
            lpOwner,
            block.timestamp + 500
        );

        return liquidity;
    }

    /**
     * @notice Mark LP record as unlocked in internal bookkeeping. IMPORTANT: this does NOT
     * automatically withdraw LP from Unicrypt locker. Use Unicrypt UI/contract to withdraw
     * the LP tokens and then call this function to update local state. This avoids making
     * assumptions about Unicrypt's withdraw function signature in this integrator contract.
     */
    function unlockLP(
        address tokenAddress,
        address lpPair
    ) external onlyOwnerOrAdmin {
        LPLockInfo storage lockInfo = lpLockInfoByPair[lpPair];

        require(lockInfo.isLocked, "Not locked");

        // simply update local bookkeeping. The actual LP withdrawal must be performed
        // by owner/admin using the Unicrypt locker interface (off-chain UI or a custom call).
        lockInfo.isLocked = false;

        emit LPUnlockedFromUnicrypt(tokenAddress, lpPair, lockInfo.lockAmount);
    }

    /**
     * @notice Get lock info for a given LP pair (preferred over old token-keyed getter)
     */
    function getLPLockInfoByPair(
        address lpPair
    )
        external
        view
        returns (
            bool isUnicryptLocked,
            uint256 unicryptUnlockDate,
            uint256 unicryptLockAmount,
            address lockOwner,
            uint256 lockIndex
        )
    {
        LPLockInfo storage lockInfo = lpLockInfoByPair[lpPair];
        return (
            lockInfo.isLocked,
            lockInfo.unlockDate,
            lockInfo.lockAmount,
            lockInfo.lockOwner,
            lockInfo.lockIndex
        );
    }

    function withdrawETH(
        uint256 amount
    ) external onlyOwnerOrAdmin nonReentrant {
        require(amount <= address(this).balance, "Invalid amt");
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer fail");
    }

    function withdrawToken(
        address token,
        uint256 amount
    ) external onlyOwnerOrAdmin nonReentrant {
        require(token != address(0), "Token zero");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(amount <= balance, "Invalid amt");
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    function unicryptLockerAddress() external view returns (address) {
        return address(unicryptLocker);
    }

    receive() external payable {}
}
