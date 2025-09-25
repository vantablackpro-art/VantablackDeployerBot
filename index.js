/* eslint-disable no-undef */
const { Telegraf } = require("telegraf")
const { message } = require("telegraf/filters")
const { ethers } = require("ethers")
const fs = require("fs")
const path = require("path")
const https = require("https")
// Removed unused exec import

const dotenv = require("dotenv")
dotenv.config()

const BOT_NAME = 'Ventablack Deployer Bot'
const TokenBin = JSON.parse(fs.readFileSync("./artifacts/contracts/Token.sol/Token.json", "utf8"));
const TokenAbi = TokenBin.abi;
const RouterAbi = require("./resources/UniswapV2Router.json")
const VantablackDeployerBin = JSON.parse(fs.readFileSync("./artifacts/contracts/VantablackDeployer.sol/VantablackDeployer.json", "utf8"));
const VantablackDeployerAbi = VantablackDeployerBin.abi;
const TESTNET_SHOW = process.env.TESTNET_SHOW == 1 ? true : false

// Removed unused sleep function

// Contract addresses from deployed contracts
const VANTABLACK_DEPLOYER_ADDRESS = process.env.VENTABLACK_DEPLOYER
const LIQUIDITY_MANAGER_ADDRESS = process.env.LIQUIDITY_MANAGER
const UNISWAP_V2_LOCKER_ADDRESS = process.env.UNISWAP_V2_LOCKER

const SUPPORTED_CHAINS = [
    // {
    //     id: 943,
    //     name: 'Pulsechain Testnet',
    //     hardhatName: 'pulsechaintestnet',
    //     rpc: 'https://rpc-testnet-pulsechain.g4mm4.io',
    //     symbol: 'PLS',
    //     router: '0x99c2d4937756Cf66D04f7db362B87604f4303969',
    //     limit: 1000,
    //     apiKey: process.env.ETH_APIKEY,
    //     verifyApiUrl: "https://api.scan.v4.testnet.pulsechain.com/api/v1",
    //     scanUrl: "https://scan.v4.testnet.pulsechain.com/#/",
    //     testnet: true,
    //     waitTime: 30,
    //     dextoolUrl: "https://www.dextools.io/app/en/pulsechain/pair-explorer/",
    //     dexUrl: "https://app.9inch.io/?chain=pulsechain"
    // },
    // {
    //     id: 11155111,
    //     name: 'Ethereum Sepolia',
    //     hardhatName: 'sepolia',
    //     rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    //     symbol: 'ETH',
    //     router: '0xedf6066a2b290C185783862C7F4776A2C8077AD1', // UniswapV2 router
    //     limit: 0.01,
    //     apiKey: process.env.ETH_APIKEY,
    //     verifyApiUrl: "https://api-sepolia.etherscan.io/api",
    //     scanUrl: "https://sepolia.etherscan.io/",
    //     testnet: true,
    //     waitTime: 30,
    //     dextoolUrl: "https://www.dextools.io/app/en/ether/pair-explorer/",
    //     dexUrl: "https://app.uniswap.org/#/swap?chain=sepolia"
    // },
    // {
    //     id: 31337,
    //     name: 'Hardhat Local',
    //     hardhatName: 'hardhat',
    //     rpc: "http://127.0.0.1:8545",
    //     symbol: 'ETH',
    //     router: '0xedf6066a2b290C185783862C7F4776A2C8077AD1', // UniswapV2 router
    //     limit: 0.001,
    //     apiKey: process.env.ETH_APIKEY,
    //     verifyApiUrl: "https://api-sepolia.etherscan.io/api",
    //     scanUrl: "https://sepolia.etherscan.io/",
    //     testnet: true,
    //     waitTime: 30,
    //     dextoolUrl: "https://dexscreener.com/ethereum/",
    //     dexUrl: "https://app.uniswap.org/#/swap?chain=sepolia"
    // },
    // {
    //     id: 369,
    //     name: 'Pulsechain Mainnet',
    //     hardhatName: 'pulsechainmainnet',
    //     rpc: 'https://rpc-pulsechain.g4mm4.io',
    //     symbol: 'PLS',
    //     router: '0xeB45a3c4aedd0F47F345fB4c8A1802BB5740d725',
    //     limit: 1000,
    //     apiKey: process.env.ETH_APIKEY,
    //     verifyApiUrl: "https://api.scan.pulsechain.com/api/v1",
    //     scanUrl: "https://scan.9inch.io/#/",
    //     testnet: false,
    //     waitTime: 30,
    //     dextoolUrl: "https://www.dextools.io/app/en/pulsechain/pair-explorer/",
    //     dexUrl: "https://app.9inch.io/?chain=pulsechain"
    // }
    // {
    //     id: 137,
    //     name: 'Polygon',
    //     hardhatName: 'polygon',
    //     rpc: 'https://polygon-bor-rpc.publicnode.com',
    //     symbol: 'POL',
    //     router: '0xedf6066a2b290C185783862C7F4776A2C8077AD1',
    //     limit: 1,
    //     apiKey: process.env.ETH_APIKEY,
    //     verifyApiUrl: "https://api.scan.pulsechain.com/api/v1",
    //     scanUrl: "https://polygonscan.com",
    //     testnet: false,
    //     waitTime: 30,
    //     dextoolUrl: "https://dexscreener.com/polygon/",
    //     dexUrl: "https://app.uniswap.org/swap?chain=polygon&inputCurrency=NATIVE&outputCurrency="
    // }
    {
        id: 1,
        name: 'Ethereum',
        hardhatName: 'mainnet',
        rpc: 'https://rpc-ethereum.g4mm4.io',
        symbol: 'ETH',
        router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
        limit: 1,
        apiKey: process.env.ETH_APIKEY,
        verifyApiUrl: "https://api.etherscan.io/api",
        scanUrl: "https://etherscan.io",
        testnet: false,
        waitTime: 30,
        dextoolUrl: "https://dexscreener.com/ethereum/",
        dexUrl: "https://app.uniswap.org/swap?chain=mainnet&inputCurrency=NATIVE&outputCurrency="
    }
]

const getInputCaptions = (chainSymbol = 'ETH') => ({
    pvkey: `🔐 **Enter Your Private Key**

⚠️ **Keep your private key secure!**
• Only enter your private key in this secure channel
• Never share it with anyone
• Format: 64 character hex string (with or without 0x prefix)

Example: 0x1234...abcd`,

    symbol: `💲 **Enter Token Symbol**

• Short identifier for your token (1-10 characters)
• Usually 3-5 uppercase letters
• Must be unique and memorable

Examples: BTC, ETH, DOGE, SHIB`,

    name: `🔠 **Enter Token Name**

• Full name of your token (1-50 characters)
• Should be descriptive and professional
• Will appear in wallets and exchanges

Examples: Bitcoin, Ethereum, Dogecoin`,


    buyTax: `🟢 **Set Final Buy Tax (After Handover)**

• Tax applied after you execute project handover
• Range: 0-5% (cannot exceed 5%)
• Launch starts at 25% → auto-reduces to 5% → your custom tax
• Revenue goes to tax receiver wallet

Examples: 0 (no tax), 2, 5`,

    sellTax: `🔴 **Set Final Sell Tax (After Handover)**

• Tax applied after you execute project handover
• Range: 0-5% (cannot exceed 5%)
• Launch starts at 25% → auto-reduces to 5% → your custom tax
• Can only decrease taxes, never increase

Examples: 0 (no tax), 3, 5`,

    burnPerTx: `🔥 **Set Burn Percentage**

• Percentage of tokens burned on each transaction
• Range: 0-10% (recommended: 0-2%)
• Reduces total supply over time

Examples: 0 (no burn), 1, 2`,

    taxReceiver: `💼 **Tax Receiver Wallet Address**

• Wallet that receives all tax revenue from trades
• Must be a valid Ethereum address (42 characters)
• Leave blank to use deployer wallet as default
• This wallet also receives LP tokens after liquidity is added

**Important:** Make sure you control this wallet!

Format: 0x followed by 40 hex characters
Example: 0x1234567890abcdef1234567890abcdef12345678`,

    ethLP: `💧 **${chainSymbol} Liquidity Amount**

• ${chainSymbol} amount to add to liquidity pool
• More liquidity = less price volatility

Examples: 0.1, 1, 5`,


    reflectionTokenAddress: `🎁 **Reflection Token Address**

• Token used for holder rewards
• Must be a valid deployed token contract
• Popular choices: USDC, WETH, or native tokens

Examples: 0xA0b86a33E6... (USDC)`,

    reflectionPercentage: `💫 Reflection Reward Percentage

• Percentage of taxes used for holder rewards
• Range: 0-50% (recommended: 5-20%)
• Higher percentage = more rewards to holders

Examples: 5, 10, 15`,

    website: `🌐 **Website URL**

• Official website for your token
• Must be a valid URL starting with https://
• Helps establish legitimacy and trust

Examples: https://yourtoken.com`,

    telegram: `📱 **Telegram Group URL**

• Link to your community Telegram group
• Must be a valid Telegram URL
• Format: https://t.me/YourGroup

Examples: https://t.me/YourTokenGroup`,

    x: `**𝕏 (Twitter) URL**

• Link to your token's 𝕏 account
• Must be a valid 𝕏.com URL
• Important for marketing and updates

Examples: https://x.com/YourToken`,

    logo: `🖼️ **Upload Token Logo**

• Upload your token's logo image directly
• Supported formats: PNG, JPG/JPEG
• Recommended size: 512x512 pixels
• Will be displayed in channel announcements

Please upload your logo image file.`,

    relock: `🔄 **Relock Tokens**

• Extend the unlock date of an existing lock
• Requires paying liquidity fee again
• Format: lockIndex,lockID,newUnlockDate
• Example: 0,123,1735689600

**Parameters:**
• lockIndex: Position in your lock list (0, 1, 2...)
• lockID: Unique lock identifier
• newUnlockDate: Future timestamp (seconds)

Enter the parameters separated by commas:`,

    incrementLock: `➕ **Increase Lock Amount**

• Add more LP tokens to an existing lock
• Requires paying liquidity fee on added amount
• Format: lockIndex,lockID,amount
• Example: 0,123,1000000000000000000

**Parameters:**
• lockIndex: Position in your lock list (0, 1, 2...)
• lockID: Unique lock identifier
• amount: Amount of LP tokens to add (in wei)

Enter the parameters separated by commas:`,

    splitLock: `✂️ **Split Lock**

• Split a lock into two separate locks
• Requires small ETH fee
• Format: lockIndex,lockID,amount
• Example: 0,123,500000000000000000

**Parameters:**
• lockIndex: Position in your lock list (0, 1, 2...)
• lockID: Unique lock identifier
• amount: Amount to split into new lock (in wei)

Enter the parameters separated by commas:`,

    transferLock: `👤 **Transfer Lock Ownership**

• Transfer lock ownership to another address
• You lose control of the lock
• Format: lockIndex,lockID,newOwnerAddress
• Example: 0,123,0x742d35cc6A7AC36b100A1f87F3Cc67C4d5F9E1A2

**Parameters:**
• lockIndex: Position in your lock list (0, 1, 2...)
• lockID: Unique lock identifier
• newOwnerAddress: New owner's wallet address

Enter the parameters separated by commas:`,

    withdrawLock: `🔓 **Withdraw from Lock**

• Withdraw tokens from an unlocked lock
• Only works if unlock date has passed
• Format: lockIndex,lockID,amount
• Example: 0,123,1000000000000000000

**Parameters:**
• lockIndex: Position in your lock list (0, 1, 2...)
• lockID: Unique lock identifier
• amount: Amount to withdraw (in wei)

Enter the parameters separated by commas:`,

    migrateLock: `🚀 **Migrate to Uniswap V3**

• Migrate locked LP tokens to Uniswap V3
• Requires migrator contract to be set
• Format: lockIndex,lockID,amount
• Example: 0,123,1000000000000000000

**Parameters:**
• lockIndex: Position in your lock list (0, 1, 2...)
• lockID: Unique lock identifier
• amount: Amount to migrate (in wei)

Enter the parameters separated by commas:`,

    firstBuyAmount: `💰 **First Buy Amount (${chainSymbol})**

• Amount of ${chainSymbol} to buy tokens immediately after deployment
• Range: 0-10 ${chainSymbol} (0 = disabled)
• Creates initial trading volume

Examples: 0 (disabled), 0.1, 1`,

})

const sendTokenAnnouncementToChannel = async (ctx, tokenInfo, channelId) => {
    try {
        const { address, name, symbol, logo, website, telegram, x, txHash, chain } = tokenInfo

        // Build the announcement message
        let message = `🔺 **New Token**\n\n`
        message += `**Name:** ${name}\n`
        message += `**Symbol:** ${symbol}\n`
        message += `**Address:** \`${address}\`\n\n`

        // Add social links if available
        let socialLinks = []
        if (website) socialLinks.push(`[◼️ Website](${website})`)
        if (telegram) socialLinks.push(`[◼️ Telegram](${telegram})`)
        if (x) socialLinks.push(`[◼️ X](${x})`)

        if (socialLinks.length > 0) {
            message += `** ${socialLinks.join(' | ')}\n\n`
        }

        // Add transaction and chart links
        message += `[▪️ Transaction](${chain.scanUrl}/tx/${txHash}) [▪️ Chart](${chain.dextoolUrl}${address}) [▪️ Trade](${chain.dexUrl}${address})\n\n`
        message += `🛡 Deployed with Vantablack's anti-rug protection`

        // Send message with logo if available
        if (logo && fs.existsSync(logo)) {
            // Send with local image file
            await ctx.telegram.sendPhoto(channelId, { source: logo }, {
                caption: message,
                parse_mode: 'Markdown'
            })
        } else {
            await ctx.telegram.sendMessage(channelId, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            })
        }

        console.log(`✅ Token announcement sent to channel ${channelId}`)
    } catch (error) {
        console.error('❌ Failed to send token announcement to channel:', error.message)
    }
}

const downloadAndSaveImage = async (fileUrl, fileName) => {
    return new Promise((resolve, reject) => {
        const imagePath = path.join(__dirname, 'images', fileName)
        const file = fs.createWriteStream(imagePath)

        console.log('🔽 Downloading image from:', fileUrl)
        console.log('💾 Saving to:', imagePath)

        https.get(fileUrl, (response) => {
            console.log('📡 Response status:', response.statusCode, response.statusMessage)

            if (response.statusCode !== 200) {
                file.close()
                fs.unlink(imagePath, () => { }) // Delete the file on error
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}. URL: ${fileUrl}`))
                return
            }

            response.pipe(file)

            file.on('finish', () => {
                file.close()
                console.log('✅ Image downloaded successfully:', imagePath)
                resolve(imagePath)
            })

            file.on('error', (err) => {
                console.log('❌ File write error:', err)
                fs.unlink(imagePath, () => { }) // Delete the file on error
                reject(err)
            })
        }).on('error', (err) => {
            console.log('❌ HTTPS request error:', err)
            file.close()
            fs.unlink(imagePath, () => { }) // Delete the file on error
            reject(err)
        })
    })
}

const downloadImageAlternative = async (ctx, fileId, fileName) => {
    try {
        console.log('🔄 Trying alternative download method for file:', fileId)

        // Get file info and URL using Telegraf
        const fileInfo = await ctx.telegram.getFile(fileId)
        console.log('📄 File info:', fileInfo)

        // Use Telegraf's built-in download functionality if available
        if (ctx.telegram.getFileLink) {
            const fileUrl = await ctx.telegram.getFileLink(fileId)
            console.log('🔗 Alternative file URL:', fileUrl)
            return await downloadAndSaveImage(fileUrl.href || fileUrl, fileName)
        } else {
            // Fallback: try different URL format
            const alternativeUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${fileInfo.file_path}`
            console.log('🔗 Alternative URL format:', alternativeUrl)
            return await downloadAndSaveImage(alternativeUrl, fileName)
        }
    } catch (error) {
        console.log('❌ Alternative download method also failed:', error.message)
        throw new Error(`Failed to download image using both methods. Last error: ${error.message}`)
    }
}

const { escape_markdown } = require("./common/utils")

// Security validation functions
const validateAddress = (address) => {
    if (!address || typeof address !== 'string') return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

const validatePrivateKey = (key) => {
    if (!key || typeof key !== 'string') return false;
    return /^(0x)?[a-fA-F0-9]{64}$/.test(key);
}

const validateNumber = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const num = Number(value);
    return !isNaN(num) && num >= min && num <= max;
}

const validatePercentage = (value, maxPercent = 10) => {
    return validateNumber(value, 0, maxPercent);
}

const validateUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

const sanitizeString = (str) => {
    if (!str || typeof str !== 'string') return '';
    // Remove potentially dangerous characters
    return str.replace(/[<>'"&\\]/g, '').trim().substring(0, 100);
}

// Rate limiting protection
const rateLimiter = new Map();
const checkRateLimit = (userId, action = 'default', limit = 10, windowMs = 60000) => {
    const key = `${userId}_${action}`;
    const now = Date.now();

    if (!rateLimiter.has(key)) {
        rateLimiter.set(key, { count: 1, resetTime: now + windowMs });
        return true;
    }

    const userLimit = rateLimiter.get(key);
    if (now > userLimit.resetTime) {
        rateLimiter.set(key, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (userLimit.count >= limit) {
        return false;
    }

    userLimit.count++;
    return true;
}
const createBot = () => {
    const token = process.env.BOT_TOKEN
    if (process.env.BOT_PROXY) {
        const [host, port] = process.env.BOT_PROXY.split(':')
        const HttpsProxyAgent = require('https-proxy-agent')
        const agent = new HttpsProxyAgent({ host, port })
        return new Telegraf(token, {
            telegram: { agent },
            handlerTimeout: 9_000_000
        })
    }
    return new Telegraf(token, {
        handlerTimeout: 9_000_000
    })
}

const bot = createBot()

bot.use(async (ctx, next) => {
    const t = Date.now()
    const res = await next()
    console.log(ctx.match?.input, Date.now() - t)
    return res
})

const states = {}

const state = (ctx, values) => {
    if (!values) {
        const defaultChain = SUPPORTED_CHAINS.find(chain => TESTNET_SHOW ? true : !chain.testnet)
        return {
            chainId: defaultChain.id,
            token: {},
            ...(
                process.env.DEBUG_PVKEY ? {
                    pvkey: process.env.DEBUG_PVKEY,
                    account: new ethers.Wallet(process.env.DEBUG_PVKEY).address
                } : {}
            ),
            ...states[ctx.chat.id]
        }
    }
    states[ctx.chat.id] = {
        ...(states[ctx.chat.id] ?? {}), ...values
    }
}

const tokens = (ctx, token, update = false) => {
    const filepath = path.resolve(`./data/tokens-${ctx.chat.id}.json`)
    const data = fs.existsSync(filepath) ? JSON.parse(fs.readFileSync(filepath)) : []
    const { chainId, account } = state(ctx)
    if (!token)
        return data.filter(token => token.chain == chainId && token.deployer == account)
    if (update)
        fs.writeFileSync(filepath, JSON.stringify(data.map(t => t.chain == chainId && t.address == token.address ? { ...t, ...token } : t)))
    else
        fs.writeFileSync(filepath, JSON.stringify([...data, token]))
}

const create = (ctx, caption, buttons) => {
    if (!ctx)
        return
    return ctx.telegram.sendMessage(ctx.chat.id, escape_markdown(caption), {
        parse_mode: "MarkdownV2",
        reply_markup: {
            inline_keyboard: buttons
        }
    }).catch(ex => { console.log(ex) })
}

const update = async (ctx, caption, buttons, must = false) => {
    if (!ctx)
        return

    if (must == true) {
        return await ctx.telegram.sendMessage(ctx.chat.id, escape_markdown(caption), {
            parse_mode: "MarkdownV2",
            reply_markup: {
                inline_keyboard: buttons
            }
        }).catch(ex => { console.log(ex) })
    }
    else if (ctx.update?.callback_query) {
        const msg = ctx.update.callback_query.message
        // Check if message has media content (video, animation, photo, etc.)
        if (msg.video || msg.animation || msg.photo || msg.document) {
            // Send new message instead of editing media message
            return await ctx.telegram.sendMessage(ctx.chat.id, escape_markdown(caption), {
                parse_mode: "MarkdownV2",
                reply_markup: {
                    inline_keyboard: buttons
                }
            }).catch(ex => { console.log(ex) })
        } else {
            return await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, msg.message_id, escape_markdown(caption), {
                parse_mode: "MarkdownV2",
                reply_markup: {
                    inline_keyboard: buttons
                }
            }).catch(ex => { console.log(ex) })
        }
    } else if (ctx.message_id) {
        return await ctx.telegram.editMessageText(ctx.chat.id, ctx.message_id, ctx.message_id, escape_markdown(caption), {
            parse_mode: "MarkdownV2",
            reply_markup: {
                inline_keyboard: buttons
            }
        }).catch(ex => { console.log(ex) })
    } else {
        return await ctx.telegram.sendMessage(ctx.chat.id, escape_markdown(caption), {
            parse_mode: "MarkdownV2",
            reply_markup: {
                inline_keyboard: buttons
            }
        }).catch(ex => { console.log(ex) })
    }
}

const aggrAddress = (address) => `${address.substring(0, 10)}...${address.substring(38)}`

const showWelcome = async (ctx) => {
    state(ctx, { mixerStatus: false, mixerAmount: 0, mixerReceiverAddress: "" });

    const { chainId } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)

    const welcomeVideo = './resources/welcome.mp4';
    const welcomeGif = './resources/welcome.gif';
    const welcomeMessage = `🔻 Welcome to the Vantablack Deployer

🔐 Secure Token Deployment with **Anti-Rug Protection**

What you can do:
• Launch your ${chain.name} token
• Get 1 ${chain.symbol} liquidity, or use your own.
• Set buy and sell tax (5% Tax). Optional distribution:
    • Reflections
    • Burns
    • **Liquidity**
• Lock LP tokens automatically

Instructions and docs:
https://vantablack.gitbook.io/vantablack/

Ready to get started?`;
    // todo add links full information
    // make bold config tokens headers in token config section
    // Token information
    // tokenomics
    // tax system
    // anti rug system etc
    // remove lock emojis
    // add lock, relock, and all lock features
    // remove emojis from headings in menu
    // remove no funds and set self fund liquidity
    // move select lp to liquidity settings and liquidity management to liquidity settings too
    // remove ---- **Anti-Rug Protection** ---- lines
    const buttons = [
        [
            {
                text: `🔻 Start Deploying`,
                callback_data: `back@start`,
            }
        ],
        [
            {
                text: `📋 View My Tokens`,
                callback_data: `back@list`,
            }
        ],
        [
            {
                text: `🌐 List of launched tokens`,
                callback_data: `platform_tokens`,
            }
        ],
        [
            {
                text: `🎯 Snipe - coming soon`,
                callback_data: `snipe_coming_soon`,
            }
        ]
    ];

    // Try to send video with caption, then gif with caption, then text only
    if (fs.existsSync(welcomeVideo)) {
        // Send video with caption and buttons in same message
        return ctx.telegram.sendVideo(ctx.chat.id, { source: welcomeVideo }, {
            caption: escape_markdown(welcomeMessage),
            parse_mode: "MarkdownV2",
            reply_markup: {
                inline_keyboard: buttons
            }
        }).catch(ex => {
            console.log('Error sending video:', ex)
            // Fallback to text only
            return update(ctx, welcomeMessage, buttons)
        });
    } else if (fs.existsSync(welcomeGif)) {
        // Send gif with caption and buttons in same message
        return ctx.telegram.sendAnimation(ctx.chat.id, { source: welcomeGif }, {
            caption: escape_markdown(welcomeMessage),
            parse_mode: "MarkdownV2",
            reply_markup: {
                inline_keyboard: buttons
            }
        }).catch(ex => {
            console.log('Error sending gif:', ex)
            // Fallback to text only
            return update(ctx, welcomeMessage, buttons)
        });
    } else {
        // Send text only with buttons
        return update(ctx, welcomeMessage, buttons)
    }
}

const showPlatformTokens = async (ctx) => {
    const wait = await showWait(ctx, '🔍 Scanning all platform tokens...')

    try {
        // Get all tokens from all users
        const allTokens = await getAllPlatformTokens()

        if (allTokens.length === 0) {
            return update(ctx, `🌐 **Platform Tokens**

📊 **No tokens found on the platform yet.**

Deploy your first token to see it here!`, [
                [
                    {
                        text: `🚀 Deploy Token`,
                        callback_data: `back@start`,
                    }
                ],
                [
                    {
                        text: `← Back to Home`,
                        callback_data: `back@welcome`,
                    }
                ]
            ])
        }

        // Sort tokens by deployment date (newest first)
        allTokens.sort((a, b) => new Date(b.deployedAt) - new Date(a.deployedAt))

        // Create colorful display of all tokens
        let tokensList = `🌐 **Platform Tokens Overview**\n\n`
        tokensList += `📊 **Total Tokens Deployed:** ${allTokens.length}\n\n`

        const stats = {
            roiAchieved: 0,
            locked: 0,
            burned: 0,
            totalVolume: 0
        }

        allTokens.forEach((tokenData, index) => {
            const roiAchieved = tokenData.roiAchievedCalculated || tokenData.roiAchieved
            const statusEmoji = roiAchieved ? '🚀' : '⏳'
            const lpEmoji = tokenData.lpManagementOption === 0 ? '🔥' : '🔒'
            const roiProgress = Math.max(0, Math.min(100, tokenData.roiProgress || 0)) // Clamp between 0-100
            const filledBars = Math.max(0, Math.floor(roiProgress / 10))
            const emptyBars = Math.max(0, 10 - filledBars)
            const progressBar = '▓'.repeat(filledBars) + '░'.repeat(emptyBars)

            if (roiAchieved) stats.roiAchieved++
            if (tokenData.lpManagementOption === 0) stats.burned++
            else if (tokenData.lpManagementOption > 0) stats.locked++

            // Main token header with status
            tokensList += `${statusEmoji} **${tokenData.name}** (${tokenData.symbol})\n`
            tokensList += `🌍 ${tokenData.chainName || 'Unknown Chain'}\n`

            // Copyable full address in monospace
            tokensList += `📍 **Address:** "${tokenData.address}"\n`

            // ROI and Tax Information
            tokensList += `\n💸 **TAX & ROI STATUS:**\n`
            tokensList += `   💰 Tax Collected: ${(tokenData.taxCollected || 0).toFixed(4)} ${tokenData.chainSymbol || 'ETH'}\n`
            tokensList += `   🎯 ROI Progress: ${(tokenData.roiProgress || 0).toFixed(1)}% ${progressBar}\n`
            tokensList += `   ✅ ROI Achieved: ${roiAchieved ? '🚀 YES' : '❌ NO'}\n`

            // LP Management Information
            tokensList += `\n🔒 **LP MANAGEMENT:**\n`
            tokensList += `   ${lpEmoji} Strategy: ${tokenData.lpManagementText || getLPManagementText(tokenData.lpManagementOption)}\n`
            tokensList += `   📊 Status: ${tokenData.lockStatus || 'Unknown'}\n`

            // Creator and deployment info
            tokensList += `\n👤 **PROJECT INFO:**\n`
            tokensList += `   🏗️ Creator: "${tokenData.creator}"\n`
            tokensList += `   📅 Deployed: ${new Date(tokenData.deployedAt).toLocaleDateString()}\n`

            if (index < allTokens.length - 1) tokensList += `\n${'─'.repeat(30)}\n\n`
        })

        // Calculate additional stats
        const totalTaxCollected = allTokens.reduce((sum, token) => sum + (token.taxCollected || 0), 0)
        const avgROIProgress = allTokens.reduce((sum, token) => sum + (token.roiProgress || 0), 0) / allTokens.length
        const successRate = (stats.roiAchieved / allTokens.length * 100).toFixed(1)

        tokensList += `\n🎯 **PLATFORM STATISTICS:**\n`
        tokensList += `📊 Total Tokens: **${allTokens.length}**\n`
        tokensList += `🚀 ROI Achieved: **${stats.roiAchieved}**/${allTokens.length} (${successRate}%)\n`
        tokensList += `💰 Total Tax Collected: **${totalTaxCollected.toFixed(4)} POL**\n`
        tokensList += `📈 Average ROI Progress: **${avgROIProgress.toFixed(1)}%**\n`
        tokensList += `🔥 LP Burned: **${stats.burned}** tokens\n`
        tokensList += `🔒 LP Locked: **${stats.locked}** tokens\n`

        tokensList += `\n🛡️ _All tokens deployed with Vantablack's anti-rug protection_`

        // Create buttons for individual tokens (limit to first 8 to avoid message size limits)
        const tokenButtons = allTokens.slice(0, 8).map(token => ({
            text: `${token.roiAchievedCalculated || token.roiAchieved ? '🚀' : '⏳'} ${token.symbol}`,
            callback_data: `token@${token.address}`
        }))

        const buttons = [
            // Token buttons in rows of 2
            ...tokenButtons.reduce((rows, button, index) => {
                if (index % 2 === 0) {
                    rows.push([button])
                } else {
                    rows[rows.length - 1].push(button)
                }
                return rows
            }, []),
            // Control buttons
            [
                {
                    text: `🔄 Refresh`,
                    callback_data: `platform_tokens`,
                },
                {
                    text: `🚀 Deploy Token`,
                    callback_data: `back@start`,
                }
            ],
            [
                {
                    text: `← Back to Home`,
                    callback_data: `back@welcome`,
                }
            ]
        ]

        return update(ctx, tokensList, buttons)

    } catch (error) {
        console.error('Error fetching platform tokens:', error)
        return update(ctx, `❌ **Error Loading Platform Tokens**

Failed to load platform tokens. Please try again later.

Error: ${error.message}`, [
            [
                {
                    text: `🔄 Try Again`,
                    callback_data: `platform_tokens`,
                }
            ],
            [
                {
                    text: `← Back to Home`,
                    callback_data: `back@welcome`,
                }
            ]
        ])
    }
}


const showStart = async (ctx) => {
    const { chainId, pvkey } = state(ctx)
    if (pvkey)
        return showWallet(ctx)

    const selectedChain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    return update(ctx, `🔧 **Setup Required**

To deploy tokens, you need:
1️⃣ **Select a blockchain**
2️⃣ **Connect your wallet**

**Current Network:** ${selectedChain ? `${selectedChain.name} ${selectedChain.testnet ? '(Testnet)' : ''}` : 'None selected'}

**Choose your blockchain:**`, [
        TESTNET_SHOW ? SUPPORTED_CHAINS.filter(chain => chain.testnet).map(chain => ({
            text: `${chain.id == chainId ? '✅' : '🔗'} ${chain.name}`, callback_data: `chain@${chain.id}`
        })) : [],
        SUPPORTED_CHAINS.filter(chain => !chain.testnet).map(chain => ({
            text: `${chain.id == chainId ? '✅' : '🔗'} ${chain.name}`, callback_data: `chain@${chain.id}`
        })),
        [
            {
                text: `💳 Connect Wallet ${chainId ? '→' : '(Select chain first)'}`,
                callback_data: `back@account`,
            }
        ],
        [
            {
                text: `← Back to Home`,
                callback_data: `back@welcome`,
            }
        ]
    ])
}

const showAccount = (ctx) => {
    const { pvkey } = state(ctx)
    const { chainId } = state(ctx)
    const selectedChain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)

    update(ctx, `💳 **Wallet Connection**

**Network:** ${selectedChain ? selectedChain.name : 'Not selected'}
**Status:** ${pvkey ? '✅ Connected' : '❌ Not connected'}

${pvkey ? '**Options:**' : '**How do you want to connect?**'}`, [
        pvkey ? [
            {
                text: `🔌 Disconnect Wallet`,
                callback_data: `disconnect`,
            }
        ] : [
            {
                text: `📁 Import Private Key`,
                callback_data: `existing`,
            }
        ],
        !pvkey ? [
            {
                text: `🆕 Generate New Wallet`,
                callback_data: `generate`,
            }
        ] : [],
        [
            {
                text: `← Back to Network`,
                callback_data: `back@start`,
            }
        ]
    ])
}

const showWallet = async (ctx) => {
    const { chainId, pvkey } = state(ctx)
    if (!pvkey)
        return showStart(ctx)
    const wallet = new ethers.Wallet(pvkey)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const provider = new ethers.JsonRpcProvider(chain.rpc)
    const balance = await provider.getBalance(wallet.address)
    const balanceFormatted = Number(ethers.formatEther(balance)).toFixed(4)

    // Check if wallet is vantablack - hide amounts if it is
    const VANTABLACK_ADDRESS = "0xbFd3184314bDb83EcF0B4C0169967042e673DD54".toLowerCase()
    const isVantablack = wallet.address.toLowerCase() === VANTABLACK_ADDRESS
    const displayBalance = isVantablack ? "***" : `${balanceFormatted} ${chain.symbol}`

    return update(ctx, `💳 **Wallet Dashboard**

**Network:** ${chain.name} ${chain.testnet ? '(Testnet)' : ''}
**Address:** \`${wallet.address}\`
**Balance:** ${displayBalance}

${!isVantablack && balance < ethers.parseEther("0.01") ? `⚠️ **Low Balance** - You may need more ${chain.symbol} for gas fees` : '✅ **Ready to deploy**'}

**What would you like to do?**`, [
        [
            {
                text: `🚀 Create New Token`,
                callback_data: `back@deploy`,
            }
        ],
        [
            {
                text: `📋 My Tokens (${tokens(ctx).length})`,
                callback_data: `back@list`,
            }
        ],
        [
            {
                text: `🌐 Platform Tokens`,
                callback_data: `platform_tokens`,
            }
        ],
        [
            {
                text: `📖 Instructions`,
                callback_data: `back@instructions`,
            }
        ],
        [
            // {
            //     text: `🔄 Switch Network`,
            //     callback_data: `back@start`,
            // },
            {
                text: `⚙️ Settings`,
                callback_data: `back@account`,
            }
        ]
    ])
}

const showWait = async (ctx, caption) => {
    return update(ctx, `⌛ ${caption}`)
}

const showPage = (ctx, page) => {
    if (page == 'start')
        showStart(ctx)
    else if (page == 'account')
        showAccount(ctx)
    else if (page == 'key')
        showAccount(ctx)
    else if (page == 'wallet')
        showWallet(ctx)
    else if (page == 'deploy')
        showDeploy(ctx)
    else if (page == 'list')
        showList(ctx)
    else if (page == 'instructions')
        showInstructions(ctx)
    else if (page == 'bridges')
        showBridges(ctx)
    else if (page == 'missions')
        showMissions(ctx)
    else if (page == 'mixer')
        showMixer(ctx, true)
    else if (/^token@(?<address>0x[\da-f]{40})$/i.test(page)) {
        const match = /^token@(?<address>0x[\da-f]{40})$/i.exec(page)
        if (match && match.groups.address)
            showToken(ctx, match.groups.address)
    } else if (/^tokenconfig@(?<address>0x[\da-f]{40})$/i.test(page)) {
        const match = /^tokenconfig@(?<address>0x[\da-f]{40})$/i.exec(page)
        if (match && match.groups.address)
            showTokenConfiguration(ctx, match.groups.address)
    } else if (/^taxconfig@(?<address>0x[\da-f]{40})$/i.test(page)) {
        const match = /^taxconfig@(?<address>0x[\da-f]{40})$/i.exec(page)
        if (match && match.groups.address)
            showTaxConfiguration(ctx, match.groups.address)
    } else if (/^lpmanage@(?<address>0x[\da-f]{40})$/i.test(page)) {
        const match = /^lpmanage@(?<address>0x[\da-f]{40})$/i.exec(page)
        if (match && match.groups.address)
            showLPManagement(ctx, match.groups.address)
    } else if (/^dividendconfig@(?<address>0x[\da-f]{40})$/i.test(page)) {
        const match = /^dividendconfig@(?<address>0x[\da-f]{40})$/i.exec(page)
        if (match && match.groups.address)
            showDividendConfiguration(ctx, match.groups.address)
    } else if (/^processconfig@(?<address>0x[\da-f]{40})$/i.test(page)) {
        const match = /^processconfig@(?<address>0x[\da-f]{40})$/i.exec(page)
        if (match && match.groups.address)
            showProcessingConfiguration(ctx, match.groups.address)
    } else if (/^lockmanage@(?<address>0x[\da-f]{40})$/i.test(page)) {
        const match = /^lockmanage@(?<address>0x[\da-f]{40})$/i.exec(page)
        if (match && match.groups.address)
            showLockManagement(ctx, match.groups.address)
    } else if (/^bridge@(?<bridgeId>.+)$/.test(page)) {
        const match = /^bridge@(?<bridgeId>.+)$/i.exec(page)
        if (match && match.groups.bridgeId)
            showBridge(ctx, match.groups.bridgeId)
    } else
        showWelcome(ctx)
}

const showError = async (ctx, error, href, duration = 5000) => {
    // showPage(ctx, href)
    const err = await create(ctx, `⚠ ${error}`)
    if (duration)
        setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, err.message_id).catch(ex => { console.log(ex) }), duration)
}

const showSuccess = async (ctx, message, href, duration = 5000) => {
    if (duration) setTimeout(() => showPage(ctx, href), duration)
    return update(ctx, `${message}`, [
        [
            {
                text: '🔙 Back',
                callback_data: `back@${href}`
            }
        ]
    ])
}

const showInstructions = async (ctx) => {
    const { chainId } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)

    return update(ctx, `🔻 **Vantablack Deployer Instructions**

**Getting Started**
1. Connect your deployer wallet via private key
2. Select your blockchain network
3. Fill in your token details
4. Deploy with anti-rug protection

**🛡 Anti-Rug Features**
• Unicrypt V2 LP Locking - Industry standard LP protection
• LP Burning Option - Permanent rugpull prevention
• Decreasing Tax System (25% → 5% → Dev control)
• Request Vantablack funding 1 ${chain.symbol}

**💡 Pro Tips**
• Use realistic tokenomics (low taxes = better trading)
• Set reasonable LP amounts for price stability
• Enable first buy for initial momentum
• Consider reflection rewards for holder loyalty
• Send a %'age of Tax system to Auto LP to strengthen LP to encourage larger buys

**📞 Need Help?**
Contact @Vantablack_team for questions or whitelist access.

**🔗 Link**
More info: https://vantablack.gitbook.io/vantablack/
X: https://x.com/Vantablack_pro
TG: https://t.me/VantablackPro
Web: https://vantablack.pro`, [
        [
            {
                text: `← Back to Wallet`,
                callback_data: `back@wallet`,
            }
        ]
    ])
}

const showList = async (ctx) => {
    const { chainId, pvkey } = state(ctx)
    if (!pvkey)
        return showAccount(ctx)
    const wallet = new ethers.Wallet(pvkey)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const provider = new ethers.JsonRpcProvider(chain.rpc)
    const balance = await provider.getBalance(wallet.address)
    const deployed = tokens(ctx)

    // Check if wallet is vantablack - hide amounts if it is
    const VANTABLACK_ADDRESS = "0xbFd3184314bDb83EcF0B4C0169967042e673DD54".toLowerCase()
    const isVantablack = wallet.address.toLowerCase() === VANTABLACK_ADDRESS
    const displayBalance = isVantablack ? "***" : `"${Number(ethers.formatEther(balance)).toFixed(8)}" Ξ`

    // console.log(deployed)
    return update(ctx, [`🔑 Address: "${wallet.address}"`, `📈 ${chain.symbol} balance: ${displayBalance}`].join('\n'), [
        TESTNET_SHOW ? SUPPORTED_CHAINS.filter(chain => chain.testnet).map(chain => ({
            text: `${chain.id == chainId ? '🟢' : '⚪'} ${chain.name}`, callback_data: `chain@${chain.id}#list`
        })) : [],
        SUPPORTED_CHAINS.filter(chain => !chain.testnet).map(chain => ({
            text: `${chain.id == chainId ? '🟢' : '⚪'} ${chain.name}`, callback_data: `chain@${chain.id}#list`
        })),
        ...deployed.map(token =>
            [
                {
                    text: `${token.name} (${token.symbol}) at ${token.address}`,
                    callback_data: `token@${token.address}`
                }
            ]),
        [
            {
                text: `🌐 Platform Tokens`,
                callback_data: `platform_tokens`,
            }
        ],
        [
            {
                text: `🔙 Back`,
                callback_data: `back@wallet`,
            }
        ]
    ])
}

// Helper function to get completion status
const getCompletionStatus = (token) => {
    const required = ['symbol', 'name'];
    const requiredComplete = required.every(field => token[field]);
    const optional = ['buyTax', 'sellTax', 'burnPerTx'];
    const optionalComplete = optional.filter(field => token[field]).length;
    const totalFields = required.length + optional.length;
    const completedFields = (requiredComplete ? required.length : required.filter(f => token[f]).length) + optionalComplete;
    return { requiredComplete, completedFields, totalFields, percentage: Math.round((completedFields / totalFields) * 100) };
}

const showDeploy = async (ctx) => {
    const { chainId, pvkey, token } = state(ctx)
    if (!pvkey)
        return showStart(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const provider = new ethers.JsonRpcProvider(chain.rpc)
    const wallet = new ethers.Wallet(pvkey, provider)
    const balance = await provider.getBalance(wallet.address);

    // Set default LP management option to burn (0) if not set
    if (token.lpManagementOption === undefined) {
        token.lpManagementOption = 0;
        state(ctx, { token });
    }

    const status = getCompletionStatus(token);
    const progressBar = '▓'.repeat(Math.floor(status.percentage / 10)) + '░'.repeat(10 - Math.floor(status.percentage / 10));

    // Check if wallet is vantablack - hide amounts if it is
    const VANTABLACK_ADDRESS = "0xbFd3184314bDb83EcF0B4C0169967042e673DD54".toLowerCase()
    const isVantablack = wallet.address.toLowerCase() === VANTABLACK_ADDRESS
    const displayBalance = isVantablack ? "***" : `${Number(ethers.formatEther(balance)).toFixed(4)} ${chain.symbol}`

    // Check VantablackDeployer funding availability
    let vantablackFundingAvailable = false;
    let isUserWhitelisted = false;
    try {
        if (VANTABLACK_DEPLOYER_ADDRESS) {
            const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)

            // Check if contract has enough funding
            const lpFundingBalance = await VantablackDeployer.lpFundingBalance()
            const lpFundingAmount = await VantablackDeployer.lpFundingAmount()
            vantablackFundingAvailable = lpFundingBalance >= lpFundingAmount

            // Check if user is whitelisted
            isUserWhitelisted = await VantablackDeployer.isApproveded(wallet.address)
        }
    } catch (error) {
        console.log("Error checking Vantablack funding:", error.message)
    }

    // Auto-select Vantablack funding if available and user is whitelisted
    if (vantablackFundingAvailable && isUserWhitelisted && token.isVantablackFunded === undefined) {
        token.isVantablackFunded = true
        state(ctx, { token })
    }

    return update(ctx, `Launch Progress: ${progressBar} ${status.percentage}%
Network: ${chain.name}${chain.testnet ? ' (Testnet)' : ''}
Balance: ${displayBalance}

Firstly, use the buttons at the bottom to pick the Symbol (ticker) and name to continue.

**Token Information**
${token.symbol ? '✅' : '❌'} Symbol: ${token.symbol?.toUpperCase() ?? 'Not set'}
${token.name ? '✅' : '❌'} Name: ${token.name ?? 'Not set'}
✅ Supply: 1,000,000,000

**Tokenomics**
${token.buyTax !== undefined ? '✅' : '❔'} Final Buy Tax: ${token.buyTax !== undefined ? `${token.buyTax}%` : 'Not set (will be 0%)'}
${token.sellTax !== undefined ? '✅' : '❔'} Final Sell Tax: ${token.sellTax !== undefined ? `${token.sellTax}%` : 'Not set (will be 0%)'}
${token.burnPerTx ? '✅' : '❔'} Burn %: ${token.burnPerTx ? `${token.burnPerTx}%` : 'Default (0%)'}
${token.taxReceiver ? '✅' : '❔'} Tax Wallet: ${token.taxReceiver ? aggrAddress(token.taxReceiver) : 'Default (Deployer)'}

**Tax System (3 Phases)**
1️⃣ Launch: 25% for first 15 minutes (fixed), then
2️⃣ auto-reduce to 5% (fixed), then once ROI achieved
3️⃣ Your custom tax is applied.

**Anti-Rug Protection**
${token.lpManagementOption !== undefined ? '❔' : '❔'} LP Security: ${getLPManagementText(token.lpManagementOption) ?? '🔥 Burn LP'}${getLPLockStatusText(token)}

**Liquidity**
${token.isVantablackFunded ? `✅ Vantablack Funded: 1 ${chain.symbol} provided automatically` : `${token.ethLP ? '✅' : '❔'} ${chain.symbol} Amount: ${isVantablack ? "***" : (token.ethLP ?? 'Not set')}`}
✅ Total Supply: 1,000,000,000 tokens

**Quick Actions**
${token.hasFirstBuy ? '🟢' : '🔴'} First Buy: ${token.hasFirstBuy ? `Enabled` : 'Disabled'}${token.hasFirstBuy && token.firstBuyAmount && token.ethLP ? getFirstBuyEstimationText(token, isVantablack) : ''}`, [
        // Required Fields Section
        !token.symbol || !token.name ? [
            {
                text: `🚨 Complete Required Fields First`,
                callback_data: `required_section`,
            }
        ] : [],
        [
            {
                text: `${!token.symbol ? '❌' : '✅'} Symbol ${token.symbol ? '(' + token.symbol + ')' : ''}`,
                callback_data: `input@symbol`,
            },
            {
                text: `${!token.name ? '❌' : '✅'} Name`,
                callback_data: `input@name`,
            }
        ],


        // Tokenomics Section (only show if required fields complete)
        status.requiredComplete ? [
            {
                text: `────── Configure Tokenomics ──────`,
                callback_data: `tokenomics_section`,
            }
        ] : [],
        status.requiredComplete ? [
            {
                text: `${token.buyTax !== undefined ? '✅' : '⚪'} Final Buy Tax (${token.buyTax ?? 0}%)`,
                callback_data: `input@buyTax`,
            },
            {
                text: `${token.sellTax !== undefined ? '✅' : '⚪'} Final Sell Tax (${token.sellTax ?? 0}%)`,
                callback_data: `input@sellTax`,
            }
        ] : [],
        status.requiredComplete ? [
            {
                text: `${token.burnPerTx ? '✅' : '⚪'} Burn % (${token.burnPerTx || 0}%)`,
                callback_data: `input@burnPerTx`,
            }
        ] : [],
        status.requiredComplete ? [
            {
                text: `${token.taxReceiver ? '✅' : '⚪'} Tax Wallet ${token.taxReceiver ? '(' + aggrAddress(token.taxReceiver) + ')' : '(Default)'}`,
                callback_data: `input@taxReceiver`,
            }
        ] : [],


        // **Liquidity** Section
        status.requiredComplete ? [
            {
                text: `────── Liquidity Settings ──────`,
                callback_data: `liquidity_section`,
            }
        ] : [],
        status.requiredComplete ? [
            {
                text: `${token.isVantablackFunded ? '🟢 Vantablack Funded' : '🔴 Self-Funded'}${vantablackFundingAvailable && isUserWhitelisted ? ' (Available)' : !vantablackFundingAvailable ? ' (No funds)' : !isUserWhitelisted ? ' (Not whitelisted)' : ''}`,
                callback_data: `toggle@vantablackFunding`,
            }
        ] : [],
        status.requiredComplete ? [
            {
                text: `🔒 LP Management (${getLPManagementText(token.lpManagementOption) || 'Not set'})`,
                callback_data: `select@lpManagement`,
            }
        ] : [],
        status.requiredComplete && !token.isVantablackFunded ? [
            {
                text: `${token.ethLP ? '✅' : '⚪'} ${chain.symbol} Amount${token.ethLP && !isVantablack ? ` (${token.ethLP})` : ''}`,
                callback_data: `input@ethLP`,
            }
        ] : [],

        // Optional Features Section
        // status.requiredComplete ? [
        //     {
        //         text: `────── ⚡ Optional Features ──────`,
        //         callback_data: `features_section`,
        //     }
        // ] : [],
        status.requiredComplete ? [
            {
                text: `${token.hasFirstBuy ? '🟢' : '⚪'} First Buy`,
                callback_data: `toggle@firstBuy`,
            },
            ...(token.hasFirstBuy ? [{
                text: `💰 Amount (${token.firstBuyAmount || 0} ${chain.symbol})`,
                callback_data: `input@firstBuyAmount`,
            }] : [])
        ] : [],

        // Advanced Features Section
        // status.requiredComplete ? [
        //     {
        //         text: `────── 🔬 Advanced Features ──────`,
        //         callback_data: `advanced_section`,
        //     }
        // ] : [],
        // status.requiredComplete ? [
        //     {
        //         text: `${token.reflectionTokenAddress ? '✅' : '⚪'} Reflection Rewards`,
        //         callback_data: `input@reflectionTokenAddress`,
        //     }
        // ] : [],
        // token.reflectionTokenAddress ? [
        //     {
        //         text: `*️⃣ Reflection % (${token.reflectionPercentage || 0}%)`,
        //         callback_data: `input@reflectionPercentage`,
        //     }
        // ] : [],

        // Social Media Section
        // status.requiredComplete ? [
        //     {
        //         text: `────── 🌐 Social Media (Optional) ──────`,
        //         callback_data: `socials_section`,
        //     }
        // ] : [],
        status.requiredComplete ? [
            {
                text: `${token.website ? '✅' : '⚪'} Website`,
                callback_data: `input@website`,
            },
            {
                text: `${token.telegram ? '✅' : '⚪'} Telegram`,
                callback_data: `input@telegram`,
            },
            {
                text: `${token.x ? '✅' : '⚪'} 𝕏 (Twitter)`,
                callback_data: `input@x`,
            },
            {
                text: `${token.logo ? '✅' : '⚪'} 🖼️ Logo`,
                callback_data: `input@logo`,
            }
        ] : [],

        // Deploy Section
        status.requiredComplete ? [
            {
                text: `🚀 Deploy Token`,
                callback_data: `confirm@deploy`,
            }
        ] : [],

        // Navigation
        [
            {
                text: `← Back to Wallet`,
                callback_data: `back@wallet`,
            },
            ...(Object.keys(token).length ? [{
                text: `🔄 Reset All`,
                callback_data: `reset`,
            }] : [])
        ]
    ])
}

// Helper function to check if user owns a token after handover
const isTokenOwner = async (ctx, tokenAddress) => {
    const { chainId, pvkey } = state(ctx)
    if (!pvkey) return false

    try {
        const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)

        // Check if handover has been executed by checking token owner
        const Token = new ethers.Contract(tokenAddress, TokenAbi, provider)
        const tokenOwner = await Token.owner()

        return tokenOwner.toLowerCase() === wallet.address.toLowerCase()
    } catch (ex) {
        console.log("Error checking token ownership:", ex.message)
        return false
    }
}

// Helper function to check if handover has been executed
const isHandoverExecuted = async (ctx, tokenAddress) => {
    const { chainId } = state(ctx)
    if (!VANTABLACK_DEPLOYER_ADDRESS) return false

    try {
        const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)

        const tokenId = await VantablackDeployer.deployedTokensIds(tokenAddress)
        if (tokenId == 0) return false

        const tokenInfo = await VantablackDeployer.deployedTokens(tokenId)
        return tokenInfo.roiAchieved
    } catch (ex) {
        console.log("Error checking handover status:", ex.message)
        return false
    }
}

const showToken = async (ctx, address) => {
    const { chainId, pvkey, token: { buyTax, sellTax } } = state(ctx)
    if (!pvkey)
        return showWallet(ctx)
    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)

    const provider = new ethers.JsonRpcProvider(chain.rpc)
    const wallet = new ethers.Wallet(pvkey, provider)
    const balance = await provider.getBalance(wallet.address);

    // Check if handover has been executed and if user is token owner
    const handoverExecuted = await isHandoverExecuted(ctx, address)
    const userIsOwner = await isTokenOwner(ctx, address)

    // Check if wallet is vantablack - hide amounts if it is
    const VANTABLACK_ADDRESS = "0xbFd3184314bDb83EcF0B4C0169967042e673DD54".toLowerCase()
    const isVantablack = wallet.address.toLowerCase() === VANTABLACK_ADDRESS
    const displayBalance = isVantablack ? "***" : `"${Number(ethers.formatEther(balance)).toFixed(8)}"`

    // Get LP lock info from VantablackDeployer and check actual lock existence
    let lpLockInfo = null;
    let actualCanUnlockLP = false;
    try {
        if (VANTABLACK_DEPLOYER_ADDRESS) {
            const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)
            lpLockInfo = await VantablackDeployer.getLPLockInfo(address)

            // Check if locks actually exist in UniswapV2Locker
            const tokenId = await VantablackDeployer.deployedTokensIds(address)
            const deployedToken = await VantablackDeployer.deployedTokens(tokenId)

            const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
            const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, provider)

            const numUserLocks = await uniswapV2Locker.getUserNumLocksForToken(deployedToken.lpOwner, deployedToken.lpPair)

            if (numUserLocks > 0) {
                const lockInfo = await uniswapV2Locker.getUserLockForTokenAtIndex(deployedToken.lpOwner, deployedToken.lpPair, 0)
                const unlockTimestamp = Number(lockInfo[3]) // unlockDate is at index 3
                const now = Math.floor(Date.now() / 1000)
                actualCanUnlockLP = now >= unlockTimestamp
            }
        }
    } catch (ex) {
        console.log("Could not fetch LP lock info:", ex.message)
    }

    // const balance = await provider.getBalance(wallet.address)
    return update(ctx, [
        [`🔑 Address: "${wallet.address}"`, `📈 ${chain.symbol} balance: ${displayBalance}`].join('\n'),
        'Token Parameters',
        '',
        `✅ Address: "${token.address}"`,
        `${token.symbol ? '✅' : '❌'} Symbol: "${token.symbol?.toUpperCase() ?? 'Not set'}"`,
        `${token.name ? '✅' : '❌'} Name: "${token.name ?? 'Not set'}"`,
        `✅ Supply: "1,000,000,000"`,
        `${token.burnPerTx ? '✅' : '❔'} Burn percent: "${token.burnPerTx ? `${token.burnPerTx}%` : 'Not set'}"`,
        `${token.buyTax ? '✅' : '❔'} Initial Tax: "${token.buyTax ? `${token.buyTax}%` : 'Not set'}"`,
        `🔻 Current Tax: "Launch: 25% → Auto-reduce to 5% after 15 min → Dev control (decrease only)"`,
        `${token.sellTax ? '✅' : '❔'} Sell Tax: "${token.sellTax ? `${token.sellTax}%` : 'Not set'}"`,
        `✅ Tax Receiver: "${aggrAddress(token.taxReceiver ?? wallet.address)}"`,
        `✅ ${chain.symbol} LP: "${token.isVantablackFunded ? `Vantablack Funded (1 ${chain.symbol})` : (isVantablack ? '***' : (token.ethLP ?? 'Self-funded'))}"`,
        `✅ Total Supply: "1,000,000,000 tokens"`,
        `${token.reflectionTokenAddress ? '✅' : '❔'} Reflection Token Address: "${token.reflectionTokenAddress ? `${buildWalletAbreviation(token.reflectionTokenAddress)} (${token.reflectionTokenSymbol})` : 'Not set'}"`,
        `${token.reflectionPercentage ? '✅' : '❔'} Reflection Percentage: "${token.reflectionPercentage ? `${token.reflectionPercentage}%` : 'Not set'}"`,
        `${token.website ? '✅' : '❔'} Website: "${token.website ? `${token.website}` : 'Not set'}"`,
        `${token.telegram ? '✅' : '❔'} Telegram: "${token.telegram ? `${token.telegram}` : 'Not set'}"`,
        `${token.x ? '✅' : '❔'} X: "${token.x ? `${token.x}` : 'Not set'}"`,
    ].join('\n'), [
        TESTNET_SHOW ? SUPPORTED_CHAINS.filter(chain => chain.testnet).map(chain => ({
            text: `${chain.id == chainId ? '🟢' : '⚪'} ${chain.name}`, callback_data: `none`
        })) : [],
        SUPPORTED_CHAINS.filter(chain => !chain.testnet).map(chain => ({
            text: `${chain.id == chainId ? '🟢' : '⚪'} ${chain.name}`, callback_data: `none`
        })),
        // !token.ethLP ?
        //     [
        //         {
        //             text: `💱 Set **Liquidity**`,
        //             callback_data: `input@ethLP#${token.address}`,
        //         }
        //     ] :
        //     [
        //         {
        //             text: `💱 Add **Liquidity**`,
        //             callback_data: `confirm@addliquidity#${token.address}`,
        //         }

        //     ],
        // Management options only available after handover
        handoverExecuted && !token.renounced ? [
            {
                text: `📝 Renounce Ownership`,
                callback_data: `confirm@renounce#${token.address}`,
            }
        ] : [],
        handoverExecuted ? [
            {
                text: `📝 Update buy/sell tax`,
                callback_data: `confirm@update#${token.address}`,
            }
        ] : [],
        handoverExecuted ? [
            {
                text: `🟢 Buy Tax ${buyTax && token.buyTax != buyTax ? `(${buyTax}%)` : ''}`,
                callback_data: `input@buyTax#${token.address}`,
            },
            {
                text: `🔴 Sell Tax ${sellTax && token.sellTax != sellTax ? `(${sellTax}%)` : ''}`,
                callback_data: `input@sellTax#${token.address}`,
            }
        ] : [],
        // LP Management Section - Show status for all, lock actions only after handover
        lpLockInfo ? [
            {
                text: `📊 LP ${lpLockInfo.lpManagementOption === 0 ? 'Burn' : 'Lock'} Status`,
                callback_data: `lpstatus@${token.address}`,
            }
        ] : [],
        handoverExecuted && lpLockInfo && actualCanUnlockLP ? [
            {
                text: `🔓 Unlock LP Tokens`,
                callback_data: `confirm@unlock#${token.address}`,
            }
        ] : [],
        handoverExecuted && lpLockInfo && !lpLockInfo.isUnicryptLocked ? [
            {
                text: `🔒 Lock LP Tokens`,
                callback_data: `confirm@lock#${token.address}`,
            }
        ] : [],
        // Remove Execute Handover and Withdraw Tax Balance - these are automatic
        // Post-Handover Configuration (only for token owners after handover)
        handoverExecuted && userIsOwner ? [
            {
                text: `⚙️ Token Configuration`,
                callback_data: `tokenconfig@${token.address}`,
            }
        ] : [],
        // Lock Management (available for all users with locks after handover)
        handoverExecuted ? [
            {
                text: `🔐 Lock Management`,
                callback_data: `lockmanage@${token.address}`,
            }
        ] : [],
        // Navigation
        [
            {
                text: `🔙 Back`,
                callback_data: `back@list`,
            }
        ]
    ])
}

// Show token configuration menu for post-handover tokens
const showTokenConfiguration = async (ctx, address) => {
    const { chainId, pvkey } = state(ctx)
    if (!pvkey) return showWallet(ctx)

    const userIsOwner = await isTokenOwner(ctx, address)
    const handoverExecuted = await isHandoverExecuted(ctx, address)

    if (!handoverExecuted || !userIsOwner) {
        return update(ctx, `❌ **Access Denied**

You can only configure tokens after handover has been executed and you are the token owner.`, [
            [
                {
                    text: `🔙 Back to Token`,
                    callback_data: `token@${address}`,
                }
            ]
        ])
    }

    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)

    // Get current token settings
    let currentSettings = {
        buyTax: "Loading...",
        sellTax: "Loading...",
        transferTax: "Loading...",
        swapThreshold: "Loading...",
        gasForProcessing: "Loading...",
        hasDividendTracker: false
    }

    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const Token = new ethers.Contract(address, TokenAbi, provider)

        const [buyTax, sellTax, transferTax, timeUntilReduction] = await Token.getCurrentTaxes()
        const fees = await Token.getFees()
        const processingConfig = await Token.getProcessingConfig()
        const dividendTracker = await Token.dividendTracker()

        currentSettings = {
            buyTax: `${Number(buyTax) / 100}%`,
            sellTax: `${Number(sellTax) / 100}%`,
            transferTax: `${Number(fees.transferFee) / 100}%`,
            swapThreshold: `${ethers.formatEther(processingConfig.swapThreshold)} tokens`,
            gasForProcessing: Number(processingConfig.gasForProcessing).toLocaleString(),
            hasDividendTracker: dividendTracker !== "0x0000000000000000000000000000000000000000"
        }
    } catch (ex) {
        console.log("Error fetching token settings:", ex.message)
    }

    return update(ctx, `⚙️ **Token Configuration**
**${token?.name || "Token"}** (${token?.symbol || "???"})\n
**Current Settings:**
• Buy Tax: ${currentSettings.buyTax}
• Sell Tax: ${currentSettings.sellTax}
• Transfer Tax: ${currentSettings.transferTax}
• Swap Threshold: ${currentSettings.swapThreshold}
• Gas for Processing: ${currentSettings.gasForProcessing}
• Dividend Tracker: ${currentSettings.hasDividendTracker ? '✅ Enabled' : '❌ Disabled'}

**What would you like to configure?**`, [
        [
            {
                text: `📊 Adjust Tax Rates`,
                callback_data: `taxconfig@${address}`,
            }
        ],
        [
            {
                text: `💎 Dividend Configuration`,
                callback_data: `dividendconfig@${address}`,
            }
        ],
        [
            {
                text: `⚙️ Processing Settings`,
                callback_data: `processconfig@${address}`,
            }
        ],
        [
            {
                text: `🔓 LP Management`,
                callback_data: `lpmanage@${address}`,
            }
        ],
        [
            {
                text: `🔙 Back to Token`,
                callback_data: `token@${address}`,
            }
        ]
    ])
}

// Tax configuration for post-handover tokens
const showTaxConfiguration = async (ctx, address) => {
    const { chainId, pvkey } = state(ctx)
    if (!pvkey) return showWallet(ctx)

    const userIsOwner = await isTokenOwner(ctx, address)
    if (!userIsOwner) {
        return showError(ctx, "Access denied. You must be the token owner.", `tokenconfig@${address}`)
    }

    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)

    // Get current tax settings
    let currentTaxes = { buyTax: "Loading...", sellTax: "Loading...", transferTax: "Loading..." }

    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const Token = new ethers.Contract(address, TokenAbi, provider)
        const [buyTax, sellTax, transferTax] = await Token.getCurrentTaxes()

        currentTaxes = {
            buyTax: `${Number(buyTax) / 100}%`,
            sellTax: `${Number(sellTax) / 100}%`,
            transferTax: `${Number(transferTax) / 100}%`
        }
    } catch (ex) {
        console.log("Error fetching tax settings:", ex.message)
    }

    return update(ctx, `📊 **Tax Configuration**
**${token?.name || "Token"}** (${token?.symbol || "???"})

**Current Tax Rates:**
• Buy Tax: ${currentTaxes.buyTax}
• Sell Tax: ${currentTaxes.sellTax}
• Transfer Tax: ${currentTaxes.transferTax}

⚠️ **Important:** You can only decrease taxes, not increase them.
This ensures no rug pulls after handover.

**Select tax type to modify:**`, [
        [
            {
                text: `🟢 Modify Buy Tax`,
                callback_data: `settax@buy#${address}`,
            }
        ],
        [
            {
                text: `🔴 Modify Sell Tax`,
                callback_data: `settax@sell#${address}`,
            }
        ],
        [
            {
                text: `🔄 Modify Transfer Tax`,
                callback_data: `settax@transfer#${address}`,
            }
        ],
        [
            {
                text: `🔙 Back to Configuration`,
                callback_data: `tokenconfig@${address}`,
            }
        ]
    ])
}

// LP Management for post-handover tokens
// Handle tax updates for post-handover tokens
const handleTaxUpdate = async (ctx, address, taxType, newTaxValue) => {
    const { chainId, pvkey } = state(ctx)

    const userIsOwner = await isTokenOwner(ctx, address)
    if (!userIsOwner) {
        return showError(ctx, "Access denied. You must be the token owner.", `tokenconfig@${address}`)
    }

    // Validate tax value
    if (isNaN(newTaxValue) || newTaxValue < 0 || newTaxValue > 5) {
        throw Error('❌ **Invalid Tax Rate**\n\nTax must be between 0% and 5%.')
    }

    const wait = await showWait(ctx, `Updating ${taxType} tax to ${newTaxValue}%...`)
    try {
        const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)
        const Token = new ethers.Contract(address, TokenAbi, wallet)

        // Get current taxes to ensure we can only decrease
        const [currentBuyTax, currentSellTax] = await Token.getCurrentTaxes()
        const currentFees = await Token.getFees()

        let buyTax = Number(currentBuyTax)
        let sellTax = Number(currentSellTax)
        let transferTax = Number(currentFees.transferFee)

        // Update the specified tax type
        const newTaxBips = Math.floor(newTaxValue * 100) // Convert to basis points

        if (taxType === 'buy') {
            if (newTaxBips > buyTax) {
                throw Error('❌ **Cannot Increase Tax**\n\nYou can only decrease taxes after handover for security.')
            }
            buyTax = newTaxBips
        } else if (taxType === 'sell') {
            if (newTaxBips > sellTax) {
                throw Error('❌ **Cannot Increase Tax**\n\nYou can only decrease taxes after handover for security.')
            }
            sellTax = newTaxBips
        } else if (taxType === 'transfer') {
            if (newTaxBips > transferTax) {
                throw Error('❌ **Cannot Increase Tax**\n\nYou can only decrease taxes after handover for security.')
            }
            transferTax = newTaxBips
        }

        // Call setFees on the contract
        const tx = await Token.setFees(buyTax, sellTax, transferTax)
        await tx.wait()

        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })

        // Clear config state
        state(ctx, { configType: undefined, configAddress: undefined })

        showSuccess(ctx, `✅ ${taxType.charAt(0).toUpperCase() + taxType.slice(1)} tax updated to ${newTaxValue}%!`, `taxconfig@${address}`, 3000)
    } catch (ex) {
        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        // Clear config state on error too
        state(ctx, { configType: undefined, configAddress: undefined })
        showError(ctx, ex.message, `taxconfig@${address}`)
    }
}

// Dividend tracker configuration for post-handover tokens
const showDividendConfiguration = async (ctx, address) => {
    const { chainId, pvkey } = state(ctx)
    if (!pvkey) return showWallet(ctx)

    const userIsOwner = await isTokenOwner(ctx, address)
    if (!userIsOwner) {
        return showError(ctx, "Access denied. You must be the token owner.", `tokenconfig@${address}`)
    }

    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)

    // Get current dividend settings
    let dividendSettings = {
        hasDividendTracker: false,
        rewardsToken: "None",
        distributionPercent: "0%",
        gasForProcessing: "0"
    }

    try {
        const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const Token = new ethers.Contract(address, TokenAbi, provider)

        const dividendTracker = await Token.dividendTracker()
        const processingConfig = await Token.getProcessingConfig()

        dividendSettings.hasDividendTracker = dividendTracker !== "0x0000000000000000000000000000000000000000"
        dividendSettings.distributionPercent = `${Number(processingConfig.distributionRewardsPercent) / 100}%`
        dividendSettings.gasForProcessing = Number(processingConfig.gasForProcessing).toLocaleString()

        if (dividendSettings.hasDividendTracker) {
            // Get rewards token from dividend tracker
            try {
                const DividendTracker = new ethers.Contract(dividendTracker, [
                    "function rewardsToken() view returns (address)"
                ], provider)
                dividendSettings.rewardsToken = await DividendTracker.rewardsToken()
            } catch (ex) {
                console.log("Error fetching rewards token:", ex.message)
            }
        }
    } catch (ex) {
        console.log("Error fetching dividend settings:", ex.message)
    }

    return update(ctx, `💎 **Dividend Configuration**
**${token?.name || "Token"}** (${token?.symbol || "???"})

**Current Dividend Settings:**
• Dividend Tracker: ${dividendSettings.hasDividendTracker ? '✅ Enabled' : '❌ Disabled'}
• Rewards Token: ${dividendSettings.rewardsToken === "None" ? "None" : `${dividendSettings.rewardsToken.slice(0, 8)}...`}
• Distribution Percentage: ${dividendSettings.distributionPercent}
• Gas for Processing: ${dividendSettings.gasForProcessing}

**Available Actions:**`, [
        !dividendSettings.hasDividendTracker ? [
            {
                text: `🚀 Setup Dividend Tracker`,
                callback_data: `setupdividend@${address}`,
            }
        ] : [],
        dividendSettings.hasDividendTracker ? [
            {
                text: `⚙️ Update Distribution %`,
                callback_data: `updatedistribution@${address}`,
            }
        ] : [],
        dividendSettings.hasDividendTracker ? [
            {
                text: `⛽ Update Gas Settings`,
                callback_data: `updategas@${address}`,
            }
        ] : [],
        [
            {
                text: `🔙 Back to Configuration`,
                callback_data: `tokenconfig@${address}`,
            }
        ]
    ])
}

// Processing settings configuration for post-handover tokens
const showProcessingConfiguration = async (ctx, address) => {
    const { chainId, pvkey } = state(ctx)
    if (!pvkey) return showWallet(ctx)

    const userIsOwner = await isTokenOwner(ctx, address)
    if (!userIsOwner) {
        return showError(ctx, "Access denied. You must be the token owner.", `tokenconfig@${address}`)
    }

    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)

    // Get current processing settings
    let processingSettings = {
        swapThreshold: "Loading...",
        gasForProcessing: "Loading...",
        autoProcessing: false,
        burnPercent: "Loading..."
    }

    try {
        const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const Token = new ethers.Contract(address, TokenAbi, provider)

        const processingConfig = await Token.getProcessingConfig()

        processingSettings = {
            swapThreshold: `${ethers.formatEther(processingConfig.swapThreshold)} tokens`,
            gasForProcessing: Number(processingConfig.gasForProcessing).toLocaleString(),
            autoProcessing: processingConfig.autoProcessing,
            burnPercent: `${Number(processingConfig.burnPercent) / 100}%`
        }
    } catch (ex) {
        console.log("Error fetching processing settings:", ex.message)
    }

    return update(ctx, `⚙️ **Processing Settings**
**${token?.name || "Token"}** (${token?.symbol || "???"})

**Current Processing Settings:**
• Swap Threshold: ${processingSettings.swapThreshold}
• Gas for Processing: ${processingSettings.gasForProcessing}
• Auto Processing: ${processingSettings.autoProcessing ? '✅ Enabled' : '❌ Disabled'}
• Burn Percentage: ${processingSettings.burnPercent}

**Available Actions:**`, [
        [
            {
                text: `💱 Update Swap Threshold`,
                callback_data: `updatethreshold@${address}`,
            }
        ],
        [
            {
                text: `⛽ Update Gas for Processing`,
                callback_data: `updateprocessgas@${address}`,
            }
        ],
        [
            {
                text: `🔄 Toggle Auto Processing`,
                callback_data: `toggleauto@${address}`,
            }
        ],
        [
            {
                text: `🔥 Update Burn Percentage`,
                callback_data: `updateburn@${address}`,
            }
        ],
        [
            {
                text: `🔙 Back to Configuration`,
                callback_data: `tokenconfig@${address}`,
            }
        ]
    ])
}

const showLPManagement = async (ctx, address) => {
    const { chainId, pvkey } = state(ctx)
    if (!pvkey) return showWallet(ctx)

    const userIsOwner = await isTokenOwner(ctx, address)
    if (!userIsOwner) {
        return showError(ctx, "Access denied. You must be the token owner.", `tokenconfig@${address}`)
    }

    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)

    // Get LP lock status
    let lpStatus = "Loading..."
    let canUnlock = false

    try {
        if (VANTABLACK_DEPLOYER_ADDRESS) {
            const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
            const provider = new ethers.JsonRpcProvider(chain.rpc)
            const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)

            // Get deployed token info to check actual locks in UniswapV2Locker
            const tokenId = await VantablackDeployer.deployedTokensIds(address)
            const deployedToken = await VantablackDeployer.deployedTokens(tokenId)

            // Check if locks actually exist in UniswapV2Locker
            const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
            const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, provider)

            const numUserLocks = await uniswapV2Locker.getUserNumLocksForToken(deployedToken.lpOwner, deployedToken.lpPair)

            if (numUserLocks > 0) {
                // Lock exists, check if it can be unlocked
                const lockInfo = await uniswapV2Locker.getUserLockForTokenAtIndex(deployedToken.lpOwner, deployedToken.lpPair, 0)
                const unlockDate = new Date(Number(lockInfo[3]) * 1000) // unlockDate is at index 3
                const now = Date.now()

                lpStatus = `🔒 Locked until ${unlockDate.toLocaleDateString()}`
                canUnlock = now > unlockDate.getTime()
            } else {
                lpStatus = "🔓 No locks found"
                canUnlock = false
            }
        }
    } catch (ex) {
        console.log("Error fetching LP status:", ex.message)
    }

    return update(ctx, `🔓 **LP Management**
**${token?.name || "Token"}** (${token?.symbol || "???"})

**Current LP Status:**
${lpStatus}

**Available Actions:**`, [
        canUnlock ? [
            {
                text: `🔓 Unlock LP Tokens`,
                callback_data: `confirm@unlock#${address}`,
            }
        ] : [],
        [
            {
                text: `📊 View LP Details`,
                callback_data: `lpstatus@${address}`,
            }
        ],
        [
            {
                text: `🔙 Back to Configuration`,
                callback_data: `tokenconfig@${address}`,
            }
        ]
    ])
}

const showLockManagement = async (ctx, address) => {
    const { chainId, pvkey } = state(ctx)
    if (!pvkey) return showWallet(ctx)

    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const provider = new ethers.JsonRpcProvider(chain.rpc)
    const wallet = new ethers.Wallet(pvkey, provider)

    // Get user's locks for this token
    let userLocks = []
    let lockDetails = []

    try {
        if (VANTABLACK_DEPLOYER_ADDRESS) {
            const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)

            // Get deployed token info
            const tokenId = await VantablackDeployer.deployedTokensIds(address)
            const deployedToken = await VantablackDeployer.deployedTokens(tokenId)

            // Check if locks exist in UniswapV2Locker
            const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
            const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, provider)

            const numUserLocks = await uniswapV2Locker.getUserNumLocksForToken(deployedToken.lpOwner, deployedToken.lpPair)

            if (numUserLocks > 0) {
                for (let i = 0; i < numUserLocks; i++) {
                    const lockInfo = await uniswapV2Locker.getUserLockForTokenAtIndex(deployedToken.lpOwner, deployedToken.lpPair, i)
                    // lockInfo: [lockDate, amount, initialAmount, unlockDate, lockID, owner]
                    const lockData = {
                        index: i,
                        lockID: Number(lockInfo[4]),
                        amount: ethers.formatEther(lockInfo[1]),
                        initialAmount: ethers.formatEther(lockInfo[2]),
                        lockDate: new Date(Number(lockInfo[0]) * 1000).toLocaleDateString(),
                        unlockDate: new Date(Number(lockInfo[3]) * 1000).toLocaleDateString(),
                        canUnlock: Number(lockInfo[3]) < Math.floor(Date.now() / 1000),
                        owner: lockInfo[5]
                    }
                    userLocks.push(lockData)
                }
            }
        }
    } catch (ex) {
        console.log("Error fetching lock information:", ex.message)
    }

    // Create lock details text
    let lockDetailsText = ""
    if (userLocks.length > 0) {
        lockDetailsText = `**Your Locks (${userLocks.length}):**\n\n`
        userLocks.forEach((lock, idx) => {
            lockDetailsText += `**Lock ${idx + 1}:**\n`
            lockDetailsText += `• Amount: ${lock.amount} LP tokens\n`
            lockDetailsText += `• Initial: ${lock.initialAmount} LP tokens\n`
            lockDetailsText += `• Locked: ${lock.lockDate}\n`
            lockDetailsText += `• Unlock: ${lock.unlockDate}\n`
            lockDetailsText += `• Status: ${lock.canUnlock ? '🔓 Ready to unlock' : '🔒 Still locked'}\n\n`
        })
    } else {
        lockDetailsText = "**No locks found for this token.**\n\n"
    }

    return update(ctx, `🔐 **Lock Management**
**${token?.name || "Token"}** (${token?.symbol || "???"})

${lockDetailsText}**Available Actions:**`, [
        userLocks.length > 0 ? [
            {
                text: `🔄 Relock Tokens`,
                callback_data: `input@relock#${address}`,
            },
            {
                text: `➕ Increase Lock Amount`,
                callback_data: `input@incrementLock#${address}`,
            },
            {
                text: `✂️ Split Lock`,
                callback_data: `input@splitLock#${address}`,
            },
            {
                text: `👤 Transfer Lock Ownership`,
                callback_data: `input@transferLock#${address}`,
            }
        ] : [],
        userLocks.some(lock => lock.canUnlock) ? [
            {
                text: `🔓 Withdraw from Lock`,
                callback_data: `input@withdrawLock#${address}`,
            }
        ] : [],
        [
            {
                text: `🚀 Migrate to V3`,
                callback_data: `input@migrateLock#${address}`,
            }
        ],
        [
            {
                text: `📊 View Lock Details`,
                callback_data: `viewlocks@${address}`,
            }
        ],
        [
            {
                text: `🔙 Back to Token`,
                callback_data: `token@${address}`,
            }
        ]
    ])
}

const showLockDetails = async (ctx, address) => {
    const { chainId, pvkey } = state(ctx)
    if (!pvkey) return showWallet(ctx)

    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const provider = new ethers.JsonRpcProvider(chain.rpc)

    let detailedLocks = []

    try {
        if (VANTABLACK_DEPLOYER_ADDRESS) {
            const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)

            // Get deployed token info
            const tokenId = await VantablackDeployer.deployedTokensIds(address)
            const deployedToken = await VantablackDeployer.deployedTokens(tokenId)

            // Get detailed lock information
            const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
            const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, provider)

            const numUserLocks = await uniswapV2Locker.getUserNumLocksForToken(deployedToken.lpOwner, deployedToken.lpPair)

            if (numUserLocks > 0) {
                for (let i = 0; i < numUserLocks; i++) {
                    const lockInfo = await uniswapV2Locker.getUserLockForTokenAtIndex(deployedToken.lpOwner, deployedToken.lpPair, i)
                    // lockInfo: [lockDate, amount, initialAmount, unlockDate, lockID, owner]
                    const now = Math.floor(Date.now() / 1000)
                    const unlockTime = Number(lockInfo[3])
                    const timeRemaining = unlockTime > now ? unlockTime - now : 0

                    const lockData = {
                        index: i,
                        lockID: Number(lockInfo[4]),
                        amount: ethers.formatEther(lockInfo[1]),
                        initialAmount: ethers.formatEther(lockInfo[2]),
                        lockDate: new Date(Number(lockInfo[0]) * 1000).toLocaleString(),
                        unlockDate: new Date(unlockTime * 1000).toLocaleString(),
                        timeRemaining: timeRemaining > 0 ? `${Math.floor(timeRemaining / 86400)}d ${Math.floor((timeRemaining % 86400) / 3600)}h ${Math.floor((timeRemaining % 3600) / 60)}m` : 'Unlocked',
                        canUnlock: unlockTime < now,
                        owner: lockInfo[5],
                        percentageLocked: ((Number(lockInfo[1]) / Number(lockInfo[2])) * 100).toFixed(2)
                    }
                    detailedLocks.push(lockData)
                }
            }
        }
    } catch (ex) {
        console.log("Error fetching detailed lock information:", ex.message)
    }

    let detailsText = `📊 **Detailed Lock Information**\n**${token?.name || "Token"}** (${token?.symbol || "???"})\n\n`

    if (detailedLocks.length > 0) {
        detailedLocks.forEach((lock, idx) => {
            detailsText += `**Lock ${idx + 1} (ID: ${lock.lockID}):**\n`
            detailsText += `• Current Amount: ${lock.amount} LP tokens\n`
            detailsText += `• Initial Amount: ${lock.initialAmount} LP tokens\n`
            detailsText += `• Percentage Remaining: ${lock.percentageLocked}%\n`
            detailsText += `• Lock Date: ${lock.lockDate}\n`
            detailsText += `• Unlock Date: ${lock.unlockDate}\n`
            detailsText += `• Time Remaining: ${lock.timeRemaining}\n`
            detailsText += `• Status: ${lock.canUnlock ? '🔓 Can be unlocked/withdrawn' : '🔒 Still locked'}\n`
            detailsText += `• Owner: ${buildWalletAbreviation(lock.owner)}\n\n`
        })
    } else {
        detailsText += "**No detailed lock information available.**\n\n"
    }

    return update(ctx, detailsText, [
        [
            {
                text: `🔙 Back to Lock Management`,
                callback_data: `lockmanage@${address}`,
            }
        ]
    ])
}

const showLPStatus = async (ctx, address) => {
    const { chainId, pvkey } = state(ctx)
    if (!pvkey)
        return showWallet(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const provider = new ethers.JsonRpcProvider(chain.rpc)

    let lpLockInfo = null;
    let error = null;

    try {
        if (VANTABLACK_DEPLOYER_ADDRESS) {
            const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)
            lpLockInfo = await VantablackDeployer.getLPLockInfo(address)
        } else {
            error = "VantablackDeployer address not configured"
        }
    } catch (ex) {
        error = ex.message
    }

    if (error) {
        return update(ctx, `⚠️ **Unable to fetch LP lock status**\n\nError: ${error}`, [
            [
                {
                    text: `← Back to Token`,
                    callback_data: `token@${address}`,
                }
            ]
        ])
    }

    if (!lpLockInfo) {
        return update(ctx, `❌ **LP Lock Information Not Available**\n\nThis token may not be deployed through VantablackDeployer.`, [
            [
                {
                    text: `← Back to Token`,
                    callback_data: `token@${address}`,
                }
            ]
        ])
    }

    const {
        lpManagementOption,
        lpLockExpiry,
        lpBalance,
        canUnlock,
        isUnicryptLocked,
        unicryptUnlockDate,
        unicryptLockAmount
    } = lpLockInfo

    const now = Math.floor(Date.now() / 1000)
    const formatDate = (timestamp) => new Date(timestamp * 1000).toLocaleString()

    // Check if LP is burned (management option 0)
    const isBurned = parseInt(lpManagementOption) === 0

    // Check if locks actually exist in UniswapV2Locker
    let actualLocksExist = false
    let actualCanUnlock = false

    try {
        const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)
        const tokenId = await VantablackDeployer.deployedTokensIds(address)
        const deployedToken = await VantablackDeployer.deployedTokens(tokenId)

        const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
        const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, provider)

        const numUserLocks = await uniswapV2Locker.getUserNumLocksForToken(deployedToken.lpOwner, deployedToken.lpPair)

        if (numUserLocks > 0) {
            actualLocksExist = true
            const lockInfo = await uniswapV2Locker.getUserLockForTokenAtIndex(deployedToken.lpOwner, deployedToken.lpPair, 0)
            const unlockTimestamp = Number(lockInfo[3]) // unlockDate is at index 3
            actualCanUnlock = now >= unlockTimestamp
        }
    } catch (error) {
        console.log("Error checking actual locks:", error.message)
    }

    // Calculate time remaining for lock (keep original logic for display)
    const timeRemaining = lpLockExpiry > now ? lpLockExpiry - now : 0
    const canActuallyUnlock = actualLocksExist && actualCanUnlock

    const formatTimeRemaining = (seconds) => {
        if (seconds <= 0) return 'Expired'
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60
        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
        if (minutes > 0) return `${minutes}m ${secs}s`
        return `${secs}s`
    }

    return update(ctx, `📊 **LP ${isBurned ? 'Burn' : 'Lock'} Status for ${aggrAddress(address)}**

🔒 **Management Option:** ${getLPManagementText(lpManagementOption)}

${isBurned ?
            '🔥 **Status:** LP tokens have been permanently burned for maximum security\n🛡️ **Maximum Protection**: LP tokens are permanently destroyed and cannot be recovered.' :
            `💧 **LP Balance:** ${ethers.formatEther(lpBalance || "0")} LP tokens\n${lpLockExpiry > 0 ? `⏰ **Lock Expiry:** ${formatDate(lpLockExpiry)}\n` : ''}${timeRemaining > 0 ? `⏳ **Time Remaining:** ${formatTimeRemaining(timeRemaining)}\n` : ''}${canActuallyUnlock ? '🟢 **Status:** Ready to unlock' : timeRemaining > 0 ? '🔴 **Status:** Still locked' : lpLockExpiry > 0 ? '🟢 **Status:** Lock expired' : '⚪ **Status:** Not locked'}`
        }

${!isBurned && isUnicryptLocked ? `🔐 **Unicrypt V2 Lock Details:**\n• **Lock Amount:** ${ethers.formatEther(unicryptLockAmount || "0")} LP tokens\n• **Unlock Date:** ${formatDate(unicryptUnlockDate || 0)}\n• **Status:** ${unicryptUnlockDate > now ? 'Locked ⏳' : 'Unlockable 🔓'}\n` : ''}

${isBurned ? '' : '**Available Actions:**'}`, [
        // Only show unlock button if LP is not burned and lock time has elapsed
        canActuallyUnlock ? [
            {
                text: `🔓 Unlock LP Tokens`,
                callback_data: `confirm@unlock#${address}`,
            }
        ] : [],
        !isBurned && !isUnicryptLocked && lpBalance > 0 ? [
            {
                text: `🔒 Lock with Unicrypt`,
                callback_data: `confirm@lock#${address}`,
            }
        ] : [],
        [
            {
                text: `🔄 Refresh Status`,
                callback_data: `lpstatus@${address}`,
            },
            {
                text: `← Back`,
                callback_data: `token@${address}`,
            }
        ]
    ])
}

// isValidUrl function removed - using validateUrl instead

function replaceWebsite(website) {
    const TokenSourceCode = fs.readFileSync("./contracts/Token.sol").toString('utf8');
    const replaced = TokenSourceCode.replace("Website:", "Website: " + website);
    fs.writeFileSync("./contracts/Token.sol", replaced);
}

function replaceTelegram(telegram) {
    const TokenSourceCode = fs.readFileSync("./contracts/Token.sol").toString('utf8');
    const replaced = TokenSourceCode.replace("Telegram:", "Telegram: " + telegram);
    fs.writeFileSync("./contracts/Token.sol", replaced);
}

function replaceX(x) {
    const TokenSourceCode = fs.readFileSync("./contracts/Token.sol").toString('utf8');
    const replaced = TokenSourceCode.replace("X:", "X: " + x);
    fs.writeFileSync("./contracts/Token.sol", replaced);
}


bot.start(async (ctx) => {
    showWelcome(ctx)
})

bot.catch((err, ctx) => {
    try {
        ctx.reply(err.message, { reply_to_message_id: ctx.message?.message_id })
    } catch (ex) {
        console.log(ex)
        ctx.sendMessage(err.message)
    }
})

bot.command('settings', ctx => {
    showAccount(ctx)
})

bot.command('deploy', ctx => {
    showDeploy(ctx)
})

// Admin command for whitelist management
bot.command('whitelist', async (ctx) => {
    const { pvkey, chainId } = state(ctx)
    if (!pvkey) return showStart(ctx)

    try {
        const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)

        if (!VANTABLACK_DEPLOYER_ADDRESS) {
            return ctx.reply("❌ VantablackDeployer address not configured")
        }

        // Check if user is the owner of VantablackDeployer contract
        const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)
        const owner = await VantablackDeployer.owner()

        if (wallet.address.toLowerCase() !== owner.toLowerCase()) {
            return ctx.reply("❌ Access denied. Only contract owner can manage whitelist.")
        }

        const args = ctx.message.text.split(' ')
        if (args.length < 3) {
            return ctx.reply(`**📋 Whitelist Management**

**Usage:**
\`/whitelist add <address>\` - Add address to whitelist
\`/whitelist remove <address>\` - Remove address from whitelist  
\`/whitelist check <address>\` - Check if address is whitelisted
\`/whitelist list\` - Show funding status

**Example:**
\`/whitelist add 0x742d35cc6A7AC36b100A1f87F3Cc67C4d5F9E1A2\``)
        }

        const action = args[1].toLowerCase()
        const address = args[2]

        if (action === 'add') {
            if (!ethers.isAddress(address)) {
                return ctx.reply("❌ Invalid address format")
            }

            const tx = await VantablackDeployer.addToWhitelist(address)
            await tx.wait()

            ctx.reply(`✅ Address \`${address}\` added to whitelist successfully!`)
        } else if (action === 'remove') {
            if (!ethers.isAddress(address)) {
                return ctx.reply("❌ Invalid address format")
            }

            const tx = await VantablackDeployer.removeFromWhitelist(address)
            await tx.wait()

            ctx.reply(`✅ Address \`${address}\` removed from whitelist successfully!`)
        } else if (action === 'check') {
            if (!ethers.isAddress(address)) {
                return ctx.reply("❌ Invalid address format")
            }

            const isApproveded = await VantablackDeployer.isApproveded(address)
            ctx.reply(`**Whitelist Status for \`${address}\`:**
${isApproveded ? '✅ **Whitelisted** - Can use Vantablack funding' : '❌ **Not Whitelisted** - Cannot use Vantablack funding'}`)
        } else if (action === 'list') {
            const lpFundingBalance = await VantablackDeployer.lpFundingBalance()
            const lpFundingAmount = await VantablackDeployer.lpFundingAmount()
            const canFund = lpFundingBalance >= lpFundingAmount

            ctx.reply(`**📊 Vantablack Funding Status:**
• Funding Balance: ${ethers.formatEther(lpFundingBalance)} ${chain.symbol}
• Required Amount: ${ethers.formatEther(lpFundingAmount)} ${chain.symbol}
• Status: ${canFund ? '✅ Funding Available' : '❌ Insufficient Funds'}
• Tokens Deployable: ${canFund ? Math.floor(Number(ethers.formatEther(lpFundingBalance)) / Number(ethers.formatEther(lpFundingAmount))) : 0}`)
        } else {
            ctx.reply("❌ Invalid action. Use: add, remove, check, or list")
        }

    } catch (ex) {
        console.log("Whitelist command error:", ex)
        ctx.reply(`❌ Error: ${ex.message}`)
    }
})


bot.action('disconnect', (ctx) => {
    state(ctx, { pvkey: undefined })
    showStart(ctx)
})

bot.action(/^confirm@(?<action>\w+)(#(?<params>.+))?$/, async (ctx) => {
    const { action, params } = ctx.match.groups
    const mid = ctx.update.callback_query.message.message_id
    console.log({ action, params, mid })
    const config = {
        deploy: {
            precheck: async (ctx) => {
                const { token, chainId, pvkey } = state(ctx)
                if (!token.symbol)
                    throw new Error('You have to input symbol')
                if (!token.name)
                    throw new Error('You have to input name')
                const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)

                const provider = new ethers.JsonRpcProvider(chain.rpc)
                const wallet = new ethers.Wallet(pvkey, provider)
                const balance = await provider.getBalance(wallet.address);

                const limit = ethers.parseEther(String(chain.limit))
                if (balance < limit) {
                    throw new Error(`Insufficient ${chain.symbol} balance!\nYou should have at least "${ethers.formatEther(limit)} ${chain.symbol}" in wallet`)
                }

                // Only check ETH balance for self-funded deployments
                if (!token.isVantablackFunded && token.ethLP) {
                    const ethLP = ethers.parseEther(token.ethLP.toFixed(18))
                    if (balance + limit < ethLP) {
                        throw new Error(`Insufficient ${chain.symbol} balance!\nYou should have at least "${ethers.formatEther(ethLP + limit)} ${chain.symbol}" in wallet`)
                    }
                }

                if (token.reflectionTokenAddress) {
                    const reflectionPercent = Math.floor((token.reflectionPercentage ?? 0) * 100);
                    if (reflectionPercent == 0) {
                        throw new Error(`You have to specify reflection percentage (1-10%)`)
                    }
                    if (reflectionPercent < 100 || reflectionPercent > 1000) {
                        throw new Error(`Reflection percentage must be between 1% and 10%`)
                    }
                }

                if (Math.floor((token.reflectionPercentage ?? 0) * 100) > 0) {
                    if (!token.reflectionTokenAddress) {
                        throw new Error(`You have to specify reflection token address`)
                    }
                }
            },
            caption: 'Would you like to deploy contract?',
            back: 'back@deploy',
            proceed: `deploy#${mid}`
        },
        mix: {
            precheck: (ctx) => {
                const { mixerAmount, mixerReceiverAddress } = state(ctx)
                if (!mixerAmount || mixerAmount == 0)
                    throw new Error('You have to input amount')
                if (!mixerReceiverAddress || mixerReceiverAddress == "")
                    throw new Error('You have to input receiver address')
            },
            caption: 'Would you like to mix?',
            back: 'back@welcome',
            proceed: `mix#${mid}`
        },
        update: {
            precheck: (ctx) => {
                const { token: { buyTax, sellTax }, chainId } = state(ctx)
                const token = tokens(ctx).find(token => token.chain == chainId && token.address == params)
                if (!token)
                    return
                if (buyTax == token.buyTax)
                    throw new Error('You have to input buy fee')
                if (sellTax == token.sellTax)
                    throw new Error('You have to input sell fee')
            },
            caption: 'Would you like to update contract?',
            back: `token@${params}`,
            proceed: `update@${params}#${mid}`
        },
        renounce: {
            caption: 'Would you like to renounce ownership?',
            back: `token@${params}`,
            proceed: `renounce@${params}#${mid}`
        },
        lock: {
            caption: 'Would you like to lock LP tokens with Unicrypt V2?',
            back: `token@${params}`,
            proceed: `lock@${params}#${mid}`
        },
        unlock: {
            caption: 'Would you like to unlock LP tokens?',
            back: `token@${params}`,
            proceed: `unlock@${params}#${mid}`
        },
        handover: {
            caption: 'Would you like to execute handover? This will transfer token ownership to dev and handle LP management.',
            back: `token@${params}`,
            proceed: `handover@${params}#${mid}`
        },
        withdrawTax: {
            caption: 'Would you like to withdraw accumulated tax balance?',
            back: `token@${params}`,
            proceed: `withdrawTax@${params}#${mid}`
        },
        relock: {
            precheck: (ctx) => {
                const { lockParams } = state(ctx)
                if (!lockParams || !lockParams.lockIndex !== undefined || !lockParams.lockID || !lockParams.newUnlockDate) {
                    throw new Error('Lock parameters not set. Please enter lock details first.')
                }
            },
            caption: 'Would you like to relock with new unlock date?',
            back: `lockmanage@${params}`,
            proceed: `relock@${params}#${mid}`
        },
        incrementLock: {
            precheck: (ctx) => {
                const { lockParams } = state(ctx)
                if (!lockParams || !lockParams.lockIndex !== undefined || !lockParams.lockID || !lockParams.amount) {
                    throw new Error('Lock parameters not set. Please enter lock details first.')
                }
            },
            caption: 'Would you like to increase the lock amount?',
            back: `lockmanage@${params}`,
            proceed: `incrementLock@${params}#${mid}`
        },
        splitLock: {
            precheck: (ctx) => {
                const { lockParams } = state(ctx)
                if (!lockParams || !lockParams.lockIndex !== undefined || !lockParams.lockID || !lockParams.amount) {
                    throw new Error('Lock parameters not set. Please enter lock details first.')
                }
            },
            caption: 'Would you like to split this lock?',
            back: `lockmanage@${params}`,
            proceed: `splitLock@${params}#${mid}`
        },
        transferLock: {
            precheck: (ctx) => {
                const { lockParams } = state(ctx)
                if (!lockParams || !lockParams.lockIndex !== undefined || !lockParams.lockID || !lockParams.newOwner) {
                    throw new Error('Lock parameters not set. Please enter lock details first.')
                }
            },
            caption: 'Would you like to transfer lock ownership?',
            back: `lockmanage@${params}`,
            proceed: `transferLock@${params}#${mid}`
        },
        withdrawLock: {
            precheck: (ctx) => {
                const { lockParams } = state(ctx)
                if (!lockParams || !lockParams.lockIndex !== undefined || !lockParams.lockID || !lockParams.amount) {
                    throw new Error('Lock parameters not set. Please enter lock details first.')
                }
            },
            caption: 'Would you like to withdraw from this lock?',
            back: `lockmanage@${params}`,
            proceed: `withdrawLock@${params}#${mid}`
        },
        migrateLock: {
            precheck: (ctx) => {
                const { lockParams } = state(ctx)
                if (!lockParams || !lockParams.lockIndex !== undefined || !lockParams.lockID || !lockParams.amount) {
                    throw new Error('Lock parameters not set. Please enter lock details first.')
                }
            },
            caption: 'Would you like to migrate this lock to Uniswap V3?',
            back: `lockmanage@${params}`,
            proceed: `migrateLock@${params}#${mid}`
        },
        addliquidity: {
            precheck: (ctx) => {
                console.log('addliquidity', ctx)

            },
            caption: 'Would you like add liquidity?',
            back: `token@${params}`,
            proceed: `addliquidity@${params}#${mid}`
        },
    }[action]
    try {
        await config.precheck?.(ctx)
        create(ctx, [`⚠️ ${config.caption} ⚠️`, ...(config.prompt ? [config.prompt] : [])].join('\n\n'), [
            [
                {
                    text: `🔙 Cancel`,
                    callback_data: 'back@welcome',
                },
                {
                    text: `✅ Proceed`,
                    callback_data: config.proceed
                }
            ]
        ])
    } catch (ex) {
        await showError(ctx, ex.message, config.back)
        // const err = await ctx.sendMessage(`⚠️ ${ex.message}`)
        // setTimeout(() => ctx.telegram.deleteMessage(err.chat.id, err.message_id).catch(ex => { console.log(ex) }))
    }
})


bot.action('reset', (ctx) => {
    state(ctx, { token: {} })
    showDeploy(ctx)
})

bot.action(/^toggle@(?<option>\w+)$/, async (ctx) => {
    const { option } = ctx.match.groups
    const { token, chainId, pvkey } = state(ctx)

    if (option === 'vantablackFunding') {
        // Check if Vantablack funding is available before toggling
        if (!token.isVantablackFunded) {
            try {
                const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
                const provider = new ethers.JsonRpcProvider(chain.rpc)
                const wallet = new ethers.Wallet(pvkey, provider)

                if (VANTABLACK_DEPLOYER_ADDRESS) {
                    const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)

                    const lpFundingBalance = await VantablackDeployer.lpFundingBalance()
                    const lpFundingAmount = await VantablackDeployer.lpFundingAmount()
                    const isUserWhitelisted = await VantablackDeployer.isApproveded(wallet.address)

                    if (lpFundingBalance < lpFundingAmount) {
                        return ctx.answerCbQuery("❌ Vantablack funding is not available - insufficient contract balance", { show_alert: true })
                    }

                    if (!isUserWhitelisted) {
                        return ctx.answerCbQuery("❌ You are not whitelisted for Vantablack funding. Contact @VantablackSupport", { show_alert: true })
                    }
                }
            } catch (error) {
                return ctx.answerCbQuery("❌ Error checking Vantablack funding availability", { show_alert: true })
            }
        }

        state(ctx, { token: { ...token, isVantablackFunded: !token.isVantablackFunded } })
    } else if (option === 'firstBuy') {
        state(ctx, { token: { ...token, hasFirstBuy: !token.hasFirstBuy } })
    }

    showDeploy(ctx)
})

bot.action(/^select@(?<option>\w+)$/, (ctx) => {
    const { option } = ctx.match.groups

    if (option === 'lpManagement') {
        showLPManagementOptions(ctx)
    }
})

const showLPManagementOptions = (ctx) => {
    const { token } = state(ctx)

    update(ctx, `🔒 **LP Token Security Options**

Choose how LP tokens will be managed after ROI is achieved:

─────────────────────────

**🔥 Burn LP Tokens**
• Permanently destroys LP tokens
• **Maximum security** - prevents any rugpull
• Tokens can still be traded normally
• **Recommended for long-term projects**

─────────────────────────

**🔒 Lock with Unicrypt V2**
• Professional LP locking service powered by Unicrypt
• Publicly verifiable on blockchain
• Automatic unlock after period expires
• Industry-standard security solution

─────────────────────────

**Current selection:** ${getLPManagementText(token.lpManagementOption) || 'None selected'}

─────────────────────────`, [
        [
            {
                text: `${token.lpManagementOption === 0 ? '🟢' : '⚪'} 🔥 Burn LP (Default)`,
                callback_data: `setLPOption@0`,
            }
        ],
        [
            {
                text: `${token.lpManagementOption === 1 ? '🟢' : '⚪'} 🔒 1 Month (Unicrypt)`,
                callback_data: `setLPOption@1`,
            },
            {
                text: `${token.lpManagementOption === 2 ? '🟢' : '⚪'} 🔐 6 Months (Unicrypt)`,
                callback_data: `setLPOption@2`,
            }
        ],
        [
            {
                text: `${token.lpManagementOption === 3 ? '🟢' : '⚪'} ⏱️ 1 Minute (Testing)`,
                callback_data: `setLPOption@3`,
            },
            {
                text: `${token.lpManagementOption === 4 ? '🟢' : '⚪'} ⏰ 5 Minutes (Testing)`,
                callback_data: `setLPOption@4`,
            }
        ],
        [
            {
                text: `← Back to Setup`,
                callback_data: `back@deploy`,
            },
        ],
    ])
}

bot.action(/^setLPOption@(?<option>\d+)$/, (ctx) => {
    const { option } = ctx.match.groups
    const { token } = state(ctx)

    state(ctx, { token: { ...token, lpManagementOption: parseInt(option) } })
    showDeploy(ctx)
})

bot.action('close', ctx => {
    ctx.telegram.deleteMessage(ctx.chat.id, ctx.update.callback_query.message.message_id).catch(ex => { console.log(ex) })
})

bot.action('platform_tokens', async (ctx) => {
    await showPlatformTokens(ctx)
})

bot.action(/^deploy(#(?<mid>\d+))?$/, async (ctx) => {
    // // Rate limiting - max 3 deployments per hour per user
    // if (!checkRateLimit(ctx.from.id, 'deploy', 3, 3600000)) {
    //     return showError(ctx, 'Rate limit exceeded. Maximum 3 deployments per hour.', 'deploy');
    // }

    let wait = await showWait(ctx, 'Deploying Contract ...')
    try {
        const { token, chainId, pvkey } = state(ctx)
        if (!token.symbol) {
            throw new Error('You have to input symbol')
        }

        if (!token.name) {
            throw new Error('You have to input name')
        }


        const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)

        // const provider = new ethers.JsonRpcProvider(chain.rpc)
        // const wallet = new ethers.Wallet(pvkey, provider)

        // copy TokenBase.sol to Token.sol
        // fs.copyFileSync("./contracts/TokenBase.sol.bk", "./contracts/Token.sol");

        // VantablackDeployer handles supply automatically (1B tokens hardcoded in contract)
        // reflectionPercentage and reflectionTokenAddress removed - not used in current VantablackDeployer version
        console.log('Deploying token through VantablackDeployer...')
        // Social media updates (if needed for legacy token contracts)
        if (token.website) {
            replaceWebsite(token.website)
        }
        if (token.telegram) {
            replaceTelegram(token.telegram)
        }
        if (token.x) {
            replaceX(token.x)
        }

        // Direct VantablackDeployer integration - no external scripts needed

        // Deploy using VantablackDeployer contract directly
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)

        if (!VANTABLACK_DEPLOYER_ADDRESS) {
            throw new Error("VantablackDeployer address not configured. Please set VENTABLACK_DEPLOYER in environment variables.")
        }

        const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, wallet)

        // Check if user is whitelisted for Vantablack funding

        // const isApproveded = await VantablackDeployer.isApproveded(wallet.address)
        // if (!isApproveded) {
        //     throw new Error(`Your wallet is not whitelisted for Vantablack funding. Contact @VantablackSupport to request whitelist access.`)
        // }


        // Prepare deployment parameters
        // Calculate lock duration based on management option
        const getLockDuration = (option) => {
            switch (option) {
                case 0: return 0;        // Burn - no lock needed
                case 1: return 2592000;  // 1 Month = 30 * 24 * 60 * 60 seconds
                case 2: return 15552000; // 6 Months = 180 * 24 * 60 * 60 seconds  
                case 3: return 60;       // 1 Minute = 60 seconds
                case 4: return 300;      // 5 Minutes = 5 * 60 seconds
                default: return 3600;    // Default to 1 hour
            }
        }

        const amounts = [
            ethers.parseEther((token.firstBuyAmount ?? 0).toString()),           // firstBuyAmount converted from ETH to wei
            BigInt(getLockDuration(token.lpManagementOption ?? 1)), // lockDuration based on option
            BigInt(token.lpManagementOption ?? 1)        // lpManagementOption - default to lock (1) instead of 0
        ]

        const addresses = [
            wallet.address,                         // owner
            token.taxReceiver ?? wallet.address,   // treasury
            "0xedf6066a2b290C185783862C7F4776A2C8077AD1", // router (unused, kept for compatibility)
            token.reflectionTokenAddress ?? "0x0000000000000000000000000000000000000000" // dividendTokenAddress
        ]

        const percents = [
            Math.floor((token.buyTax ?? 0) * 100),  // buyFee - user's custom tax (applied after launch period)
            Math.floor((token.sellTax ?? 0) * 100), // sellFee - user's custom tax (applied after launch period)
            0,                                      // transferFee
            Math.floor((token.burnPerTx ?? 0) * 100), // burnPercent
            Math.floor((token.reflectionPercentage ?? 0) * 100) // distributionRewardsPercent
        ]

        const flags = [
            token.hasFirstBuy ?? false,             // hasFirstBuy
            (token.lpManagementOption ?? 1) === 0,  // burnTokens - only true for option 0
        ]

        const metadata = [token.name, token.symbol]

        // Automatically determine funding method
        let ethValue = "0"
        let actuallyUseVantablackFunding = false

        try {
            // Check if user is whitelisted and Vantablack has sufficient funds
            const isApproveded = await VantablackDeployer.isApproveded(wallet.address)
            const canVantablackFund = await VantablackDeployer.canVantablackFund(wallet.address)

            // Auto-select Vantablack funding if user is whitelisted and deployer has funds
            if (isApproveded && canVantablackFund) {
                actuallyUseVantablackFunding = true
                ethValue = "0" // Request Vantablack funding
                console.log('🟢 Auto-selected Vantablack funding (user whitelisted + sufficient funds)')
            } else {
                // User must self-fund
                if (!token.ethLP) {
                    throw new Error('ETH LP amount is required for self-funded deployment')
                }
                ethValue = ethers.parseEther(token.ethLP.toString())
                console.log(`🔴 Self-funding required: ${!isApproveded ? 'not whitelisted' : 'insufficient Vantablack funds'}`)
            }
        } catch (error) {
            console.log('⚠️  Error checking Vantablack status, defaulting to self-funding:', error.message)
            // Fallback to self-funding
            if (!token.ethLP) {
                throw new Error('ETH LP amount is required for self-funded deployment')
            }
            ethValue = ethers.parseEther(token.ethLP.toString())
        }

        console.log('Deploying with VantablackDeployer:')
        console.log('  amounts[0] (firstBuyAmount):', amounts[0].toString())
        console.log('  amounts[1] (lockDuration):', amounts[1].toString())
        console.log('  amounts[2] (lpManagementOption):', amounts[2].toString())
        console.log('  addresses:', addresses)
        console.log('  flags[0] (hasFirstBuy):', flags[0])
        console.log('  flags[1] (burnTokens):', flags[1])
        console.log('  metadata:', metadata)
        console.log('  ethValue:', ethValue.toString())

        try {
            const tx = await VantablackDeployer.deployToken(
                amounts,
                addresses,
                percents,
                flags,
                metadata,
                { value: ethValue }
            );

            const receipt = await tx.wait()

            // Extract token address from events
            let deployedTokenAddress = null
            for (const log of receipt.logs) {
                try {
                    const parsed = VantablackDeployer.interface.parseLog(log)
                    if (parsed && parsed.name === 'TokenDeployed') {
                        deployedTokenAddress = parsed.args.tokenAddress
                        break
                    }
                } catch (e) {
                    // Not a VantablackDeployer event, continue
                }
            }

            if (!deployedTokenAddress) {
                // Fallback: get deployed tokens count and derive address
                const tokenCount = await VantablackDeployer.deployedTokensCount()
                const deployedToken = await VantablackDeployer.deployedTokens(tokenCount)
                deployedTokenAddress = deployedToken.tokenAddress
            }

            const txHash = tx.hash
            console.log({
                deployedTokenAddress,
                txHash
            })

            // Send token announcement to channel
            const channelID = "-1002376275391"
            await sendTokenAnnouncementToChannel(ctx, {
                address: deployedTokenAddress,
                name: token.name,
                symbol: token.symbol,
                logo: token.logo,
                website: token.website,
                telegram: token.telegram,
                x: token.x,
                txHash: txHash,
                chain: chain
            }, channelID)

            // Store deployed token
            tokens(ctx, { ...token, address: deployedTokenAddress, chain: chainId, deployer: wallet.address })
            state(ctx, { token: {} })

            let lockStatus = "❌"
            if (token.isVantablackFunded) {
                if (token.lpManagementOption === 0) lockStatus = "🔥 Will Burn"
                else if (token.lpManagementOption >= 1 && token.lpManagementOption <= 3) lockStatus = "🔒 Will Lock with Unicrypt"
            }

            let message = "🎉🎉🎉<b>New token deployed with VantablackDeployer</b>🎉🎉🎉\n\n" +
                "<b>Token address:</b> " + "<code>" + deployedTokenAddress + "</code>" + "\n" +
                "<b>Token name:</b> " + token.name + "\n" +
                "<b>Token symbol:</b> " + token.symbol + "\n" +
                "<b>Token supply:</b> 1,000,000,000\n" +
                "<b>Taxes:</b> " + (token.buyTax || 0) + "/" + (token.sellTax || 0) + "%\n" +
                "<b>Vantablack Funded:</b> " + (token.isVantablackFunded ? "✅" : "❌") + "\n" +
                "<b>LP Management:</b> " + getLPManagementText(token.lpManagementOption) + "\n" +
                "<b>LP Security:</b> " + lockStatus + "\n" +
                "<b>Anti-Rug Features:</b> ✅ Enabled\n" +
                `<a href='${chain.scanUrl}/tx/${txHash}'>Tx Hash</a> | <a href='${chain.dextoolUrl}${deployedTokenAddress}'>Chart</a> | <a href='${chain.dexUrl}'>Dex</a>`

            if (token.website) {
                message += `\n<b>Website:</b> <a href='${token.website}'>${token.website}</a>`
            }
            if (token.telegram) {
                message += `\n<b>Telegram:</b> <a href='${token.telegram}'>${token.telegram}</a>`
            }
            if (token.x) {
                message += `\n<b>X:</b> <a href='${token.x}'>${token.x}</a>`
            }

            // Send to announcement channel if configured
            // if (process.env.ANNOUNCEMENT_CHANNEL_ID) {
            //     await bot.telegram.sendMessage(process.env.ANNOUNCEMENT_CHANNEL_ID, message, {
            //         disable_web_page_preview: true,
            //         parse_mode: "HTML"
            //     })
            // }

            // Clean up Token.sol if it exists
            // if (fs.existsSync("./contracts/Token.sol")) {
            //     fs.unlinkSync("./contracts/Token.sol")
            // }

            ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
            ctx.update.callback_query.message.message_id = ctx.match.groups.mid
            showToken(ctx, deployedTokenAddress)

        } catch (e) {
            console.error(e)
            await showError(ctx, e.message, 'deploy')
        }


    } catch (ex) {
        console.log(ex)
        await showError(ctx, ex.message)
        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
    }
})

bot.action(/^token@(?<address>0x[\da-f]{40})$/i, (ctx) => {
    showToken(ctx, ctx.match.groups.address)
})

bot.action(/^lpstatus@(?<address>0x[\da-f]{40})$/i, (ctx) => {
    showLPStatus(ctx, ctx.match.groups.address)
})

bot.action(/^viewlocks@(?<address>0x[\da-f]{40})$/i, (ctx) => {
    showLockDetails(ctx, ctx.match.groups.address)
})

bot.action(/^addliquidity@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { chainId, pvkey } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address

    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)
    const provider = new ethers.JsonRpcProvider(chain.rpc)
    const ethLP = ethers.parseEther(token.ethLP.toFixed(18))
    const wallet = new ethers.Wallet(pvkey, provider)
    const balance = await provider.getBalance(wallet.address)
    const supply = ethers.parseEther('1000000000') // Hardcoded 1B tokens
    const Token = new ethers.Contract(token.address, TokenAbi, wallet)
    const feeData = await provider.getFeeData()
    const gasPrice = (feeData.maxFeePerGas ?? feeData.gasPrice) * 15n / 10n

    console.log({
        token,
        address,
        chainId
    })

    let wait = await showWait(ctx, 'Adding **Liquidity** ...')



    const limit = ethers.parseEther(String(chain.limit))
    if (balance < limit)
        throw new Error(`Insufficient ${chain.symbol} balance!\nYou should have at least "${ethers.formatEther(limit)} ${chain.symbol}" in wallet`)


    const Router = new ethers.Contract(chain.router, RouterAbi, wallet)
    const preMint = 0n // Define preMint variable
    const tokenLP = supply - (supply * BigInt(Math.floor((token.burnPerTx ?? 0) * 100)) / 10000n) - preMint
    await (await Token.approve(await Router.getAddress(), tokenLP, { gasPrice })).wait()
    await (await Router.addLiquidityETH(await Token.getAddress(), tokenLP, 0, 0, wallet.address, 2000000000, { value: ethLP, gasPrice })).wait()
    // if (payFBT) {
    //     await (await FbtToken.transfer(PLATFORM_FEE_ADDRESS_1, ethLP.mul(10).div(10000), { gasPrice })).wait()
    //     await (await FbtToken.transfer(PLATFORM_FEE_ADDRESS_2, ethLP.mul(10).div(10000), { gasPrice })).wait()
    //     await (await FbtToken.transfer(REVENUE_CONTRACT, ethLP.mul(30).div(10000), { gasPrice })).wait()
    // } else {
    //     await (await wallet.sendTransaction({ value: ethLP.mul(10).div(10000), to: PLATFORM_FEE_ADDRESS_1, gasPrice })).wait()
    //     await (await wallet.sendTransaction({ value: ethLP.mul(10).div(10000), to: PLATFORM_FEE_ADDRESS_2, gasPrice })).wait()
    //     await (await wallet.sendTransaction({ value: ethLP.mul(30).div(10000), to: REVENUE_CONTRACT, gasPrice })).wait()
    // }

    ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
    ctx.update.callback_query.message.message_id = ctx.match.groups.mid
    showToken(ctx, await Token.getAddress())
})

bot.action(/^renounce@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { chainId, pvkey } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address
    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)
    if (!token.renounced) {
        const wait = await showWait(ctx, 'Renouncing...')
        try {
            const provider = new ethers.JsonRpcProvider(chain.rpc)
            const feeData = await provider.getFeeData()
            const gasPrice = (feeData.maxFeePerGas ?? feeData.gasPrice) * 15n / 10n
            const wallet = new ethers.Wallet(pvkey, provider)
            const Token = new ethers.Contract(address, TokenAbi, wallet)
            await (await Token.renounceOwnership({ gasPrice })).wait()
            tokens(ctx, { chain: chainId, address, renounced: true }, true)
            ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
            ctx.update.callback_query.message.message_id = ctx.match.groups.mid
            showToken(ctx, address)
        } catch (ex) {
            ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
            showError(ctx, ex.message)
        }
    } else
        showError(ctx, 'Already renounced')
})

bot.action(/^update@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { token: config, chainId, pvkey } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address
    if (config.buyTax || config.sellTax) {
        const wait = await showWait(ctx, 'Updating...')
        try {
            const provider = new ethers.JsonRpcProvider(chain.rpc)
            const wallet = new ethers.Wallet(pvkey, provider)
            const Token = new ethers.Contract(address, TokenAbi, wallet)
            await (await Token.setTaxes(Math.floor((config.buyTax ?? 0) * 100), Math.floor((config.sellTax ?? 0) * 100), 0)).wait()
            tokens(ctx, { chain: chainId, address, buyTax: config.buyTax, sellTax: config.sellTax }, true)
            ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
            ctx.update.callback_query.message.message_id = ctx.match.groups.mid
            showToken(ctx, address)
        } catch (ex) {
            ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
            showError(ctx, ex.message)
        }
    }
})

// LP Token Unlock Handler
bot.action(/^unlock@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { chainId, pvkey } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address

    // Check if user is the LP owner and validate unlock conditions
    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)
    if (!token) {
        return showError(ctx, "Token not found.", `token@${address}`)
    }

    const provider = new ethers.JsonRpcProvider(chain.rpc)
    const wallet = new ethers.Wallet(pvkey, provider)

    if (!VANTABLACK_DEPLOYER_ADDRESS) {
        return showError(ctx, "VantablackDeployer address not configured", `token@${address}`)
    }

    const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)

    try {
        const tokenId = await VantablackDeployer.deployedTokensIds(address)
        const deployedToken = await VantablackDeployer.deployedTokens(tokenId)
        const userAddress = wallet.address

        if (deployedToken.lpOwner.toLowerCase() !== userAddress.toLowerCase()) {
            return showError(ctx, "Access denied. You must be the LP owner to unlock LP tokens.", `token@${address}`)
        }

        // Check if unlock time has elapsed
        const lpLockInfo = await VantablackDeployer.getLPLockInfo(address)
        if (!lpLockInfo.canUnlock) {
            return showError(ctx, "LP tokens cannot be unlocked yet. Lock time has not elapsed.", `token@${address}`)
        }

    } catch (error) {
        return showError(ctx, `Failed to validate unlock conditions: ${error.message}`, `token@${address}`)
    }

    const wait = await showWait(ctx, 'Unlocking LP tokens...')
    try {
        // Use UniswapV2Locker withdraw function directly
        const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
        const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, wallet)

        // Get the lock information to extract required parameters
        const tokenId = await VantablackDeployer.deployedTokensIds(address)
        const deployedToken = await VantablackDeployer.deployedTokens(tokenId)
        const lockOwner = deployedToken.lpOwner

        // Get the user's lock for this LP pair
        const numUserLocks = await uniswapV2Locker.getUserNumLocksForToken(lockOwner, deployedToken.lpPair)
        if (numUserLocks === 0n) {
            throw new Error("No locks found for this LP pair")
        }

        // Get the lock info (we'll withdraw from index 0, the first/main lock)
        const lockInfo = await uniswapV2Locker.getUserLockForTokenAtIndex(lockOwner, deployedToken.lpPair, 0)

        // lockInfo array: [lockDate, amount, initialAmount, unlockDate, lockID, owner]
        const lockID = lockInfo[4] // lockID is at index 4
        const amount = lockInfo[1] // amount is at index 1 (current locked amount)

        console.log("Withdraw parameters:", {
            lpToken: deployedToken.lpPair,
            index: 0,
            lockID: lockID.toString(),
            amount: amount.toString()
        })

        // Call withdraw function: withdraw(lpToken, index, lockID, amount)
        const tx = await uniswapV2Locker.withdraw(deployedToken.lpPair, 0, lockID, amount)
        await tx.wait()

        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        ctx.update.callback_query.message.message_id = ctx.match.groups.mid
        showSuccess(ctx, '✅ LP tokens unlocked successfully!', `token@${address}`, 3000)
    } catch (ex) {
        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        showError(ctx, ex.message, `token@${address}`)
    }
})

// Execute Handover Handler
bot.action(/^handover@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { chainId, pvkey } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address

    const wait = await showWait(ctx, 'Executing handover...')
    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)

        // Call executeHandover from the token contract itself
        const Token = new ethers.Contract(address, TokenAbi, wallet)
        const tx = await Token.executeHandover()
        await tx.wait()

        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        ctx.update.callback_query.message.message_id = ctx.match.groups.mid
        showSuccess(ctx, '✅ Handover executed successfully! LP tokens have been managed and ownership transferred.', `token@${address}`, 5000)
    } catch (ex) {
        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        showError(ctx, ex.message, `token@${address}`)
    }
})

// Withdraw Tax Balance Handler
bot.action(/^withdrawTax@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { chainId, pvkey } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address

    const wait = await showWait(ctx, 'Withdrawing tax balance...')
    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)

        if (!VANTABLACK_DEPLOYER_ADDRESS) {
            throw new Error("VantablackDeployer address not configured")
        }

        // First check the tax balance
        const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)
        const taxBalance = await VantablackDeployer.getProjectTaxBalance(address)

        if (taxBalance == 0n) {
            throw new Error("No tax balance available to withdraw")
        }

        // Close the project to distribute tax funds
        const VantablackDeployerWithSigner = VantablackDeployer.connect(wallet)
        const tx = await VantablackDeployerWithSigner.closeProject(address)
        await tx.wait()

        const balanceFormatted = ethers.formatEther(taxBalance)

        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        ctx.update.callback_query.message.message_id = ctx.match.groups.mid
        showSuccess(ctx, `✅ Tax balance distributed successfully!\n\nTotal: ${balanceFormatted} ${chain.symbol}\n• 25% to dev\n• 25% for buyback\n• 50% to funding wallet`, `token@${address}`, 5000)
    } catch (ex) {
        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        showError(ctx, ex.message, `token@${address}`)
    }
})

// Lock Management Handlers
bot.action(/^relock@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { chainId, pvkey, lockParams } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address

    const wait = await showWait(ctx, 'Relocking tokens...')
    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)

        // Get deployed token info
        const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)
        const tokenId = await VantablackDeployer.deployedTokensIds(address)
        const deployedToken = await VantablackDeployer.deployedTokens(tokenId)

        // Call relock function
        const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
        const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, wallet)

        const tx = await uniswapV2Locker.relock(
            deployedToken.lpPair,
            lockParams.lockIndex,
            lockParams.lockID,
            lockParams.newUnlockDate
        )
        await tx.wait()

        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        ctx.update.callback_query.message.message_id = ctx.match.groups.mid
        showSuccess(ctx, `✅ Lock relocked successfully!\n\nNew unlock date: ${new Date(lockParams.newUnlockDate * 1000).toLocaleString()}`, `lockmanage@${address}`, 3000)
    } catch (ex) {
        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        showError(ctx, ex.message, `lockmanage@${address}`)
    }
})

bot.action(/^incrementLock@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { chainId, pvkey, lockParams } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address

    const wait = await showWait(ctx, 'Increasing lock amount...')
    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)

        // Get deployed token info
        const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)
        const tokenId = await VantablackDeployer.deployedTokensIds(address)
        const deployedToken = await VantablackDeployer.deployedTokens(tokenId)

        // Call incrementLock function
        const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
        const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, wallet)

        const tx = await uniswapV2Locker.incrementLock(
            deployedToken.lpPair,
            lockParams.lockIndex,
            lockParams.lockID,
            lockParams.amount
        )
        await tx.wait()

        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        ctx.update.callback_query.message.message_id = ctx.match.groups.mid
        showSuccess(ctx, `✅ Lock amount increased successfully!\n\nAdded: ${ethers.formatEther(lockParams.amount)} LP tokens`, `lockmanage@${address}`, 3000)
    } catch (ex) {
        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        showError(ctx, ex.message, `lockmanage@${address}`)
    }
})

bot.action(/^splitLock@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { chainId, pvkey, lockParams } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address

    const wait = await showWait(ctx, 'Splitting lock...')
    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)

        // Get deployed token info
        const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)
        const tokenId = await VantablackDeployer.deployedTokensIds(address)
        const deployedToken = await VantablackDeployer.deployedTokens(tokenId)

        // Call splitLock function
        const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
        const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, wallet)

        const tx = await uniswapV2Locker.splitLock(
            deployedToken.lpPair,
            lockParams.lockIndex,
            lockParams.lockID,
            lockParams.amount,
            { value: ethers.parseEther("0.001") } // Small fee for split
        )
        await tx.wait()

        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        ctx.update.callback_query.message.message_id = ctx.match.groups.mid
        showSuccess(ctx, `✅ Lock split successfully!\n\nSplit amount: ${ethers.formatEther(lockParams.amount)} LP tokens`, `lockmanage@${address}`, 3000)
    } catch (ex) {
        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        showError(ctx, ex.message, `lockmanage@${address}`)
    }
})

bot.action(/^transferLock@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { chainId, pvkey, lockParams } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address

    const wait = await showWait(ctx, 'Transferring lock ownership...')
    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)

        // Get deployed token info
        const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)
        const tokenId = await VantablackDeployer.deployedTokensIds(address)
        const deployedToken = await VantablackDeployer.deployedTokens(tokenId)

        // Call transferLockOwnership function
        const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
        const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, wallet)

        const tx = await uniswapV2Locker.transferLockOwnership(
            deployedToken.lpPair,
            lockParams.lockIndex,
            lockParams.lockID,
            lockParams.newOwner
        )
        await tx.wait()

        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        ctx.update.callback_query.message.message_id = ctx.match.groups.mid
        showSuccess(ctx, `✅ Lock ownership transferred successfully!\n\nNew owner: ${buildWalletAbreviation(lockParams.newOwner)}`, `lockmanage@${address}`, 3000)
    } catch (ex) {
        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        showError(ctx, ex.message, `lockmanage@${address}`)
    }
})

bot.action(/^withdrawLock@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { chainId, pvkey, lockParams } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address

    const wait = await showWait(ctx, 'Withdrawing from lock...')
    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)

        // Get deployed token info
        const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)
        const tokenId = await VantablackDeployer.deployedTokensIds(address)
        const deployedToken = await VantablackDeployer.deployedTokens(tokenId)

        // Call withdraw function
        const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
        const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, wallet)

        const tx = await uniswapV2Locker.withdraw(
            deployedToken.lpPair,
            lockParams.lockIndex,
            lockParams.lockID,
            lockParams.amount
        )
        await tx.wait()

        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        ctx.update.callback_query.message.message_id = ctx.match.groups.mid
        showSuccess(ctx, `✅ Withdrawal successful!\n\nWithdrawn: ${ethers.formatEther(lockParams.amount)} LP tokens`, `lockmanage@${address}`, 3000)
    } catch (ex) {
        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        showError(ctx, ex.message, `lockmanage@${address}`)
    }
})

bot.action(/^migrateLock@(?<address>0x[\da-f]{40})#(?<mid>\d+)$/i, async (ctx) => {
    const { chainId, pvkey, lockParams } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const address = ctx.match.groups.address

    const wait = await showWait(ctx, 'Migrating lock to V3...')
    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const wallet = new ethers.Wallet(pvkey, provider)

        // Get deployed token info
        const VantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)
        const tokenId = await VantablackDeployer.deployedTokensIds(address)
        const deployedToken = await VantablackDeployer.deployedTokens(tokenId)

        // Call migrate function
        const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
        const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, wallet)

        const tx = await uniswapV2Locker.migrate(
            deployedToken.lpPair,
            lockParams.lockIndex,
            lockParams.lockID,
            lockParams.amount
        )
        await tx.wait()

        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        ctx.update.callback_query.message.message_id = ctx.match.groups.mid
        showSuccess(ctx, `✅ Migration to V3 successful!\n\nMigrated: ${ethers.formatEther(lockParams.amount)} LP tokens`, `lockmanage@${address}`, 3000)
    } catch (ex) {
        ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(ex => { console.log(ex) })
        showError(ctx, ex.message, `lockmanage@${address}`)
    }
})

bot.action('existing', async (ctx) => {
    update(ctx, '⚠️ WARNING: Set a new private Key? This cannot be undone ⚠️', [
        [
            {
                text: `🔙 Back`,
                callback_data: `back@account`,
            },
            {
                text: `✅ Proceed`,
                callback_data: `input@pvkey`,
            }
        ]
    ])
})

// Tax Configuration Handler
bot.action(/^settax@(?<type>\w+)#(?<address>0x[\da-f]{40})$/i, async (ctx) => {
    const { type, address } = ctx.match.groups
    const { chainId } = state(ctx)

    const userIsOwner = await isTokenOwner(ctx, address)
    if (!userIsOwner) {
        return showError(ctx, "Access denied. You must be the token owner.", `tokenconfig@${address}`)
    }

    const token = tokens(ctx).find(token => token.chain == chainId && token.address == address)
    const taxType = type === 'buy' ? 'Buy' : type === 'sell' ? 'Sell' : 'Transfer'

    // Get current tax value
    let currentTax = "0"
    try {
        const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const Token = new ethers.Contract(address, TokenAbi, provider)

        if (type === 'buy' || type === 'sell') {
            const [buyTax, sellTax] = await Token.getCurrentTaxes()
            currentTax = `${Number(type === 'buy' ? buyTax : sellTax) / 100}`
        } else {
            const fees = await Token.getFees()
            currentTax = `${Number(fees.transferFee) / 100}`
        }
    } catch (ex) {
        console.log("Error fetching current tax:", ex.message)
    }

    state(ctx, { configType: `${type}Tax`, configAddress: address })

    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const caption = getInputCaptions(chain.symbol)[`${type}Tax`] || `📊 **Set ${taxType} Tax Rate**

Current ${taxType} Tax: **${currentTax}%**

⚠️ **Important:** You can only decrease taxes, not increase them.
Enter the new ${taxType.toLowerCase()} tax rate (0-${currentTax}%):

Examples: 0, 1.5, 3`

    return input(ctx, caption, `Please enter the new ${taxType.toLowerCase()} tax rate:`)
})

// LP Unlock Handler for post-handover tokens

bot.action('generate', (ctx) => {
    update(ctx, '⚠️ WARNING: Generate a new private Key? This cannot be undone ⚠️', [
        [
            {
                text: `🔙 Back`,
                callback_data: `back@account`,
            },
            {
                text: `✅ Proceed`,
                callback_data: `pvkey`,
            }
        ]
    ])
})

bot.action('pvkey', async (ctx) => {
    const wallet = ethers.Wallet.createRandom()
    state(ctx, { pvkey: wallet.privateKey, account: wallet.address })
    showSuccess(ctx, `Account generated! Store this securely, nobody cannot recover your private key \n\nPrivate key is "${wallet.privateKey}"\nAddress is "${wallet.address}"`, 'deploy', 0)
})

bot.action(/^chain@(?<chain>\d+)(#(?<page>\w+))?$/, (ctx) => {
    if (!ctx.match || !ctx.match.groups.chain) {
        throw Error("You didn't specify chain.")
    }
    const chain = SUPPORTED_CHAINS.find(chain => Number(ctx.match.groups.chain) == chain.id)
    if (!chain)
        throw Error("You selected wrong chain.")
    state(ctx, { chainId: chain.id })
    if (ctx.match && ctx.match.groups.page) {
        const page = ctx.match.groups.page
        showPage(ctx, page)
    } else
        showStart(ctx)
})

bot.action(/^back@(?<page>\w+)$/, (ctx) => {
    if (!ctx.match) {
        throw Error("You didn't specify chain.")
    }
    const page = ctx.match.groups.page
    showPage(ctx, page)
})

bot.action(/^input@(?<name>\w+)(#((?<address>0x[\da-fA-F]{40})|(?<id>.+)))?$/, async (ctx) => {
    if (!ctx.match) {
        return
    }
    const { name, address } = ctx.match.groups
    const { chainId } = state(ctx)
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const caption = getInputCaptions(chain.symbol)[name]
    if (!caption)
        return
    const { token: config, inputMessage } = state(ctx)
    console.log({
        name, address, caption, config
    })
    // Supply is hardcoded to 1B tokens, no need to check

    if (inputMessage) {
        bot.telegram.deleteMessage(ctx.chat.id, inputMessage.message_id).catch(ex => { console.log(ex) })
    }
    const msg = await create(ctx, caption)
    let inputBack = 'deploy'
    if (name == 'bridgeAmount')
        inputBack = 'bridges'
    else if (address)
        inputBack = `token@${address}`

    state(ctx, {
        inputMode: name, inputMessage: msg, context: ctx, inputBack
    })
})


bot.on(message('text'), async (ctx) => {
    const { chainId, inputMode, inputMessage, context, inputBack, configType } = state(ctx)
    console.log({ inputMode, inputMessage, context, inputBack })
    const chain = SUPPORTED_CHAINS.find(chain => chain.id == chainId)
    const provider = new ethers.JsonRpcProvider(chain.rpc)
    if (context) {
        const text = ctx.update.message.text.trim()
        try {
            if (inputMode == 'pvkey') {
                if (!validatePrivateKey(text)) {
                    throw Error('❌ **Invalid Private Key**\n\nPlease enter a valid 64-character hex string.\nExample: 0x1234...abcd or without 0x prefix.')
                }
            } else if (inputMode == 'symbol') {
                const sanitizedSymbol = sanitizeString(text).toUpperCase();
                if (!sanitizedSymbol || sanitizedSymbol.length < 1 || sanitizedSymbol.length > 10) {
                    throw Error('❌ **Invalid Token Symbol**\n\nSymbol must be 1-10 characters long.\nExamples: BTC, ETH, DOGE')
                }
                const { token } = state(ctx)
                state(ctx, { token: { ...token, symbol: sanitizedSymbol } })
            } else if (inputMode == 'name') {
                const sanitizedName = sanitizeString(text);
                if (!sanitizedName || sanitizedName.length < 1 || sanitizedName.length > 50) {
                    throw Error('❌ **Invalid Token Name**\n\nName must be 1-50 characters long.\nExamples: Bitcoin, Ethereum, My Token')
                }
                const { token } = state(ctx)
                state(ctx, { token: { ...token, name: sanitizedName } })
                // Supply input removed - hardcoded to 1B tokens
            } else if (inputMode == 'buyTax') {
                if (!validatePercentage(text, 5)) {
                    throw Error('❌ **Invalid Buy Tax**\n\nTax must be between 0% and 5%.\n\nNote: Launch starts at 25% → auto-reduces to 5% → your custom tax applied after handover.')
                }
                const { token } = state(ctx)
                state(ctx, { token: { ...token, buyTax: Number(text) } })
            } else if (inputMode == 'sellTax') {
                if (!validatePercentage(text, 5)) {
                    throw Error('❌ **Invalid Sell Tax**\n\nTax must be between 0% and 5%.\n\nNote: Launch starts at 25% → auto-reduces to 5% → your custom tax applied after handover.')
                }
                const { token } = state(ctx)
                state(ctx, { token: { ...token, sellTax: Number(text) } })
            } else if (configType && (configType === 'buyTax' || configType === 'sellTax' || configType === 'transferTax')) {
                // Post-handover tax configuration
                const { configAddress } = state(ctx)
                const taxType = configType.replace('Tax', '')
                await handleTaxUpdate(ctx, configAddress, taxType, Number(text))
                return
            } else if (inputMode == 'burnPerTx') {
                if (!validatePercentage(text)) {
                    throw Error('❌ **Invalid Burn Percentage**\n\nBurn must be between 0% and 10%.\nRecommended: 0-2% for deflationary mechanics.')
                }
                const { token } = state(ctx)
                state(ctx, { token: { ...token, burnPerTx: Number(text) } })
            } else if (inputMode == 'taxReceiver') {
                // Allow empty input to use default (deployer wallet)
                if (text && !validateAddress(text)) {
                    throw Error('❌ **Invalid Wallet Address**\n\nPlease enter a valid Ethereum address or leave blank for default.\nFormat: 0x followed by 40 hex characters.')
                }
                const { token } = state(ctx)
                // If empty, remove taxReceiver to use default
                if (!text.trim()) {
                    // Remove taxReceiver property to use default
                    const newToken = { ...token };
                    delete newToken.taxReceiver;
                    state(ctx, { token: newToken })
                } else {
                    state(ctx, { token: { ...token, taxReceiver: text } })
                }
            } else if (inputMode == 'ethLP') {
                if (!validateNumber(text, 0.001, 100)) {
                    throw Error(`Invalid ${chain.symbol} amount: Must be between 0.001 and 100 ${chain.symbol}`)
                }
                const { token } = state(ctx)
                state(ctx, { token: { ...token, ethLP: Number(text) } })
                // Token LP removed - now uses full supply automatically
            } else if (inputMode == 'poolAllocation') {
                const { token } = state(ctx)
                if (!validateNumber(text, 0)) {
                    throw Error('❌ **Invalid Pool Allocation**\n\nPool allocation must be 0 or a positive number.\nExample: 10000000 tokens for rewards')
                }
                // Pool allocation no longer needs to check against tokenLP since it uses full supply
                state(ctx, { token: { ...token, poolAllocation: Number(text) } })
            } else if (inputMode == 'website') {
                if (!validateUrl(text)) {
                    throw Error('❌ **Invalid Website URL**\n\nPlease enter a valid website URL.\nExample: https://mytoken.com')
                }
                const { token } = state(ctx)
                state(ctx, { token: { ...token, website: text } })
            } else if (inputMode == 'telegram') {
                if (!validateUrl(text)) {
                    throw Error('❌ **Invalid Telegram URL**\n\nPlease enter a valid Telegram URL.\nExample: https://t.me/mytokengroup')
                }
                const { token } = state(ctx)
                state(ctx, { token: { ...token, telegram: text } })
            } else if (inputMode == 'x') {
                if (!validateUrl(text)) {
                    throw Error('❌ **Invalid X (Twitter) URL**\n\nPlease enter a valid X (Twitter) URL.\nExample: https://x.com/mytoken')
                }
                const { token } = state(ctx)
                state(ctx, { token: { ...token, x: text } })
            } else if (inputMode == 'reflectionPercentage') {
                if (!validatePercentage(text, 10) || Number(text) < 1) {
                    throw Error('❌ **Invalid Reflection Percentage**\n\nReflection percentage must be between 1% and 10%.\nRecommended: 2-5% for healthy tokenomics')
                }
                const { token } = state(ctx)
                state(ctx, { token: { ...token, reflectionPercentage: Number(text) } })
            } else if (inputMode == 'reflectionTokenAddress') {
                if (!validateAddress(text)) {
                    throw Error('❌ **Invalid Reflection Token Address**\n\nPlease enter a valid Ethereum address.\nExample: 0x1234...5678 (42 characters)')
                }

                const code = await provider.getCode(text);
                if (code === '0x') {
                    throw new Error('❌ **Invalid Reflection Token**\n\nThe provided address is not a valid ERC20 contract.\nPlease verify the token address on Etherscan.')
                }
                let symbol;
                try {
                    const tokenContract = new ethers.Contract(text, TokenAbi, provider);
                    const tokenSupply = await tokenContract.totalSupply();
                    symbol = await tokenContract.symbol();
                    if (tokenSupply == 0n) {
                        throw new Error('❌ **Invalid Reflection Token**\n\nThe token contract has zero supply or is not valid.\nPlease use an active ERC20 token address.')
                    }
                } catch (ex) {
                    console.log(ex)
                    throw new Error('❌ **Invalid Reflection Token**\n\nUnable to verify token contract.\nPlease check the address and try again.')
                }

                const { token } = state(ctx)
                state(ctx, { token: { ...token, reflectionTokenAddress: text, reflectionTokenSymbol: symbol } })
            } else if (inputMode == 'firstBuyAmount') {
                if (!validateNumber(text, 0, 10)) {
                    throw Error(`❌ **Invalid First Buy Amount**\n\nFirst buy amount must be between 0 and 10 ${chain.symbol}.\nExample: 0.1 ${chain.symbol} for initial purchase`)
                }
                const { token } = state(ctx)
                state(ctx, { token: { ...token, firstBuyAmount: Number(text) } })
            } else if (inputMode == 'relock') {
                // Handle relock input: lockIndex,lockID,newUnlockDate
                const parts = text.split(',')
                if (parts.length !== 3) {
                    throw Error('❌ **Invalid Format**\n\nPlease enter: lockIndex,lockID,newUnlockDate\nExample: 0,123,1735689600')
                }
                const [lockIndex, lockID, newUnlockDate] = parts
                if (!validateNumber(lockIndex, 0) || !validateNumber(lockID, 0) || !validateNumber(newUnlockDate, Math.floor(Date.now() / 1000))) {
                    throw Error('❌ **Invalid Values**\n\nLock index and ID must be numbers, unlock date must be future timestamp')
                }
                state(ctx, { lockParams: { lockIndex: Number(lockIndex), lockID: Number(lockID), newUnlockDate: Number(newUnlockDate) } })
            } else if (inputMode == 'incrementLock') {
                // Handle increment lock input: lockIndex,lockID,amount
                const parts = text.split(',')
                if (parts.length !== 3) {
                    throw Error('❌ **Invalid Format**\n\nPlease enter: lockIndex,lockID,amount\nExample: 0,123,1000000000000000000')
                }
                const [lockIndex, lockID, amount] = parts
                if (!validateNumber(lockIndex, 0) || !validateNumber(lockID, 0) || !validateNumber(amount, 0)) {
                    throw Error('❌ **Invalid Values**\n\nAll values must be positive numbers')
                }
                state(ctx, { lockParams: { lockIndex: Number(lockIndex), lockID: Number(lockID), amount: amount } })
            } else if (inputMode == 'splitLock') {
                // Handle split lock input: lockIndex,lockID,amount
                const parts = text.split(',')
                if (parts.length !== 3) {
                    throw Error('❌ **Invalid Format**\n\nPlease enter: lockIndex,lockID,amount\nExample: 0,123,500000000000000000')
                }
                const [lockIndex, lockID, amount] = parts
                if (!validateNumber(lockIndex, 0) || !validateNumber(lockID, 0) || !validateNumber(amount, 0)) {
                    throw Error('❌ **Invalid Values**\n\nAll values must be positive numbers')
                }
                state(ctx, { lockParams: { lockIndex: Number(lockIndex), lockID: Number(lockID), amount: amount } })
            } else if (inputMode == 'transferLock') {
                // Handle transfer lock input: lockIndex,lockID,newOwner
                const parts = text.split(',')
                if (parts.length !== 3) {
                    throw Error('❌ **Invalid Format**\n\nPlease enter: lockIndex,lockID,newOwnerAddress\nExample: 0,123,0x742d35cc6A7AC36b100A1f87F3Cc67C4d5F9E1A2')
                }
                const [lockIndex, lockID, newOwner] = parts
                if (!validateNumber(lockIndex, 0) || !validateNumber(lockID, 0) || !validateAddress(newOwner)) {
                    throw Error('❌ **Invalid Values**\n\nLock index and ID must be numbers, new owner must be valid address')
                }
                state(ctx, { lockParams: { lockIndex: Number(lockIndex), lockID: Number(lockID), newOwner } })
            } else if (inputMode == 'withdrawLock') {
                // Handle withdraw lock input: lockIndex,lockID,amount
                const parts = text.split(',')
                if (parts.length !== 3) {
                    throw Error('❌ **Invalid Format**\n\nPlease enter: lockIndex,lockID,amount\nExample: 0,123,1000000000000000000')
                }
                const [lockIndex, lockID, amount] = parts
                if (!validateNumber(lockIndex, 0) || !validateNumber(lockID, 0) || !validateNumber(amount, 0)) {
                    throw Error('❌ **Invalid Values**\n\nAll values must be positive numbers')
                }
                state(ctx, { lockParams: { lockIndex: Number(lockIndex), lockID: Number(lockID), amount: amount } })
            } else if (inputMode == 'migrateLock') {
                // Handle migrate lock input: lockIndex,lockID,amount
                const parts = text.split(',')
                if (parts.length !== 3) {
                    throw Error('❌ **Invalid Format**\n\nPlease enter: lockIndex,lockID,amount\nExample: 0,123,1000000000000000000')
                }
                const [lockIndex, lockID, amount] = parts
                if (!validateNumber(lockIndex, 0) || !validateNumber(lockID, 0) || !validateNumber(amount, 0)) {
                    throw Error('❌ **Invalid Values**\n\nAll values must be positive numbers')
                }
                state(ctx, { lockParams: { lockIndex: Number(lockIndex), lockID: Number(lockID), amount: amount } })
            }

            if (inputMode == 'pvkey') {
                const wallet = new ethers.Wallet(text)
                state(ctx, { pvkey: wallet.privateKey, account: wallet.address })
                ctx.telegram.deleteMessage(ctx.chat.id, inputMessage.message_id).catch(ex => { console.log(ex) })
                ctx.telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id).catch(ex => { console.log(ex) })
                await showSuccess(context, `Account imported!\n\nPrivate key is "${wallet.privateKey}", address is "${wallet.address}"`, 'wallet', 0)
            } else if (inputBack) {
                showPage(context, inputBack)
            }

            ctx.telegram.deleteMessage(ctx.chat.id, inputMessage.message_id).catch(ex => { console.log(ex) })
            ctx.telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id).catch(ex => { console.log(ex) })
        } catch (ex) {
            console.log(ex)
            await showError(ctx, ex.message, inputBack)
        }

    }
})

// Handle image uploads for logo (both photo and document)
const handleImageUpload = async (ctx, fileInfo, isDocument = false) => {
    const { inputMode, inputMessage, context, inputBack } = state(ctx)
    console.log({ inputMode, imageReceived: true, isDocument, fileInfo })

    if (context && inputMode === 'logo') {
        try {
            let file, fileUrl, localImagePath;

            if (isDocument) {
                // Handle document upload (drag and drop often sends as document)
                const document = ctx.update.message.document

                // Validate MIME type for documents - only PNG and JPG
                const validMimeTypes = ['image/png', 'image/jpeg']
                if (!validMimeTypes.includes(document.mime_type)) {
                    throw Error('❌ **Invalid Image Format**\n\nOnly PNG and JPG images are supported.\nSupported formats: .png, .jpg')
                }

                file = await ctx.telegram.getFile(document.file_id)
                fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`

                // Generate filename based on token and timestamp
                const fileExtension = document.mime_type === 'image/png' ? 'png' : 'jpg'
                const fileName = `logo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${fileExtension}`

                // Download and save the image locally using multiple methods
                try {
                    localImagePath = await downloadAndSaveImage(fileUrl, fileName)
                } catch (urlError) {
                    console.log('❌ Direct URL download failed, trying alternative method:', urlError.message)
                    // Try alternative method using file buffer
                    localImagePath = await downloadImageAlternative(ctx, document.file_id, fileName)
                }
            } else {
                // Handle photo upload
                const photo = ctx.update.message.photo
                const largestPhoto = photo[photo.length - 1] // Get the largest size

                file = await ctx.telegram.getFile(largestPhoto.file_id)
                fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`

                console.log('📸 Photo file info:', { file_id: largestPhoto.file_id, file_path: file.file_path, fileUrl })

                // Photos from Telegram are typically JPEG format
                const fileExtension = 'jpg'

                // Generate filename based on token and timestamp
                const fileName = `logo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${fileExtension}`

                // Download and save the image locally using multiple methods
                try {
                    localImagePath = await downloadAndSaveImage(fileUrl, fileName)
                } catch (urlError) {
                    console.log('❌ Direct URL download failed, trying alternative method:', urlError.message)
                    // Try alternative method using file buffer
                    localImagePath = await downloadImageAlternative(ctx, largestPhoto.file_id, fileName)
                }
            }

            console.log('✅ Logo uploaded and saved locally:', localImagePath)

            // Store the local file path as the logo
            const { token } = state(ctx)
            state(ctx, { token: { ...token, logo: localImagePath } })

            // Delete messages and go back
            ctx.telegram.deleteMessage(ctx.chat.id, inputMessage.message_id).catch(ex => { console.log(ex) })
            ctx.telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id).catch(ex => { console.log(ex) })

            if (inputBack) {
                showPage(context, inputBack)
            }

        } catch (ex) {
            console.log('❌ Logo upload error:', ex)
            await showError(ctx, ex.message, inputBack)
        }
    } else if (context && inputMode !== 'logo') {
        // User uploaded image but we're not expecting a logo
        await showError(ctx, '❌ **Unexpected Image**\n\nImage uploads are only accepted when setting the token logo.\nPlease enter text for this field.', inputBack)
    }
}

// Handle photo uploads for logo
bot.on(message('photo'), async (ctx) => {
    await handleImageUpload(ctx, ctx.update.message.photo, false)
})

// Handle document uploads for logo (drag and drop often sends images as documents)
bot.on(message('document'), async (ctx) => {
    const document = ctx.update.message.document
    console.log('📎 Document received:', {
        fileName: document.file_name,
        mimeType: document.mime_type,
        fileSize: document.file_size,
        inputMode: state(ctx).inputMode
    })

    // Only handle image documents when expecting logo
    const { inputMode, context } = state(ctx)
    if (context && inputMode === 'logo' && document.mime_type && document.mime_type.startsWith('image/')) {
        await handleImageUpload(ctx, document, true)
    } else if (context && inputMode === 'logo') {
        // Document uploaded but not an image
        await showError(ctx, '❌ **Invalid File Type**\n\nPlease upload an image file (PNG or JPG only).\nDrag and drop is supported.', state(ctx).inputBack)
    }
})

// Debug handler to catch any unhandled messages when expecting logo
bot.use(async (ctx, next) => {
    const { inputMode, context } = state(ctx)
    if (context && inputMode === 'logo' && ctx.update.message) {
        console.log('🔍 Message received while expecting logo:', {
            messageType: Object.keys(ctx.update.message).filter(key =>
                !['message_id', 'from', 'chat', 'date'].includes(key)
            ),
            inputMode,
            hasPhoto: !!ctx.update.message.photo,
            hasDocument: !!ctx.update.message.document,
            hasText: !!ctx.update.message.text
        })
    }
    return next()
})

function buildWalletAbreviation(wallet) {
    return wallet.substring(0, 8) + "..." + wallet.substring(wallet.length - 6, wallet.length)
}

function getLPManagementText(option) {
    switch (option) {
        case 0: return "🔥 Burn LP"
        case 1: return "🔒 Lock 1 Month (Unicrypt)"
        case 2: return "🔐 Lock 6 Months (Unicrypt)"
        case 3: return "⏱️ Lock 1 Minute (Testing)"
        case 4: return "⏰ Lock 5 Minutes (Testing)"
        default: return "🔥 Burn LP"
    }
}

async function getAllPlatformTokens() {
    try {
        const allTokens = []

        // Read all token files from data folder
        const dataDir = path.join(__dirname, 'data')
        if (!fs.existsSync(dataDir)) {
            return []
        }

        const files = fs.readdirSync(dataDir)
        const tokenFiles = files.filter(file => file.startsWith('tokens-') && file.endsWith('.json'))

        for (const file of tokenFiles) {
            try {
                const filePath = path.join(dataDir, file)
                const fileContent = fs.readFileSync(filePath, 'utf8')
                const userTokens = JSON.parse(fileContent)

                // Extract user ID from filename (tokens-{userId}.json)
                const userId = file.replace('tokens-', '').replace('.json', '')

                // Process each token and enhance with real-time data
                for (const token of userTokens) {
                    if (!token.address || !token.chain) continue

                    try {
                        // Get real-time data from the VantablackDeployer contract
                        const enhancedToken = await enhanceTokenWithContractData(token, userId)
                        if (enhancedToken) {
                            allTokens.push(enhancedToken)
                        }
                    } catch (error) {
                        console.error(`Error enhancing token ${token.address}:`, error.message)
                        // Add token without enhancement if contract call fails
                        allTokens.push({
                            ...token,
                            creator: token.deployer || 'Unknown',
                            deployedAt: new Date().toISOString(), // Fallback date
                            roiAchieved: false,
                            lpOwner: 'Unknown',
                            userId
                        })
                    }
                }
            } catch (error) {
                console.error(`Error processing token file ${file}:`, error.message)
            }
        }

        return allTokens
    } catch (error) {
        console.error('Error reading platform tokens:', error)
        return []
    }
}

async function enhanceTokenWithContractData(token, userId) {
    try {
        // Find the chain configuration
        const chain = SUPPORTED_CHAINS.find(c => c.id === token.chain)
        if (!chain) return null

        const provider = new ethers.JsonRpcProvider(chain.rpc)
        const vantablackDeployer = new ethers.Contract(VANTABLACK_DEPLOYER_ADDRESS, VantablackDeployerAbi, provider)

        // Check if token is deployed by Vantablack
        const isVantablackToken = await vantablackDeployer.isTokenDeployedByVantablack(token.address)
        if (!isVantablackToken) {
            return {
                ...token,
                creator: token.deployer || 'Unknown',
                deployedAt: new Date().toISOString(),
                roiAchieved: false,
                lpOwner: 'Unknown',
                userId,
                lpManagementOption: token.lpManagementOption || 0
            }
        }

        // Get token details from VantablackDeployer
        const tokenId = await vantablackDeployer.deployedTokensIds(token.address)
        const deployedToken = await vantablackDeployer.deployedTokens(tokenId)
        console.log("Deployed Token Info:", {
            tokenAddress: deployedToken.tokenAddress,
            lpPair: deployedToken.lpPair,
            roiAchieved: deployedToken.roiAchieved,
            lpManagementOption: deployedToken.lpManagementOption,
            lpLockExpiry: deployedToken.lpLockExpiry?.toString()
        })

        // Get detailed tax and ROI information like buyTokenAndStats
        let detailedStats = {}

        try {
            // Get tax balance and ROI information
            const taxBalance = await vantablackDeployer.getProjectTaxBalance(token.address)
            const lpLockInfo = await vantablackDeployer.getLPLockInfo(token.address)
            console.log({
                lpLockInfo
            })

            const roiThreshold = ethers.parseEther("1.5") // 1.5 ETH threshold
            const roiAchievedCalculated = taxBalance >= roiThreshold
            const roiProgress = ((Number(ethers.formatEther(taxBalance)) / 1.5) * 100)

            // LP Management status
            const managementTexts = {
                0: "🔥 Burn LP",
                1: "🔒 Lock 1 Month (Unicrypt)",
                2: "🔐 Lock 6 Months (Unicrypt)",
                3: "⏱️ Lock 1 Minute (Testing)",
                4: "⏰ Lock 5 Minutes (Testing)"
            }

            // LP Lock status - check if handover executed first
            let lockStatus = "⏳ Not locked yet"

            // If handover executed (ROI achieved), LP should be managed according to the option
            if (deployedToken.roiAchieved) {
                if (deployedToken.lpManagementOption === 0) {
                    lockStatus = "🔥 LP Burned"
                } else {
                    // Query UniswapV2Locker directly using the LP pair address
                    try {
                        console.log("LP Pair Address:", deployedToken.lpPair)
                        console.log("UniswapV2Locker Address:", UNISWAP_V2_LOCKER_ADDRESS)

                        // Validate LP pair address
                        if (!deployedToken.lpPair || deployedToken.lpPair === ethers.ZeroAddress) {
                            throw new Error("Invalid LP pair address")
                        }

                        const UniswapV2LockerAbi = JSON.parse(await require('fs').promises.readFile('./resources/UniswapV2Locker8.json', 'utf8'))
                        const uniswapV2Locker = new ethers.Contract(UNISWAP_V2_LOCKER_ADDRESS, UniswapV2LockerAbi, provider)

                        // Get the lock owner (use lpOwner from deployedToken)
                        const lockOwner = deployedToken.lpOwner
                        console.log("Lock owner (lpOwner):", lockOwner)

                        // Get number of locks for this user and LP pair
                        const numUserLocks = await uniswapV2Locker.getUserNumLocksForToken(lockOwner, deployedToken.lpPair)
                        console.log("Number of user locks found:", numUserLocks.toString())

                        if (numUserLocks > 0) {
                            // Get the most recent lock (usually index 0)
                            const lockInfo = await uniswapV2Locker.getUserLockForTokenAtIndex(lockOwner, deployedToken.lpPair, 0)
                            console.log("Lock info:", lockInfo)

                            // lockInfo is an array: [lockDate, amount, initialAmount, unlockDate, lockID, owner]
                            const unlockDate = lockInfo[3] // unlockDate is at index 3
                            const amount = lockInfo[1] // amount is at index 1

                            console.log("Lock details:", {
                                unlockDate: unlockDate.toString(),
                                amount: amount.toString(),
                                currentTime: Math.floor(Date.now() / 1000)
                            })

                            if (amount > 0n) {
                                const now = BigInt(Math.floor(Date.now() / 1000))
                                const timeRemaining = unlockDate - now

                                console.log("Time remaining calculation:", {
                                    unlockDate: unlockDate.toString(),
                                    now: now.toString(),
                                    timeRemaining: timeRemaining.toString()
                                })

                                if (timeRemaining > 0n) {
                                    const hours = Number(timeRemaining) / 3600
                                    const minutes = (Number(timeRemaining) % 3600) / 60
                                    lockStatus = `🔒 Locked (${Math.floor(hours)}h ${Math.floor(minutes)}m remaining)`
                                    console.log("LP Status set to locked with time:", lockStatus)
                                } else {
                                    lockStatus = "🔓 Unlocked"
                                    console.log("LP Status set to unlocked")
                                }
                            } else {
                                lockStatus = "🔥 LP Burned"
                                console.log("LP Status set to burned, amount is 0")
                            }
                        } else {
                            // No locks found, check if LP was burned
                            lockStatus = deployedToken.lpManagementOption === 0 ? "🔥 LP Burned" : "🔄 Processing LP Lock..."
                        }
                    } catch (error) {
                        console.log("Error querying UniswapV2Locker directly:", error.message)
                        // Fallback to original logic
                        if (lpLockInfo.lockDuration > 0n && lpLockInfo.lpLockExpiry > 0n) {
                            const now = BigInt(Math.floor(Date.now() / 1000))
                            const timeRemaining = lpLockInfo.lpLockExpiry - now
                            if (timeRemaining > 0n) {
                                const hours = Number(timeRemaining) / 3600
                                const minutes = (Number(timeRemaining) % 3600) / 60
                                lockStatus = `🔒 Locked (${Math.floor(hours)}h ${Math.floor(minutes)}m remaining)`
                            } else {
                                lockStatus = "🔓 Unlocked"
                            }
                        } else {
                            lockStatus = "🔄 Processing LP Lock..."
                        }
                    }
                }
            }

            detailedStats = {
                taxCollected: Number(ethers.formatEther(taxBalance)),
                roiThreshold: 1.5,
                roiProgress: roiProgress,
                roiAchievedCalculated,
                lpManagementText: managementTexts[deployedToken.lpManagementOption] || 'Unknown',
                lockStatus,
                lpLockExpiry: lpLockInfo.lpLockExpiry
            }

        } catch (error) {
            console.log(`Unable to fetch detailed stats for token ${token.address}:`, error.message)
            detailedStats = {
                taxCollected: 0,
                roiThreshold: 1.5,
                roiProgress: 0,
                roiAchievedCalculated: false,
                lpManagementText: 'Unknown',
                lockStatus: 'Unknown'
            }
        }

        return {
            ...token,
            creator: deployedToken.dev || token.deployer || 'Unknown',
            deployedAt: new Date().toISOString(),
            roiAchieved: deployedToken.roiAchieved || false,
            lpOwner: deployedToken.lpOwner || 'Unknown',
            lpManagementOption: deployedToken.lpManagementOption || 0,
            userId,
            chainName: chain.name,
            chainSymbol: chain.symbol,
            ...detailedStats
        }
    } catch (error) {
        console.error(`Error enhancing token ${token.address}:`, error.message)
        return null
    }
}

function calculateFirstBuyEstimation(firstBuyAmount, tokenSupply, ethLP, tokenLP, buyTax) {
    if (!firstBuyAmount || !tokenSupply || !ethLP || !tokenLP) return null;

    // Calculate tax amount
    const taxAmount = firstBuyAmount * ((buyTax || 0) / 100);
    const ethAfterTax = firstBuyAmount - taxAmount;

    // Using simplified AMM formula: tokensOut = (tokenLP * ethAfterTax) / (ethLP + ethAfterTax)
    const tokensReceived = (tokenLP * ethAfterTax) / (ethLP + ethAfterTax);

    // Calculate price per token
    const pricePerToken = ethAfterTax / tokensReceived;

    return {
        tokensReceived: tokensReceived.toFixed(0),
        taxPaid: taxAmount.toFixed(4),
        pricePerToken: pricePerToken.toExponential(3),
        percentage: ((tokensReceived / tokenSupply) * 100).toFixed(2)
    };
}

function getFirstBuyEstimationText(token, isVantablack) {
    if (isVantablack) return '';

    const estimation = calculateFirstBuyEstimation(
        token.firstBuyAmount,
        1000000000, // Hardcoded 1B tokens
        token.isVantablackFunded ? 1 : token.ethLP, // 1 ETH if Vantablack funded
        1000000000, // Full supply always used for LP
        token.buyTax || 0
    );

    if (!estimation) return '';

    return `\n    📊 **You will receive:** ${Number(estimation.tokensReceived).toLocaleString()} tokens (${estimation.percentage}% of supply)\n\n    📈 **Price per token:** ${estimation.pricePerToken} POL`;
}

function getLPLockStatusText(token) {
    if (!token.lpManagementOption && token.lpManagementOption !== 0) return '';

    const managementText = getLPManagementText(token.lpManagementOption);

    if (token.lpManagementOption === 1 || token.lpManagementOption === 2) {
        return `\n📍 **Unicrypt V2** - Professional LP locking service`;
    } else if (token.lpManagementOption === 0) {
        return `\n🛡️ **Maximum Protection** - LP tokens permanently destroyed`;
    } else if (token.lpManagementOption === 3 || token.lpManagementOption === 4) {
        return `\n🧪 **Testing Mode** - Short duration locks for testing`;
    } else {
        return '';
    }
}

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))