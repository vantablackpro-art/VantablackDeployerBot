// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface ILiquidityManager {
    struct LPLockInfo {
        bool isLocked;
        uint256 lockId;
        uint256 lockIndex;
        uint256 lockAmount;
        uint256 lockDate;
        uint256 unlockDate;
        address lockOwner;
    }

    // -------- Events --------
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
        uint256 lockId
    );
    event LPUnlockedFromUnicrypt(
        address indexed tokenAddress,
        address indexed lpPair,
        uint256 amount
    );
    event LiquidityRemoved(uint256 amountA, uint256 amountB);

    // -------- Functions --------
    function setUnicryptLocker(address _unicryptLocker) external;

    function handleLPManagement(
        address tokenAddress,
        address lpPair,
        address dev,
        uint8 lpManagementOption
    ) external returns (address lpOwner);

    function addLiquidity(
        address token,
        address lpOwner,
        uint256 tokenAmount,
        uint256 ethAmount
    ) external payable returns (uint256 liquidity);

    function removeLiquidity(
        address tokenA,
        address tokenB
    ) external returns (uint256, uint256);

    function unlockLP(
        address tokenAddress,
        address lpPair,
        address dev
    ) external;

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
        );

    function withdrawETH(uint256 amount) external;

    function withdrawToken(address token, uint256 amount) external;
    function unicryptLockerAddress() external view returns (address);

    receive() external payable;
}
