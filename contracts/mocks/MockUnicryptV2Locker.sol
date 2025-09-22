// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUnicryptV2Locker {
    uint256 public constant ETH_FEE = 0.01 ether;

    mapping(address => mapping(address => uint256)) public userNumLocksForToken;
    bool public shouldFail = false;

    struct TokenLock {
        uint256 lockDate;
        uint256 amount;
        uint256 initialAmount;
        uint256 unlockDate;
        uint256 lockID;
        address owner;
    }

    mapping(address => mapping(address => mapping(uint256 => TokenLock))) public locks;

    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }

    function lockLPToken(
        address _lpToken,
        uint256 _amount,
        uint256 _unlock_date,
        address payable _referral,
        bool _fee_in_eth,
        address payable _withdrawer
    ) external payable {
        if (shouldFail) {
            revert("Mock failure");
        }

        require(msg.value >= ETH_FEE, "Insufficient ETH fee");

        // Transfer LP tokens to this contract
        IERC20(_lpToken).transferFrom(msg.sender, address(this), _amount);

        // Increment user's lock count
        uint256 lockIndex = userNumLocksForToken[_withdrawer][_lpToken];
        userNumLocksForToken[_withdrawer][_lpToken]++;

        // Store lock info
        locks[_withdrawer][_lpToken][lockIndex] = TokenLock({
            lockDate: block.timestamp,
            amount: _amount,
            initialAmount: _amount,
            unlockDate: _unlock_date,
            lockID: lockIndex,
            owner: _withdrawer
        });
    }

    function withdraw(
        address _lpToken,
        uint256 _index,
        uint256 _lockID,
        uint256 _amount
    ) external {
        TokenLock storage lock = locks[msg.sender][_lpToken][_index];
        require(lock.owner == msg.sender, "Not lock owner");
        require(block.timestamp >= lock.unlockDate, "Still locked");
        require(lock.amount >= _amount, "Insufficient locked amount");

        lock.amount -= _amount;
        IERC20(_lpToken).transfer(msg.sender, _amount);
    }

    function getUserNumLocksForToken(
        address _user,
        address _lpToken
    ) external view returns (uint256) {
        return userNumLocksForToken[_user][_lpToken];
    }

    function getUserLockForTokenAtIndex(
        address _user,
        address _lpToken,
        uint256 _index
    ) external view returns (
        uint256 lockDate,
        uint256 amount,
        uint256 initialAmount,
        uint256 unlockDate,
        uint256 lockID,
        address owner
    ) {
        TokenLock storage lock = locks[_user][_lpToken][_index];
        return (
            lock.lockDate,
            lock.amount,
            lock.initialAmount,
            lock.unlockDate,
            lock.lockID,
            lock.owner
        );
    }

    function gFees() external pure returns (
        uint256 ethFee,
        address secondaryFeeToken,
        uint256 secondaryTokenFee,
        uint256 secondaryTokenDiscount,
        uint256 liquidityFee,
        uint256 referralPercent,
        address referralToken,
        uint256 referralHold,
        uint256 referralDiscount
    ) {
        return (
            ETH_FEE,
            address(0),
            0,
            0,
            0,
            0,
            address(0),
            0,
            0
        );
    }

    // Allow contract to receive ETH
    receive() external payable {}
}