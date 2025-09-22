// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./interfaces/IOwnable.sol";
import "./interfaces/IDeployer.sol";
import "./interfaces/IToken.sol";
import "./interfaces/ILiquidityManager.sol";
// import "hardhat/console.sol";

contract VantablackDeployer is
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    struct DeployedToken {
        address tokenAddress;
        address owner;
        address dev;
        address lpPair;
        address lpOwner;
        bool isProjectClosed;
        bool roiAchieved;
        bool burnLP;
        bool lockTokens;
        uint256 lockDuration;
        uint256 projectTaxBalance;
        uint8 lpManagementOption; // 0: burn, 1: lock 1 month, 2: lock 6 months, 3: lock 1 min, 4: lock 5 mins
        uint256 lpLockExpiry;
    }

    uint256 public constant MAX_FEE = 500; // 5% maximum fee
    address public constant DEAD_ADDRESS =
        0x000000000000000000000000000000000000dEaD;
    // address constant UNISWAP_ROUTER = 0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3; // sepolia
    address constant UNISWAP_ROUTER =
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D; // poligon mainnet
    IUniswapV2Router02 public router;
    address vantablackToken;
    IDeployer public deployer;

    mapping(address => uint256) public deployedTokensIds;
    mapping(uint256 => DeployedToken) public deployedTokens;
    mapping(address => bool) public isTokenDeployedByVantablack;
    uint256 public deployedTokensCount;

    uint256 public lpFundingBalance;
    uint256 public lpFundingAmount;

    // Approved system for Vantablack LP funding
    mapping(address => bool) public approvedDevs;

    // Liquidity Manager
    ILiquidityManager public liquidityManager;

    event HandoverExecuted(
        uint256 totalTaxSent,
        address newTreasuryAddress,
        uint256 lpTokensTransferred
    );
    event ProjectClosed(
        uint256 totalTaxCollected,
        uint256 devShare,
        uint256 buybackShare,
        uint256 remainingInFunding
    );
    event LiquidityRemoved(uint256 amountA, uint256 amountB);
    event LPTokensBurned(address indexed tokenAddress, uint256 lpAmount);
    event DevApproveded(address indexed dev);
    event DevRemovedFromApproved(address indexed dev);
    event TokenDeployed(address indexed tokenAddress, address indexed dev);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        deployedTokensCount = 0;
        router = IUniswapV2Router02(UNISWAP_ROUTER);
        lpFundingBalance = 0;
        lpFundingAmount = 1 ether;
        vantablackToken = address(0);
    }

    function setLiquidityManager(address _liquidityManager) external onlyOwner {
        liquidityManager = ILiquidityManager(payable(_liquidityManager));
    }

    function setUnicryptLocker(address _unicryptLocker) external onlyOwner {
        liquidityManager.setUnicryptLocker(_unicryptLocker);
    }

    // every time someone sends eth to the contract, it increases the lpFundingBalance
    receive() external payable {
        lpFundingBalance += msg.value;
    }

    function deployToken(
        uint256[3] memory amounts, // [firstBuyAmount, lockDuration, lpManagementOption]
        address[4] memory addrs, // [owner, treasury, router, dividendTokenAddress]
        uint16[5] memory percents, // [buyFee, sellFee, transferFee, burnPercent, distributionRewardsPercent]
        bool[2] memory flags, // [hasFirstBuy, burnTokens]
        string[2] memory metadata // [name, symbol]
    ) public payable {
        // Validation
        require(
            addrs[0] != address(0) &&
                addrs[1] != address(0) &&
                addrs[2] != address(0),
            "0 addr"
        );
        require(
            percents[0] <= MAX_FEE &&
                percents[1] <= MAX_FEE &&
                percents[2] <= MAX_FEE,
            "Fee high"
        );

        // Reflection token validation
        bool hasDividendToken = addrs[3] != address(0);
        bool hasDistributionPercent = percents[4] > 0;

        if (hasDividendToken) {
            require(
                percents[4] >= 100 && percents[4] <= 5000,
                "Distribution percent must be 1-50%"
            );
        }

        if (hasDistributionPercent) {
            require(
                hasDividendToken,
                "Dividend token required when percent > 0"
            );
        }

        if (flags[1] && amounts[1] > 0) {
            revert("can't lock and burn");
        }

        require(amounts[2] <= 4, "LP opt");

        // console.log("LP funding balance:", lpFundingBalance);

        // Create a new token instance
        address[5] memory tokenAddrs = [
            addrs[0],
            addrs[1],
            UNISWAP_ROUTER,
            addrs[3],
            address(this)
        ]; // [owner, treasury, router, dividendTokenAddress, deployerAddress]
        address newToken = deployer.deployToken(
            tokenAddrs,
            percents,
            flags,
            metadata
        );
        // Token newToken = new Token(tokenAddrs, percents, metadata, flags[0]);
        deployedTokensCount++;

        bool isFundedByVantablack = this.canVantablackFund(msg.sender);

        if (!isFundedByVantablack && msg.value == 0) {
            revert("Insuficient eth");
        }

        address lpOwner = isFundedByVantablack
            ? address(liquidityManager)
            : msg.sender;
        // Check if Vantablack funding is requested and validate access
        bool requestsVantablackFunding = msg.value == 0; // If no ETH sent, user wants Vantablack funding

        // If user requests Vantablack funding but is not approved or insufficient funds, revert
        if (requestsVantablackFunding && !isFundedByVantablack) {
            if (!approvedDevs[msg.sender]) {
                revert("Not approved for Vantablack funding");
            } else {
                revert("Insufficient Vantablack funding balance");
            }
        }

        // console.log("isFundedByVantablack:", isFundedByVantablack);
        // console.log("LP Owner:", lpOwner);
        // console.log("Token balance", newToken.balanceOf(address(this)));

        // Store the deployed token information
        deployedTokensIds[address(newToken)] = deployedTokensCount;
        deployedTokens[deployedTokensCount] = DeployedToken({
            tokenAddress: address(newToken),
            owner: address(this),
            dev: msg.sender,
            lpPair: IToken(newToken).getAddresses().lpPair,
            lpOwner: lpOwner,
            projectTaxBalance: 0,
            isProjectClosed: false,
            roiAchieved: false,
            burnLP: flags[1],
            lockTokens: amounts[1] > 0, // Auto-calculate from lockDuration
            lockDuration: amounts[1],
            lpManagementOption: uint8(amounts[2]),
            lpLockExpiry: 0
        });
        isTokenDeployedByVantablack[address(newToken)] = true;

        IERC20(IToken(newToken).getAddresses().lpPair).approve(
            liquidityManager.unicryptLockerAddress(),
            0
        );
        IERC20(IToken(newToken).getAddresses().lpPair).approve(
            liquidityManager.unicryptLockerAddress(),
            type(uint256).max
        );

        // Add liquidity
        uint256 ethForLiquidity = isFundedByVantablack
            ? lpFundingAmount
            : msg.value;

        if (isFundedByVantablack) {
            lpFundingBalance -= ethForLiquidity;
        }

        // ERC20(newToken).approve(address(liquidityManager), newToken.totalSupply());
        // ERC20(newToken).approve(address(router), newToken.totalSupply());
        // liquidityManager.addLiquidity{value: ethForLiquidity}(
        //     address(newToken),
        //     lpOwner,
        //     newToken.totalSupply(),
        //     ethForLiquidity
        // );

        IERC20(newToken).approve(
            address(router),
            IERC20(newToken).totalSupply()
        );
        router.addLiquidityETH{value: ethForLiquidity}(
            address(newToken),
            IERC20(newToken).totalSupply(),
            0,
            0,
            lpOwner,
            block.timestamp + 500
        );

        // if first buy is enabled, execute it
        if (flags[0]) {
            _swapEthForTokens(address(newToken), msg.sender, amounts[0]);
        }
        emit TokenDeployed(address(newToken), msg.sender);
    }

    function _swapEthForTokens(
        address tokenAddress,
        address to,
        uint256 ethAmount
    ) internal nonReentrant {
        router.swapExactETHForTokens{value: ethAmount}(
            0,
            getPath(address(router.WETH()), tokenAddress),
            to,
            block.timestamp + 500
        );
    }

    function getPath(
        address token0,
        address token1
    ) internal pure returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = token0;
        path[1] = token1;
        return path;
    }

    function updateDeployedTokenTaxBalance() external payable {
        DeployedToken storage token = _getTokenInfo(msg.sender);
        token.projectTaxBalance += msg.value;
    }

    function updateDeployerAddress(address newDeployer) external onlyOwner {
        require(newDeployer != address(0), "0 addr");
        deployer = IDeployer(newDeployer);
    }

    function _getTokenInfo(
        address tokenAddress
    ) internal view returns (DeployedToken storage) {
        require(isTokenDeployedByVantablack[tokenAddress], "Not VB token");
        return deployedTokens[deployedTokensIds[tokenAddress]];
    }

    function getProjectTaxBalance(
        address tokenAddress
    ) external view returns (uint256) {
        DeployedToken storage token = _getTokenInfo(tokenAddress);
        return token.projectTaxBalance;
    }

    function executeHandover(address tokenAddress) external nonReentrant {
        DeployedToken storage token = _getTokenInfo(tokenAddress);

        require(!token.roiAchieved, "ROI done");
        token.roiAchieved = true;

        // Handle LP tokens based on management option and update lpOwner
        address newLpOwner = liquidityManager.handleLPManagement(
            token.tokenAddress,
            token.lpPair,
            token.dev,
            token.lpManagementOption
        );

        // Update lpOwner based on the result of LP management in case he not burn it
        token.lpOwner = newLpOwner;

        // Set lock expiry if tokens should be locked (not burned)
        if (token.lockDuration > 0 && !token.burnLP) {
            token.lpLockExpiry = block.timestamp + token.lockDuration;
        }

        // Transfer token ownership to dev
        IOwnable(token.tokenAddress).transferOwnership(token.dev);
    }

    function closeProject(address tokenAddress) external onlyOwner {
        DeployedToken storage token = _getTokenInfo(tokenAddress);
        require(!token.isProjectClosed, "Closed");

        if (token.projectTaxBalance > 0) {
            // Calculate distributions: 25% to dev, 25% for buyback, 50% stays in funding wallet
            uint256 devShare = (token.projectTaxBalance * 25) / 100;
            uint256 buybackShare = (token.projectTaxBalance * 25) / 100;
            uint256 remainingInFunding = token.projectTaxBalance -
                devShare -
                buybackShare;

            if (devShare > 0) {
                (bool successDev, ) = payable(token.dev).call{value: devShare}(
                    ""
                );
                require(successDev, "Transfer fail");
            }

            if (buybackShare > 0 && vantablackToken != address(0)) {
                _swapEthForTokens(vantablackToken, msg.sender, buybackShare);
            }

            // Remove LP tokens and return to vantablack funding wallet
            (, uint256 amountEth) = liquidityManager.removeLiquidity(
                token.tokenAddress,
                router.WETH()
            );

            lpFundingBalance += amountEth + remainingInFunding;

            emit ProjectClosed(
                token.projectTaxBalance,
                devShare,
                buybackShare,
                remainingInFunding
            );
            token.projectTaxBalance = 0;
            token.isProjectClosed = true;
        }
    }

    function setLpFundingAmount(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Invalid amt");
        lpFundingAmount = _amount;
    }

    function withdrawEth(uint256 amount) external onlyOwner {
        uint256 balance = address(this).balance;
        require(amount <= balance, "Invalid amt");
        if (balance > 0) {
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, "Transfer fail");
        }
    }

    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(amount <= balance, "Invalid amt");
        if (balance > 0) {
            IERC20(token).transfer(msg.sender, amount);
        }
    }

    function unlockLP(address tokenAddress) external {
        DeployedToken storage token = _getTokenInfo(tokenAddress);
        require(msg.sender == token.lpOwner, "Not LP owner");
        liquidityManager.unlockLP(tokenAddress, token.lpPair, token.lpOwner);
    }

    function getLPLockInfo(
        address tokenAddress
    )
        external
        view
        returns (
            uint8 lpManagementOption,
            uint256 lpLockExpiry,
            uint256 lpBalance,
            bool canUnlock,
            bool isUnicryptLocked,
            uint256 unicryptUnlockDate,
            uint256 unicryptLockAmount,
            address lockOwner,
            uint256 lockIndex
        )
    {
        DeployedToken storage token = _getTokenInfo(tokenAddress);

        lpManagementOption = token.lpManagementOption;
        lpLockExpiry = token.lpLockExpiry;
        lpBalance = IERC20(token.lpPair).balanceOf(address(this));
        canUnlock = lpLockExpiry > 0 && block.timestamp >= lpLockExpiry;

        (
            isUnicryptLocked,
            unicryptUnlockDate,
            unicryptLockAmount,
            lockOwner,
            lockIndex
        ) = liquidityManager.getLPLockInfoByPair(token.lpPair);
    }

    // Approved management functions
    function addToApproved(address dev) external onlyOwner {
        approvedDevs[dev] = true;
        emit DevApproveded(dev);
    }

    function removeFromApproved(address dev) external onlyOwner {
        approvedDevs[dev] = false;
        emit DevRemovedFromApproved(dev);
    }

    function isApproveded(address dev) external view returns (bool) {
        return approvedDevs[dev];
    }

    function estimateFirstBuyTokens(
        uint256 ethAmount,
        uint256 ethLiquidityAmount,
        uint256 tokenLiquidityAmount,
        uint16 buyTax
    ) public pure returns (uint256 tokensReceived, uint256 taxAmount) {
        taxAmount = (ethAmount * buyTax) / 10000;
        uint256 ethAfterTax = ethAmount - taxAmount;
        uint256 numerator = tokenLiquidityAmount * ethAfterTax;
        uint256 denominator = ethLiquidityAmount + ethAfterTax;
        tokensReceived = numerator / denominator;
    }

    function canVantablackFund(address user) external view returns (bool) {
        return lpFundingBalance >= lpFundingAmount && approvedDevs[user];
    }

    function setVantablackToken(address _vantablackToken) external onlyOwner {
        require(_vantablackToken != address(0), "0 addr");
        vantablackToken = _vantablackToken;
    }
}
