const fs = require('fs');
const { ethers } = require('ethers');
require('dotenv').config();

const addresses = require('./adr.json');
const progressFile = './progress.json';

const provider = new ethers.JsonRpcProvider(process.env.UBUSUNA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const tokenAddress = '0x33501fd446c770bcc19b76f0d04231469fc90e32';
const abi = ["function transfer(address to, uint256 amount) returns (bool)"];
const contract = new ethers.Contract(tokenAddress, abi, wallet);

const BNB_AMOUNT = 5;
const amountToSend = ethers.parseUnits(BNB_AMOUNT.toString(), 18);

let state = {
    totalWallets: addresses.length, sentWallets: 0, remainingWallets: addresses.length,
    totalBnbToSend: addresses.length * BNB_AMOUNT, totalBnbSent: 0, remainingBnbToSend: addresses.length * BNB_AMOUNT,
    failedTx: 0, latestTxHash: "Initializing..."
};

function saveState() { fs.writeFileSync(progressFile, JSON.stringify(state, null, 2)); }
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    saveState();
    console.log("🚀 Starting STABLE Batch Transfer...");
    let currentNonce = await wallet.getNonce();
    let feeData = await provider.getFeeData();
    const updateGas = async () => { feeData = await provider.getFeeData(); };

    let sessionCount = 0;

    for (let i = 0; i < addresses.length; i++) {
        const toAddress = addresses[i];
        if (i % 20 === 0) await updateGas();

        contract.transfer(toAddress, amountToSend, {
            nonce: currentNonce,
            gasPrice: feeData.gasPrice
        }).then((tx) => {
            console.log([SENT #${i + 1}] ${toAddress} | Hash: ${tx.hash});
            state.sentWallets++;
            state.remainingWallets--;
            state.totalBnbSent += BNB_AMOUNT;
            state.remainingBnbToSend -= BNB_AMOUNT;
            state.latestTxHash = "Sent: " + tx.hash;
            saveState();
        }).catch((err) => {
            console.error([ERROR #${i + 1}] ${toAddress}:, err.reason || err.code);
            state.failedTx++;
            saveState();
        });

        currentNonce++;
        sessionCount++;
        await sleep(150); 
        
        if (sessionCount >= 150) {
            console.log("\n⏸️ 150 TX LIMIT. HOLDING 1 MINUTE...");
            await sleep(60000); 
            sessionCount = 0;
            currentNonce = await wallet.getNonce(); 
            console.log("▶️ RESUMING...\n");
        }
    }
    console.log("🏁 BROADCAST COMPLETE");
    state.latestTxHash = "🏁 BROADCAST COMPLETE";
    saveState();
}
main().catch(console.error);
