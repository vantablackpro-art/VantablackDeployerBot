# Remove Liquidity Scripts

This directory contains three scripts for removing liquidity from Uniswap V2 / QuickSwap pairs:

## Scripts Overview

### 1. RemoveLiquidityETH.ts
Removes liquidity from ETH/Token pairs using the Uniswap V2 router directly.

**Use case**: When you own LP tokens and want to remove liquidity from an ETH/Token pair.

**Configuration**:
```typescript
const TOKEN_ADDRESS = "0x..." // Your token address
const LIQUIDITY_AMOUNT = parseEther("0") // Amount of LP tokens to remove (0 = all)
const MIN_TOKEN_AMOUNT = 0 // Minimum token amount to receive
const MIN_ETH_AMOUNT = 0 // Minimum ETH amount to receive
```

**Usage**:
```bash
npx hardhat run scripts/RemoveLiquidityETH.ts --network polygon
```

### 2. RemoveLiquidityTokens.ts
Removes liquidity from Token/Token pairs using the Uniswap V2 router directly.

**Use case**: When you own LP tokens and want to remove liquidity from a Token/Token pair.

**Configuration**:
```typescript
const TOKEN_A_ADDRESS = "0x..." // First token address
const TOKEN_B_ADDRESS = "0x..." // Second token address
const LIQUIDITY_AMOUNT = parseEther("0") // Amount of LP tokens to remove (0 = all)
const MIN_TOKEN_A_AMOUNT = 0 // Minimum tokenA amount to receive
const MIN_TOKEN_B_AMOUNT = 0 // Minimum tokenB amount to receive
```

**Usage**:
```bash
npx hardhat run scripts/RemoveLiquidityTokens.ts --network polygon
```

### 3. RemoveLiquidityViaManager.ts
Removes liquidity using the LiquidityManager contract.

**Use case**: When LP tokens are held by the LiquidityManager contract and you need to remove them as admin/owner.

**Configuration**:
```typescript
const TOKEN_A_ADDRESS = "0x..." // First token address
const TOKEN_B_ADDRESS = "0x..." // Second token address (use WETH for ETH pairs)
```

**Requirements**: You must be the owner or admin of the LiquidityManager contract.

**Usage**:
```bash
npx hardhat run scripts/RemoveLiquidityViaManager.ts --network polygon
```

## Important Notes

### Router and Factory Addresses
The scripts are configured for QuickSwap (Polygon):
- Router: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff`
- Factory: `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32`

For other networks, update these addresses accordingly.

### WETH Address
For ETH pairs on Polygon, WETH address is: `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`

### Safety Features
- All scripts check your LP token balance before attempting removal
- Scripts estimate the amounts you'll receive before executing
- Minimum amount parameters can be set to prevent unfavorable trades
- All transactions have a 10-minute deadline

### Gas Considerations
- Approve transactions may require separate gas fees
- Remove liquidity transactions typically cost 200k-400k gas
- Always ensure you have sufficient ETH for gas fees

## Example Usage

### Remove all ETH/USDC liquidity
1. Edit `RemoveLiquidityETH.ts`:
   ```typescript
   const TOKEN_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" // USDC
   const LIQUIDITY_AMOUNT = parseEther("0") // Remove all
   ```

2. Run:
   ```bash
   npx hardhat run scripts/RemoveLiquidityETH.ts --network polygon
   ```

### Remove specific amount of Token A/Token B liquidity
1. Edit `RemoveLiquidityTokens.ts`:
   ```typescript
   const TOKEN_A_ADDRESS = "0x..." // Token A
   const TOKEN_B_ADDRESS = "0x..." // Token B
   const LIQUIDITY_AMOUNT = parseEther("10") // Remove 10 LP tokens
   ```

2. Run:
   ```bash
   npx hardhat run scripts/RemoveLiquidityTokens.ts --network polygon
   ```

## Troubleshooting

### "No liquidity pair found"
- Verify the token addresses are correct
- Ensure the pair exists on the DEX
- Check that you're using the correct router/factory addresses

### "No LP tokens to remove"
- Verify you own LP tokens for the pair
- Check the correct wallet is connected
- For ViaManager script, ensure LP tokens are in the LiquidityManager contract

### "Insufficient allowance"
- The script will automatically approve the router if needed
- Ensure you have enough ETH for the approval transaction

### "Not owner or admin" (ViaManager script only)
- Only the contract owner or admin can use the LiquidityManager
- Check the contract's owner() and admin() functions
- Use a different script if you're not the admin

## Security Notes

- Always double-check token addresses before running
- Use minimum amount parameters in production
- Test with small amounts first
- Keep private keys secure and never commit them to version control