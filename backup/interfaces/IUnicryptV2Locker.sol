// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IUnicryptV2Locker {
    struct TokenLock {
        uint256 lockDate; // the date the token was locked
        uint256 amount; // the amount of tokens still locked
        uint256 initialAmount; // the initial lock amount
        uint256 unlockDate; // the date the token can be withdrawn
        uint256 lockID; // lockID nonce per uni pair
        address owner;
    }

    function lockLPToken(
        address _lpToken,
        uint256 _amount,
        uint256 _unlock_date,
        address payable _referral,
        bool _fee_in_eth,
        address payable _withdrawer
    ) external payable;

    function withdraw(
        address _lpToken,
        uint256 _index,
        uint256 _lockID,
        uint256 _amount
    ) external;

    function relock(
        address _lpToken,
        uint256 _index,
        uint256 _lockID,
        uint256 _unlock_date
    ) external;

    function transferLockOwnership(
        address _lpToken,
        uint256 _index,
        uint256 _lockID,
        address payable _newOwner
    ) external;

    function getUserNumLocksForToken(
        address _user,
        address _lpToken
    ) external view returns (uint256);

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
    );

    function getNumLocksForToken(address _lpToken) external view returns (uint256);

    // Fee structure
    function gFees() external view returns (
        uint256 ethFee,
        address secondaryFeeToken,
        uint256 secondaryTokenFee,
        uint256 secondaryTokenDiscount,
        uint256 liquidityFee,
        uint256 referralPercent,
        address referralToken,
        uint256 referralHold,
        uint256 referralDiscount
    );
}