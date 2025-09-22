# Ethers v6 Migration Guide for VantablackDeployer Telegram Bot

## Overview

The telegram bot has been updated to use Ethers v6, which includes significant API changes from v5. This document outlines the changes made and any remaining tasks.

## Changes Made

### 1. Import Changes
```javascript
// Old (v5)
const ethers = require("ethers")

// New (v6) 
const { ethers } = require("ethers")
```

### 2. Provider Changes
```javascript
// Old (v5)
new ethers.providers.JsonRpcProvider(rpc)

// New (v6)
new ethers.JsonRpcProvider(rpc)
```

### 3. Utility Function Changes
```javascript
// Old (v5)
ethers.utils.formatEther(amount)
ethers.utils.parseEther(amount)

// New (v6)
ethers.formatEther(amount)
ethers.parseEther(amount)
```

### 4. BigNumber Operations
```javascript
// Old (v5) - Chained methods
balance.lt(amount)
balance.eq(0)
balance.add(amount)
balance.mul(15).div(10)

// New (v6) - Direct operators
balance < amount
balance == 0n
balance + amount
balance * 15n / 10n
```

### 5. Contract Address Access
```javascript
// Old (v5)
contract.address

// New (v6)
await contract.getAddress()
```

### 6. Code Cleanup
- Removed unused imports (`exec`, `LiquidityManagerAbi`)
- Removed unused functions (`sleep`, `isValidUrl`)
- Removed unused variables (`poolAllocation`, `deployArgs`, etc.)
- Cleaned up redundant code sections

## Dependencies Update Required

Update your package.json to use Ethers v6:

```json
{
  "dependencies": {
    "ethers": "^6.0.0"
  }
}
```

Then run:
```bash
npm install
```

## Testing Checklist

After migration, test the following bot functions:

### Core Functions
- [ ] Bot startup and initialization
- [ ] Wallet connection (import/generate)
- [ ] Network switching
- [ ] Balance checking

### Token Deployment
- [ ] Token parameter input and validation
- [ ] VantablackDeployer integration
- [ ] Whitelist checking for Vantablack funding
- [ ] Transaction execution and confirmation
- [ ] Success message display

### LP Management
- [ ] LP lock status checking
- [ ] LP unlock functionality
- [ ] Lock duration and expiry display
- [ ] Unicrypt V2 integration

### Project Management
- [ ] Tax balance checking
- [ ] Project closure and fund distribution
- [ ] Handover execution
- [ ] Ownership transfer

### Error Handling
- [ ] Invalid input handling
- [ ] Network error handling
- [ ] Contract interaction errors
- [ ] Gas estimation failures

## Breaking Changes to Watch For

1. **BigNumber Arithmetic**: All BigNumber operations now use native JavaScript operators
2. **Contract Addresses**: Must use `getAddress()` method instead of `.address` property
3. **Provider Initialization**: Different constructor pattern
4. **Gas Price**: May need adjustment for v6 patterns

## Troubleshooting

### Common Issues

1. **"Cannot read property 'lt' of undefined"**
   - Solution: Replace BigNumber methods with native operators

2. **"Provider.getNetwork() is not a function"**
   - Solution: Update provider initialization pattern

3. **"Contract.address is undefined"** 
   - Solution: Use `await contract.getAddress()` instead

4. **Gas estimation errors**
   - Solution: Review gas price calculation for v6 compatibility

## Performance Notes

Ethers v6 offers:
- Better tree-shaking and smaller bundle sizes
- Improved TypeScript support
- Better error messages
- More consistent API design
- Enhanced performance for contract interactions

## Deployment Notes

When deploying the updated bot:

1. Update all environment variables
2. Verify contract addresses are correct
3. Test on testnet first
4. Monitor for any runtime errors
5. Check gas usage patterns

## Support

If you encounter issues during migration:
1. Check the official Ethers v6 migration guide
2. Test individual functions in isolation
3. Verify contract ABI compatibility
4. Check network configuration

The bot is now ready for Ethers v6 with enhanced performance and better error handling.