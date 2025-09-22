// ██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗███████╗██████╗
// ██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗╚██╗ ██╔╝██╔════╝██╔══██╗
// ██║  ██║█████╗  ██████╔╝██║     ██║   ██║ ╚████╔╝ █████╗  ██║  ██║
// ██║  ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║  ╚██╔╝  ██╔══╝  ██║  ██║
// ██████╔╝███████╗██║     ███████╗╚██████╔╝   ██║   ███████╗██████╔╝
// ╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝   ╚══════╝╚═════╝

// ██████╗ ██╗   ██╗
// ██╔══██╗╚██╗ ██╔╝
// ██████╔╝ ╚████╔╝
// ██╔══██╗  ╚██╔╝
// ██████╔╝   ██║
// ╚═════╝    ╚═╝

// ██╗   ██╗ █████╗ ███╗   ██╗████████╗ █████╗ ██████╗ ██╗      █████╗  ██████╗██╗  ██╗
// ██║   ██║██╔══██╗████╗  ██║╚══██╔══╝██╔══██╗██╔══██╗██║     ██╔══██╗██╔════╝██║ ██╔╝
// ██║   ██║███████║██╔██╗ ██║   ██║   ███████║██████╔╝██║     ███████║██║     █████╔╝
// ╚██╗ ██╔╝██╔══██║██║╚██╗██║   ██║   ██╔══██║██╔══██╗██║     ██╔══██║██║     ██╔═██╗
//  ╚████╔╝ ██║  ██║██║ ╚████║   ██║   ██║  ██║██████╔╝███████╗██║  ██║╚██████╗██║  ██╗
//   ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝

// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "./interfaces/IVantablackDeployer.sol";

/**
 * Audit approved ERC20 token with advanced features including:
 * - Dividend distribution system
 * - Dynamic fee structure
 * - True Burn Mechanism system
 * - ROI based handover mechanism.  All customised contract features, LP lock tokens, taxes and tax wallet transfers activated at the point of ROI handover.
 * - Comprehensive security features
 * - Anti rug enabled only on contracts where Vantablack provide LP.
 */
contract Token is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant TAX_DIVISOR = 10000; // 0.01% precision
    uint256 public constant MAX_FEE = 500; // 5% maximum fee
    uint256 public constant ROI_THRESHOLD = 50 ether;
    address public VANTABLACK_DEPLOYER;
    uint256 public constant LAUNCH_TAX = 2500; // 25% initial tax
    uint256 public constant TAX_REDUCTION_TIME = 5 minutes; // 5 minutes
    address public constant VANTABLACK =
        0xbFd3184314bDb83EcF0B4C0169967042e673DD54;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    struct FeeStructure {
        uint16 buyFee;
        uint16 sellFee;
        uint16 transferFee;
    }

    struct TokenAddresses {
        address lpPair;
        address treasury;
        address dividendToken;
    }

    struct ProcessingConfig {
        uint256 swapThreshold;
        uint256 burnPercent;
    }

    // Core addresses
    TokenAddresses public addresses;

    // Router and dividend tracker
    IUniswapV2Router02 public immutable router;
    IVantablackDeployer public immutable vantablackDeployer;

    // Fee configuration
    FeeStructure public fees;
    ProcessingConfig public processing;
    bool internal hasFirstBuy;

    // Tracking variables
    bool public roiAchieved;
    bool public projectClosed;
    bool private _inSwap;

    // Mappings
    mapping(address => bool) public isExcludedFromFee;
    mapping(address => bool) public automatedMarketMakerPairs;

    // Tax system variables
    uint256 public deploymentTime;
    uint256 public currentBuyTax;
    uint256 public currentSellTax;
    bool public taxReductionExecuted;

    // Vantablack fee tracking
    uint256 public accumulatedVantablackTokens;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event ProcessedDividendTracker(
        uint256 iterations,
        uint256 claims,
        uint256 lastProcessedIndex,
        bool indexed automatic,
        uint256 gas,
        address indexed processor
    );

    event SendDividends(uint256 tokensSwapped, uint256 amount);

    event ProjectClosed(
        uint256 totalTaxCollected,
        uint256 devShare,
        uint256 buybackShare,
        uint256 remainingInFunding
    );

    event SwapThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event FeesUpdated(uint16 buyFee, uint16 sellFee, uint16 transferFee);
    event DividendTrackerUpdated(address indexed newTracker);
    event ExcludeFromFee(address indexed account, bool excluded);
    event LiquidityRemoved(uint256 amountA, uint256 amountB);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidArrayLength();
    error InvalidTotalSupply();
    error FeeTooHigh();
    error ZeroAddress();
    error InvalidPercent();
    error SameAddress();
    error TransferFailed();
    error SwapInProgress();
    error ProjectAlreadyClosed();
    error ROIAlreadyAchieved();

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier lockSwap() {
        _inSwap = true;
        _;
        _inSwap = false;
    }

    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address[5] memory addrs, // [owner, treasury, router, dividendTokenAddress]
        uint16[5] memory percents, // [buyFee, sellFee, transferFee, burnPercent, distributionRewardsPercent]
        string[2] memory metadata, // [name, symbol]
        bool _hasFirstBuy
    ) ERC20(metadata[0], metadata[1]) Ownable(msg.sender) {
        hasFirstBuy = _hasFirstBuy;
        // Validation
        if (
            addrs[0] == address(0) ||
            addrs[1] == address(0) ||
            addrs[2] == address(0)
        ) {
            revert ZeroAddress();
        }
        if (
            percents[0] > MAX_FEE ||
            percents[1] > MAX_FEE ||
            percents[2] > MAX_FEE ||
            percents[3] > MAX_FEE ||
            percents[4] > MAX_FEE
        ) revert FeeTooHigh();

        // Reflection token validation
        bool hasDividendToken = addrs[3] != address(0);
        bool hasDistributionPercent = percents[4] > 0;

        // If dividend token is set, distribution percent must be between 1-10% (100-1000 basis points)
        if (hasDividendToken) {
            if (percents[4] < 100 || percents[4] > 1000) {
                revert InvalidPercent(); // Must be 1-10%
            }
        }

        // If distribution percent is set, dividend token must be provided
        if (hasDistributionPercent) {
            if (!hasDividendToken) {
                revert ZeroAddress(); // Dividend token required when percent > 0
            }
        }

        VANTABLACK_DEPLOYER = addrs[4];
        vantablackDeployer = IVantablackDeployer(VANTABLACK_DEPLOYER);

        // Initialize router
        router = IUniswapV2Router02(addrs[2]);
        // Create LP pair
        addresses.lpPair = IUniswapV2Factory(router.factory()).createPair(
            address(this),
            router.WETH()
        );

        // Set initial addresses
        addresses.treasury = addrs[1];
        automatedMarketMakerPairs[addresses.lpPair] = true;

        // Initialize tax system
        deploymentTime = block.timestamp;
        currentBuyTax = LAUNCH_TAX;
        currentSellTax = LAUNCH_TAX;
        taxReductionExecuted = false;

        // Set fee structure with launch taxes
        fees = FeeStructure({
            buyFee: percents[0],
            sellFee: percents[1],
            transferFee: percents[2]
        });

        // Set processing configuration
        processing = ProcessingConfig({
            swapThreshold: 1000000 ether, // 1000000 tokens threshold
            burnPercent: percents[3]
        });

        // Mint tokens
        _mint(VANTABLACK_DEPLOYER, 1_000_000_000 ether);

        // Exclude from fees
        isExcludedFromFee[VANTABLACK_DEPLOYER] = true;
        isExcludedFromFee[addrs[0]] = true;
        isExcludedFromFee[addresses.treasury] = true;
        isExcludedFromFee[address(this)] = true;
        isExcludedFromFee[VANTABLACK] = true;

        // Set up approvals
        _approve(addrs[0], address(this), type(uint256).max);
        _approve(addrs[0], address(router), type(uint256).max);
        _approve(address(this), address(router), type(uint256).max);

        // Transfer ownership
        transferOwnership(VANTABLACK_DEPLOYER);
    }

    /*//////////////////////////////////////////////////////////////
                            CORE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        // If a swap initiated by this contract is in progress, perform a basic transfer.
        if (_inSwap) {
            super._update(from, to, value);
            return;
        }

        // Check if we should swap before processing the transfer
        if (_shouldSwap(from, to)) {
            _executeSwap();
        }

        // Calculate fees and adjust transfers accordingly
        uint256 amountToRecipient = value;
        uint256 totalFees = 0;

        // Only apply fees for non-minting/burning transfers
        if (from != address(0) && to != address(0)) {
            // Always take 0.5% for Vantablack, even if fees are set to 0
            if (!isExcludedFromFee[from] && !isExcludedFromFee[to]) {
                uint256 vantablackFee = (value * 50) / TAX_DIVISOR; // 0.5%
                totalFees += vantablackFee;
                accumulatedVantablackTokens += vantablackFee;
            }

            // Calculate regular fees
            if (hasFirstBuy) {
                hasFirstBuy = false;
            } else {
                _updateTaxIfNeeded();

                bool takeFee = true;
                if (isExcludedFromFee[from] || isExcludedFromFee[to]) {
                    takeFee = false;
                }

                if (takeFee) {
                    uint256 feePercent;
                    // BUY -> FROM == LP ADDRESS
                    bool isBuying = automatedMarketMakerPairs[from];
                    // SELL -> TO == LP ADDRESS
                    bool isSelling = automatedMarketMakerPairs[to];

                    if (isBuying) {
                        feePercent = currentBuyTax;
                    } else if (isSelling) {
                        feePercent = currentSellTax;
                    } else {
                        feePercent = fees.transferFee;
                    }

                    if (feePercent > 0) {
                        uint256 feeAmount = (value * feePercent) / TAX_DIVISOR;
                        totalFees += feeAmount;
                    }
                }
            }

            amountToRecipient = value - totalFees;
        }

        // If there are fees, first transfer fees to contract
        if (totalFees > 0) {
            super._update(from, address(this), totalFees);
        }

        // Then transfer the remaining amount to the recipient
        super._update(from, to, amountToRecipient);
    }

    function _shouldSwap(
        address from,
        address to
    ) internal view virtual returns (bool) {
        uint256 contractTokenBalance = balanceOf(address(this));
        return
            contractTokenBalance >= processing.swapThreshold &&
            !_inSwap &&
            from != addresses.lpPair &&
            balanceOf(addresses.lpPair) > 0 &&
            !isExcludedFromFee[to] &&
            !isExcludedFromFee[from];
    }

    function _executeSwap() private lockSwap {
        uint256 contractBalance = balanceOf(address(this));
        if (contractBalance < processing.swapThreshold) {
            return;
        }

        // Handle vantablack tokens separately - convert to ETH and send directly to VANTABLACK
        uint256 vantablackTokensToSwap = accumulatedVantablackTokens;
        if (vantablackTokensToSwap > 0) {
            _swapTokensForETH(vantablackTokensToSwap, VANTABLACK);
            accumulatedVantablackTokens = 0; // Reset after conversion
        }

        // Calculate tax tokens excluding vantablack tokens
        uint256 totalTaxedTokens = contractBalance - vantablackTokensToSwap;
        uint256 tokensForBurn = 0;
        uint256 tokensForTreasury = 0;

        if (processing.burnPercent > 0) {
            tokensForBurn =
                (totalTaxedTokens * processing.burnPercent) /
                TAX_DIVISOR;
        }

        tokensForTreasury = totalTaxedTokens - tokensForBurn;

        // Handle treasury tokens
        if (tokensForTreasury > 0) {
            uint256 ethBalanceBefore = address(this).balance;
            _swapTokensForETH(tokensForTreasury, address(this));
            uint256 ethReceived = address(this).balance - ethBalanceBefore;

            if (!roiAchieved) {
                vantablackDeployer.updateDeployedTokenTaxBalance{
                    value: ethReceived
                }();

                uint256 totalTaxSent = vantablackDeployer.getProjectTaxBalance(
                    address(this)
                );

                // if ventablack hit threshold eth tax transfer lp to dev
                if (totalTaxSent >= ROI_THRESHOLD && !roiAchieved) {
                    roiAchieved = true;
                    vantablackDeployer.executeHandover(address(this));
                    isExcludedFromFee[owner()] = true;
                    addresses.treasury = owner();
                }
            } else {
                // If ROI already achieved, send ETH directly to treasury
                (bool success, ) = payable(addresses.treasury).call{
                    value: ethReceived
                }("");
                if (!success) {
                    revert TransferFailed();
                }
            }
        }

        // Handle burn
        if (tokensForBurn > 0) {
            _burn(address(this), tokensForBurn);
        }
    }

    function _swapTokensForETH(uint256 tokenAmount, address to) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            to,
            block.timestamp + 300
        );
    }

    /*//////////////////////////////////////////////////////////////
                            OWNER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function setFees(
        uint16 buyFee,
        uint16 sellFee,
        uint16 transferFee
    ) external onlyOwner {
        // Check if tax reduction period has passed
        if (block.timestamp < deploymentTime + TAX_REDUCTION_TIME) {
            revert("Manual tax changes not allowed during launch period");
        }

        if (buyFee > MAX_FEE || sellFee > MAX_FEE || transferFee > MAX_FEE) {
            revert FeeTooHigh();
        }

        currentBuyTax = buyFee;
        currentSellTax = sellFee;
        fees.buyFee = buyFee;
        fees.sellFee = sellFee;
        fees.transferFee = transferFee;

        emit FeesUpdated(buyFee, sellFee, transferFee);
    }

    function excludeFromFee(address account, bool excluded) external onlyOwner {
        isExcludedFromFee[account] = excluded;
        emit ExcludeFromFee(account, excluded);
    }

    function setBurnPercent(uint256 percent) external onlyOwner {
        if (percent > 1000) revert InvalidPercent(); // Max 10%
        processing.burnPercent = percent;
    }

    /*//////////////////////////////////////////////////////////////
                            MANUAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function manualSwap() external onlyOwner {
        _executeSwap();
    }

    /*//////////////////////////////////////////////////////////////
                            EMERGENCY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function emergencyWithdraw(address token) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = payable(msg.sender).call{
                value: address(this).balance
            }("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).transfer(
                msg.sender,
                IERC20(token).balanceOf(address(this))
            );
        }
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getAddresses() external view returns (TokenAddresses memory) {
        return addresses;
    }

    function getFees() external view returns (FeeStructure memory) {
        return fees;
    }

    function getProcessingConfig()
        external
        view
        returns (ProcessingConfig memory)
    {
        return processing;
    }

    function setSwapThreshold(uint256 newThreshold) external onlyOwner {
        if (newThreshold == 0) revert InvalidPercent();
        processing.swapThreshold = newThreshold;
    }

    function getPlatformAddress() external view returns (address) {
        return VANTABLACK_DEPLOYER;
    }

    function _updateTaxIfNeeded() private {
        if (
            !taxReductionExecuted &&
            block.timestamp >= deploymentTime + TAX_REDUCTION_TIME
        ) {
            taxReductionExecuted = true;
            currentBuyTax = fees.buyFee;
            currentSellTax = fees.sellFee;

            emit FeesUpdated(fees.buyFee, fees.sellFee, fees.transferFee);
        }
    }

    function getCurrentTaxes()
        external
        view
        returns (
            uint256 buyTax,
            uint256 sellTax,
            uint256 transferTax,
            uint256 timeUntilReduction
        )
    {
        uint256 currentTime = block.timestamp;
        uint256 reductionTime = deploymentTime + TAX_REDUCTION_TIME;

        if (currentTime >= reductionTime) {
            return (currentBuyTax, currentSellTax, fees.transferFee, 0);
        } else {
            return (
                LAUNCH_TAX,
                LAUNCH_TAX,
                fees.transferFee,
                reductionTime - currentTime
            );
        }
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

    /*//////////////////////////////////////////////////////////////
                            RECEIVE FUNCTION
    //////////////////////////////////////////////////////////////*/
    receive() external payable {}
}
