# VantablackDeployer Telegram Bot - Setup Guide

This guide covers setting up and running the updated Telegram bot that integrates with the VantablackDeployer contract system.

## Features

The updated bot now supports:

### Core Features
- ✅ Token deployment through VantablackDeployer contract
- ✅ Vantablack funding integration for whitelisted developers  
- ✅ LP token management (burn/lock options)
- ✅ Tax balance withdrawal and distribution
- ✅ Project handover execution
- ✅ LP lock status checking
- ✅ Unicrypt V2 integration for professional LP locking

### Security Features
- ✅ Rate limiting protection
- ✅ Input validation and sanitization
- ✅ Private key security measures
- ✅ Anti-rug protection mechanisms

## Prerequisites

1. **Deployed Contracts**: Ensure VantablackDeployer and LiquidityManager contracts are deployed
2. **Node.js**: Version 16 or higher
3. **Telegram Bot Token**: Create a bot via @BotFather
4. **Network Access**: RPC endpoints for target blockchains

## Environment Setup

Create a `.env` file with the following variables:

```env
# Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here
BOT_PROXY=host:port (optional, for proxy usage)

# Contract Addresses (CRITICAL - Update these with actual deployed addresses)
VANTABLACK_DEPLOYER_ADDRESS=0x1234...  # VantablackDeployer contract address
LIQUIDITY_MANAGER_ADDRESS=0x5678...    # LiquidityManager contract address

# Development/Debug Settings
DEBUG_PVKEY=your_debug_private_key     # Optional: for testing
TESTNET_SHOW=1                         # Show testnets in bot (1 = yes, 0 = no)

# Optional Features
ANNOUNCEMENT_CHANNEL_ID=-1001945826954 # Channel ID for deployment announcements
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Compile contracts and generate ABIs:
```bash
npx hardhat compile
```

3. Copy contract ABIs to resources:
```bash
mkdir -p resources
cp ./artifacts/contracts/VantablackDeployer.sol/VantablackDeployer.json ./resources/VantablackDeployerArtifact.json
cp ./artifacts/contracts/LiquidityManager.sol/LiquidityManager.json ./resources/LiquidityManagerArtifact.json
```

## Deployment Process

### 1. Deploy Infrastructure Contracts

First, deploy the core contracts:

```bash
# Deploy VantablackDeployer (upgradeable proxy)
npx hardhat run scripts/deployVantablack.ts --network sepolia

# Deploy LiquidityManager  
npx hardhat run scripts/deployLiquidityManager.ts --network sepolia

# Deploy UniswapV2Locker
npx hardhat run scripts/UniswapV2Locker.ts --network sepolia
```

### 2. Configure Contract Relationships

After deployment, configure the relationships:

```bash
# Set LiquidityManager in VantablackDeployer
# Set UniswapV2Locker in VantablackDeployer
# Transfer LiquidityManager ownership to VantablackDeployer
```

### 3. Update Environment Variables

Update `.env` with the actual deployed contract addresses.

## Running the Bot

Start the bot:

```bash
node index.js
```

## Bot Usage

### For Regular Users

1. **Start**: `/start` - Welcome screen and basic setup
2. **Deploy**: `/deploy` - Launch token deployment wizard  
3. **Settings**: `/settings` - Wallet and network configuration

### Available Actions

#### Wallet Management
- Import existing private key
- Generate new wallet
- View wallet balance and status
- Switch between networks

#### Token Deployment
- Set token name and symbol
- Configure tokenomics (taxes, burn percentage)
- Choose LP management options (burn/lock)  
- Set Vantablack funding preference
- Configure first buy settings
- Add social media links

#### Post-Deployment Management
- View LP lock status and details
- Execute handover (transfer ownership + LP management)
- Withdraw accumulated tax balances
- Update tax rates (owner only)
- Unlock LP tokens (when eligible)

## LP Management Options

### Option 0: Burn LP Tokens 🔥
- **Security**: Maximum (prevents any rugpull)
- **Process**: LP tokens permanently sent to dead address
- **Reversibility**: None (permanent)
- **Best for**: Long-term projects wanting maximum trust

### Option 1: Lock 1 Month (Unicrypt) 🔒
- **Security**: High (industry standard)
- **Process**: LP tokens locked with Unicrypt V2
- **Duration**: 30 days from handover
- **Best for**: Short-term projects with proven track record

### Option 2: Lock 6 Months (Unicrypt) 🔐  
- **Security**: High (industry standard)
- **Process**: LP tokens locked with Unicrypt V2
- **Duration**: 180 days from handover
- **Best for**: Serious projects building for long-term

### Option 3: No Lock ⚠️
- **Security**: Low (not recommended)
- **Process**: LP tokens remain with project
- **Reversibility**: Full control retained
- **Best for**: Advanced users with custom LP strategies

## Vantablack Funding System

### For Whitelisted Developers
- Automatic 1 ETH liquidity funding
- Professional LP management
- Priority support and features
- Access to advanced anti-rug tools

### Whitelist Process
Contact @VantablackSupport with:
- Project details and roadmap
- Previous development experience  
- Community size and engagement
- Long-term commitment demonstration

## Tax Distribution System

When project closes (via withdrawTax):
- **25%** → Developer wallet
- **25%** → Vantablack buyback program  
- **50%** → Vantablack funding wallet (for future projects)

## Security Best Practices

### For Users
- Never share private keys
- Verify contract addresses before deployment
- Start with testnets for learning
- Use dedicated deployment wallets
- Keep small balances in bot wallets

### For Administrators  
- Regular contract upgrades and maintenance
- Monitor for unusual deployment patterns
- Maintain whitelist quality standards
- Backup critical configuration data
- Monitor LP lock contract health

## Troubleshooting

### Common Issues

1. **"VantablackDeployer address not configured"**
   - Update VANTABLACK_DEPLOYER_ADDRESS in .env
   - Ensure contract is deployed on selected network

2. **"Not whitelisted for Vantablack funding"**
   - Contact @VantablackSupport for whitelist access
   - Or use self-funded deployment option

3. **"Insufficient balance"**
   - Add ETH to deployment wallet
   - Check network gas requirements
   - Verify LP funding amounts

4. **LP lock operations failing**
   - Ensure contract ownership is properly configured
   - Check Unicrypt V2 contract health
   - Verify LP tokens exist and are owned by system

### Support Channels
- Technical Issues: Create issue on GitHub
- Whitelist Requests: @VantablackSupport  
- General Questions: Community Telegram

## Development

### Testing
```bash
npm test
```

### Adding New Features
1. Update contract interfaces if needed
2. Add new button handlers to index.js
3. Implement corresponding action handlers  
4. Test thoroughly on testnet
5. Update documentation

### Network Configuration
Add new networks to SUPPORTED_CHAINS array with:
- Chain ID and name
- RPC endpoint
- Router address (for LP operations)
- Explorer URLs
- Gas limits and pricing

## License

MIT License - See LICENSE file for details.