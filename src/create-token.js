import {
  createV1,
  mplTokenMetadata,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata'
import {
  generateSigner,
  percentAmount,
  some,
} from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { keypairIdentity } from '@metaplex-foundation/umi'
import inquirer from 'inquirer'
import ora from 'ora'

import { CONFIG, getNetworkUrl } from '../config/config.js'
import { 
  log, 
  pinataUtils, 
  walletUtils, 
  tokenUtils, 
  validators, 
  displayUtils,
  fileUtils 
} from './utils.js'

export async function createToken() {
  try {
    log.title('🆕 CREATE NEW TOKEN')
    
    // Check if wallets exist
    const walletFiles = walletUtils.listWallets()
    if (walletFiles.length === 0) {
      log.error('No wallet files found!')
      log.info('Please add your wallet.json file to the ./wallets directory')
      log.info('Your wallet file should contain an array of 64 numbers (your private key)')
      return
    }

    // Select wallet
    const { walletFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'walletFile',
        message: 'Select wallet to use:',
        choices: walletFiles.map(file => ({
          name: file.split('/').pop(),
          value: file
        }))
      }
    ])

    // Select network
    const { network } = await inquirer.prompt([
      {
        type: 'list',
        name: 'network',
        message: 'Select network:',
        choices: [
          { name: 'Devnet (Recommended for testing)', value: 'DEVNET' },
          { name: 'Mainnet (Production - costs real SOL)', value: 'MAINNET' },
          { name: 'Testnet', value: 'TESTNET' }
        ],
        default: 'DEVNET'
      }
    ])

    if (network === 'MAINNET') {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: '⚠️  You selected MAINNET. This will cost real SOL. Continue?',
          default: false
        }
      ])
      
      if (!confirm) {
        log.info('Token creation cancelled')
        return
      }
    }

    // Get token configuration
    log.step('Please provide token details:')
    
    const tokenConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Token name:',
        validate: (input) => input.length > 0 ? true : 'Token name is required'
      },
      {
        type: 'input',
        name: 'symbol',
        message: 'Token symbol:',
        validate: (input) => {
          if (!input) return 'Token symbol is required'
          if (input.length > 10) return 'Symbol should be 10 characters or less'
          return true
        },
        transformer: (input) => input.toUpperCase()
      },
      {
        type: 'input',
        name: 'description',
        message: 'Token description:',
        validate: (input) => input.length > 0 ? true : 'Description is required'
      },
      {
        type: 'input',
        name: 'imageUrl',
        message: 'Image URL (IPFS or HTTPS):',
        default: 'https://ipfs.io/ipfs/bafkreia4mu5q7xpmajldouuuvv6kgiac6bxisy4ekg5hdijbscki5oloo4'
      },
      {
        type: 'input',
        name: 'externalUrl',
        message: 'Website URL (optional):',
        default: ''
      },
      {
        type: 'number',
        name: 'decimals',
        message: 'Number of decimals:',
        default: CONFIG.DEFAULTS.DECIMALS,
        validate: (input) => {
          if (input < 0 || input > 18) return 'Decimals must be between 0 and 18'
          return true
        }
      },
      {
        type: 'number',
        name: 'initialSupply',
        message: 'Initial supply (0 for no initial minting):',
        default: 0,
        validate: (input) => input >= 0 ? true : 'Supply must be 0 or greater'
      }
    ])

    // Validate configuration
    validators.validateTokenConfig(tokenConfig)

    // Show summary
    log.separator()
    log.title('📋 TOKEN CREATION SUMMARY')
    console.log('Name:', tokenConfig.name)
    console.log('Symbol:', tokenConfig.symbol)
    console.log('Description:', tokenConfig.description.substring(0, 50) + '...')
    console.log('Decimals:', tokenConfig.decimals)
    console.log('Initial Supply:', tokenConfig.initialSupply.toLocaleString())
    console.log('Network:', network)
    console.log('Wallet:', walletFile.split('/').pop())
    log.separator()

    const { confirmCreate } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmCreate',
        message: '🚀 Create this token?',
        default: true
      }
    ])

    if (!confirmCreate) {
      log.info('Token creation cancelled')
      return
    }

    // Start creation process
    const spinner = ora('Setting up Umi and wallet...').start()

    try {
      // Setup Umi
      const umi = createUmi(getNetworkUrl(network))
        .use(mplTokenMetadata())

      // Load wallet
      const walletData = walletUtils.loadWallet(walletFile)
      const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(walletData))
      umi.use(keypairIdentity(keypair))

      spinner.succeed('Umi and wallet setup complete')
      log.info(`Wallet address: ${keypair.publicKey.toString()}`)

      // Generate mint keypair
      const mint = generateSigner(umi)
      log.info(`Token mint address: ${mint.publicKey.toString()}`)

      // Create metadata
      spinner.start('Creating token metadata...')
      
      const tokenMetadata = {
        name: tokenConfig.name,
        symbol: tokenConfig.symbol,
        description: tokenConfig.description,
        image: tokenConfig.imageUrl,
        external_url: tokenConfig.externalUrl || undefined,
        attributes: [
          {
            trait_type: "Type",
            value: "Utility Token"
          },
          {
            trait_type: "Network",
            value: "Solana"
          },
          {
            trait_type: "Standard",
            value: "SPL Token"
          },
          {
            trait_type: "Decimals",
            value: tokenConfig.decimals.toString()
          }
        ],
        properties: {
          category: "fungible",
          creators: [
            {
              address: keypair.publicKey.toString(),
              share: 100
            }
          ]
        }
      }

      // Upload metadata to Pinata
      spinner.text = 'Uploading metadata to IPFS...'
      const metadataUri = await pinataUtils.uploadJson(
        tokenMetadata, 
        `${tokenConfig.symbol}-metadata`
      )
      spinner.succeed('Metadata uploaded to IPFS')

      // Create token
      spinner.start('Creating token on Solana...')
      
      const createTokenIx = createV1(umi, {
        mint: mint,
        authority: keypair,
        name: tokenConfig.name,
        symbol: tokenConfig.symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(CONFIG.DEFAULTS.SELLER_FEE_BASIS_POINTS),
        decimals: tokenConfig.decimals,
        tokenStandard: TokenStandard.Fungible,
        creators: some([
          {
            address: keypair.publicKey,
            verified: true,
            share: 100,
          },
        ]),
        collection: null,
        uses: null,
        isMutable: CONFIG.DEFAULTS.IS_MUTABLE,
        updateAuthority: keypair.publicKey,
        mintAuthority: keypair.publicKey,
        freezeAuthority: null,
      })

      const createTx = await createTokenIx.sendAndConfirm(umi, {
        send: { 
          skipPreflight: false,
          maxRetries: 3,
        },
        confirm: { 
          commitment: 'confirmed'
        }
      })

      const createSignature = Array.from(createTx.signature)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')

      spinner.succeed('Token created successfully!')

      // Save token information
      const tokenData = {
        name: tokenConfig.name,
        symbol: tokenConfig.symbol,
        mintAddress: mint.publicKey.toString(),
        metadataUri: metadataUri,
        imageUri: tokenConfig.imageUrl,
        externalUrl: tokenConfig.externalUrl,
        decimals: tokenConfig.decimals,
        initialSupply: tokenConfig.initialSupply,
        creator: keypair.publicKey.toString(),
        createTransaction: createSignature,
        network: network.toLowerCase(),
        walletFile: walletFile.split('/').pop()
      }

      const tokenInfoFile = tokenUtils.saveTokenInfo(tokenData)

      // Display results
      log.success('🎉 TOKEN CREATED SUCCESSFULLY!')
      displayUtils.displayTokenInfo(tokenData)
      displayUtils.displayExplorerLinks(mint.publicKey.toString(), 'address', network)

      // Provide next steps
      log.info('🎯 Next Steps:')
      log.info('1. Your token is created and ready! ✅')
      log.info('2. Use "Mint Tokens" from the main menu to mint supply')
      log.info('3. Check your token on the explorer links above')

      log.success(`Token information saved to: ${tokenInfoFile}`)

    } catch (error) {
      spinner.fail('Token creation failed')
      throw error
    }

  } catch (error) {
    log.error(`Token creation failed: ${error.message}`)
    
    // Provide helpful error messages
    if (error.message.includes('insufficient funds')) {
      log.info('💡 Solution: Add SOL to your wallet for transaction fees')
      if (network === 'DEVNET') {
        log.info('   Run: solana airdrop 2 --url devnet')
      }
    } else if (error.message.includes('Pinata')) {
      log.info('💡 Solution: Check Pinata configuration in config/config.js')
    } else if (error.message.includes('blockhash')) {
      log.info('💡 Solution: Network congestion, try again in a few seconds')
    }
    
    throw error
  }
}