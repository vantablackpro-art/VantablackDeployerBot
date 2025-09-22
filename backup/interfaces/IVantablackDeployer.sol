// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IVantablackDeployer {
    function updateDeployedTokenTaxBalance() external payable;
    function getProjectTaxBalance(
        address tokenAddress
    ) external view returns (uint256);
    function executeHandover(address tokenAddress) external;
    function closeProject() external;
}
