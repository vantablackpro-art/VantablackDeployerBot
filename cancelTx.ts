// cancelPendingTxs.ts
import { ethers } from "hardhat";

async function main() {
    const provider = ethers.provider;
    const wallet = new ethers.Wallet("bb03a1ee43c90fe5a07e37141148f695a1f358751f27585d5f0fabe17c2b874f", provider);

    const address = await wallet.getAddress();

    const pendingNonce = await provider.getTransactionCount(address, "pending");
    const confirmedNonce = await provider.getTransactionCount(address, "latest");

    console.log("Confirmed nonce:", confirmedNonce);
    console.log("Pending nonce:", pendingNonce);

    for (let n = confirmedNonce; n < pendingNonce; n++) {
        console.log(`Speeding up tx with nonce ${n}...`);

        // Find pending tx in mempool
        const block = await provider.send("eth_getBlockByNumber", ["pending", true]);
        const stuckTx = block.transactions.find(
            (t: any) =>
                t.from.toLowerCase() === address.toLowerCase() &&
                parseInt(t.nonce, 16) === n
        );

        if (!stuckTx) {
            console.log(`❌ Could not find tx for nonce ${n}, skipping.`);
            continue;
        }

        const oldMaxFee = BigInt(stuckTx.maxFeePerGas || stuckTx.gasPrice);
        const oldMaxPriority = BigInt(
            stuckTx.maxPriorityFeePerGas || ethers.parseUnits("2", "gwei")
        );

        // bump gas aggressively (+50%)
        const maxFeePerGas = (oldMaxFee * 150n) / 100n;
        const maxPriorityFeePerGas = (oldMaxPriority * 150n) / 100n;

        // 🚀 speed-up transaction: send 0 ETH to self
        const tx = await wallet.sendTransaction({
            to: address,
            value: 0,
            nonce: n,
            gasLimit: 21000n,
            maxFeePerGas,
            maxPriorityFeePerGas,
        });

        console.log(`📤 Sent speed-up tx: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Tx with nonce ${n} confirmed.`);
    }
}

main().catch(console.error);