import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import '@typechain/hardhat'
import '@openzeppelin/hardhat-upgrades'
import * as dotenv from 'dotenv'
import '@typechain/hardhat'
dotenv.config()
// const mnemonic = "5d0541a40c9d67b1306aee94d9933fd5ed0512fa4cd9500c180c6a4a5972787f";
// const mnemonic = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // hardhat
// const mnemonic = "bb03a1ee43c90fe5a07e37141148f695a1f358751f27585d5f0fabe17c2b874f";
// const mnemonic = "daab383408619d6010c9b028d6823225df56a0acc3313f82688663dce1a0ad74"; // plasma
const mnemonic = "0xc44c7860a4e4c2fce7990c6e759bf92dc2ec8fd92bb4a9dfcf428505d4bdad37";
// const mnemonic = "bb03a1ee43c90fe5a07e37141148f695a1f358751f27585d5f0fabe17c2b874f";
// const mnemonic = process.env.DEPLOYER_PKY_KEY;
console.log("Using mnemonic:", mnemonic);
// const chain = chains[process.env.CHAIN ?? 'ethereum_goerli']
// 0x9F88D408E5045109028581775a3e6f891Ac44566
const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      allowUnlimitedContractSize: true,
      forking: {
        url: `https://rpc.plasma.to`,
      },
      chainId: 31337,
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      forking: {
        url: `https://polygon-mainnet.chainnodes.org/47c52780-44af-4d6f-a270-cb650fffdea6`,
      },
      accounts: {
        accountsBalance: '1000000000000000000000000000000000000000'
      },
      chainId: 137,
    },
    mainnet: {
      //url: `https://rpc.flashbots.net`,
      url: `https://eth.llamarpc.com`,
      accounts: [`${mnemonic}`],
      chainId: 1
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [`${mnemonic}`],
      chainId: 3,
      gasPrice: 5000000000,
      gasMultiplier: 2
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [`${mnemonic}`],
      chainId: 4,
      gasPrice: 5000000000,
      gasMultiplier: 2
    },
    goerli: {
      url: `https://goerli.infura.io/v3/d8200853cc4c4001956d0c1a2d0de540`,
      accounts: [`${mnemonic}`],
      chainId: 5,
      gasMultiplier: 500
    },
    sepolia: {
      url: `https://ethereum-sepolia-rpc.publicnode.com`,
      accounts: [`${mnemonic}`],
      chainId: 11155111,
      gasMultiplier: 2
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [`${mnemonic}`],
      chainId: 42,
      gasPrice: 20000000000,
      gasMultiplier: 2
    },
    moonbase: {
      url: 'https://rpc.testnet.moonbeam.network',
      accounts: [`${mnemonic}`],
      chainId: 1287,
      gas: 5198000,
      gasMultiplier: 2
    },
    arbitrum: {
      url: 'https://kovan3.arbitrum.io/rpc',
      accounts: [`${mnemonic}`],
      chainId: 79377087078960,
      gasMultiplier: 2
    },
    opera: {
      url: 'https://rpcapi.fantom.network',
      accounts: [`${mnemonic}`],
      chainId: 250
    },
    ftmTestnet: {
      url: 'https://rpc.testnet.fantom.network',
      accounts: [`${mnemonic}`],
      chainId: 4002,
      gasMultiplier: 2
    },
    polygon: {
      // url: 'https://polygon-mainnet.chainnodes.org/47c52780-44af-4d6f-a270-cb650fffdea6',
      url: 'https://attentive-billowing-silence.matic.quiknode.pro/ea762c38e57a3270105a9de19cec8c5ddbe5f369',
      accounts: [`${mnemonic}`],
      chainId: 137,
      gasMultiplier: 10
    },
    mumbai: {
      url: 'https://rpc.ankr.com/polygon_mumbai',
      accounts: [`${mnemonic}`],
      chainId: 80001,
      // gasPrice: 5000000000,
      // gasMultiplier: 2
    },
    xdai: {
      url: 'https://rpc.xdaichain.com',
      accounts: [`${mnemonic}`],
      chainId: 100,
    },
    bsc: {
      url: 'https://bsc-dataseed.binance.org',
      accounts: [`${mnemonic}`],
      chainId: 56,
    },
    bscTestnet: {
      url: 'https://rpc.ankr.com/bsc_testnet_chapel',
      accounts: [
        `${mnemonic}`,
      ],
      chainId: 97,
      gasMultiplier: 2
    },
    heco: {
      url: 'https://http-mainnet.hecochain.com',
      accounts: [`${mnemonic}`],
      chainId: 128,
    },
    'heco-testnet': {
      url: 'https://http-testnet.hecochain.com',
      accounts: [`${mnemonic}`],
      chainId: 256,
      gasMultiplier: 2
    },
    avalanche: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      accounts: [`${mnemonic}`],
      chainId: 43114
    },
    avaxfuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      accounts: [`${mnemonic}`],
      chainId: 43113,
      gasMultiplier: 2
    },
    harmony: {
      url: 'https://api.s0.t.hmny.io',
      accounts: [`${mnemonic}`],
      chainId: 1666600000,
    },
    'harmony-testnet': {
      url: 'https://api.s0.b.hmny.io',
      accounts: [`${mnemonic}`],
      chainId: 1666700000,
      gasMultiplier: 2
    },
    pulsechainmainnet: {
      url: "https://rpc-pulsechain.g4mm4.io",
      accounts: [`${mnemonic}`],
      chainId: 0x171,
    },
    pulsechaintestnet: {
      url: "https://rpc.v4.testnet.pulsechain.com",
      accounts: [`${mnemonic}`],
      chainId: 0x3AF
    },
    plasma: {
      url: "https://rpc.plasma.to",
      accounts: [`${mnemonic}`],
      chainId: 9745,
    }
  },
  etherscan: {

    apiKey: {
      avalancheFujiTestnet: 'ZGR21YGDGQSIVXI5B2NR5K73MFCDI4QPH8', // avax
      avalanche: 'ZGR21YGDGQSIVXI5B2NR5K73MFCDI4QPH8', // avax

      bsc: "V28HJCGUP2XCHSV5IXXG6IK9W14HHXKDCY", // bsc
      bscTestnet: "V28HJCGUP2XCHSV5IXXG6IK9W14HHXKDCY", // bsc

      opera: "IJ7P45C1D6CWVVQZ3FAYMFMR433IYEJ3EW", // ftm
      ftmTestnet: "IJ7P45C1D6CWVVQZ3FAYMFMR433IYEJ3EW", // ftm


      polygon: "YEIG77M4C7ICS4TMDQAJPWJGJWF5CFY4Y3", // ftm
      polygonMumbai: "YEIG77M4C7ICS4TMDQAJPWJGJWF5CFY4Y3", // polygon

      goerli: "C7MSIMK1FXRGYMB39IHUURH68KIEVDPUH2", // eth
      mainnet: "C7MSIMK1FXRGYMB39IHUURH68KIEVDPUH2", // eth
      sepolia: "C7MSIMK1FXRGYMB39IHUURH68KIEVDPUH2", // eth

      //optimism: "R5W7SC6B9MY4999NQYX9S4SU9DE86F15KB", // optimism
      //optimismTestnet: "R5W7SC6B9MY4999NQYX9S4SU9DE86F15KB", // optimism

      pulsechainmainnet: 'pulsechainmainnet',
      pulsechaintestnet: 'pulsechaintestnet',
    },
    customChains: [
      {
        network: "pulsechaintestnet",
        chainId: 943,
        urls: {
          apiURL: "https://api.scan.v4.testnet.pulsechain.com/api/v1",
          browserURL: "https://scan.v4.testnet.pulsechain.com"
        }
      },
      {
        network: "pulsechainmainnet",
        chainId: 369,
        urls: {
          apiURL: "https://api.scan.pulsechain.com/api/v1",
          browserURL: "https://scan.pulsechain.com"
        }
      }
    ]
  },
  solidity: {
    compilers: [
      {
        version: '0.8.30',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1
          },
        }
      },
      {
        version: '0.6.12', // Pan9inch Router
        settings: {
          optimizer: {
            enabled: true
          }
        }
      },
      {
        version: '0.6.6', // Pangolin Router
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
      {
        version: '0.8.2' // Pan9inch Pair
      },
      {
        version: '0.5.17' // WAVAX
      },
      {
        version: '0.5.16' // Pan9inch / Pangolin -> Pair / Factory
      },
      {
        version: '0.5.0' // Pan9inch Pair
      },
      {
        version: '0.4.24' // WBTC
      },
      {
        version: '0.4.18' // WBNB
      },
      {
        version: '0.8.0'
      },
      {
        version: '0.8.12'
      }
    ]
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  mocha: {
    timeout: 6000000
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v6'
  },
  gasReporter: {
    token: "ETH",
    currency: 'USD',
    gasPrice: 1,
    enabled: true,
    coinmarketcap: '0caa3779-3cb2-4665-a7d3-652823b53908'
  }
};

export default config;
