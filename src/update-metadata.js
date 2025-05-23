import {
  updateV1,
  mplTokenMetadata,
  findMetadataPda,
  fetchMetadataFromSeeds,
} from '@metaplex-foundation/mpl-token-metadata'
import {
  publicKey,
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

export async function updateMetadata() {
  try {
    log.title('📝 UPDATE TOKEN METADATA')

    // Check if wallets exist
    const walletFiles = walletUtils.listWallets()
    if (walletFiles.length === 0) {
      log.error('No wallet files found!')
      log.info('Please add your wallet.json file to the ./wallets directory')
      return
    }

    // Option to use existing token or enter new address
    const { tokenSource } = await inquirer.prompt([
      {
        type: 'list',
        name: 'tokenSource',
        message: 'How would you like to specify the token?',
        choices: [
          { name: '📋 Select from created tokens', value: 'created' },
          { name: '✏️  Enter token address manually', value: 'manual' }
        ]
      }
    ])

    let tokenAddress, tokenInfo = null

    if (tokenSource === 'created') {
      // Select from created tokens
      const tokenFiles = tokenUtils.listTokens()
      
      if (tokenFiles.length === 0) {
        log.error('No tokens found!')
        log.info('Create a token first or use manual address entry')
        return
      }

      const tokenChoices = tokenFiles.map(file => {
        try {
          const data = fileUtils.loadJson(file)
          return {
            name: `${data.name} (${data.symbol}) - ${data.mintAddress}`,
            value: { address: data.mintAddress, info: data }
          }
        } catch (error) {
          return {
            name: `Error loading ${file}`,
            value: null
          }
        }
      }).filter(choice => choice.value !== null)

      const { selectedToken } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedToken',
          message: 'Select token to update:',
          choices: tokenChoices
        }
      ])

      tokenAddress = selectedToken.address
      tokenInfo = selectedToken.info

    } else {
      // Manual address entry
      const { address } = await inquirer.prompt([
        {
          type: 'input',
          name: 'address',
          message: 'Enter token mint address:',
          validate: (input) => {
            if (!validators.validateAddress(input)) {
              return 'Please enter a valid Solana address'
            }
            return true
          }
        }
      ])
      
      tokenAddress = address
    }

    // Select wallet (must be update authority)
    const { walletFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'walletFile',
        message: 'Select wallet to use (must be update authority):',
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
          { name: 'Devnet', value: 'DEVNET' },
          { name: 'Mainnet', value: 'MAINNET' },
          { name: 'Testnet', value: 'TESTNET' }
        ],
        default: tokenInfo?.network?.toUpperCase() || 'DEVNET'
      }
    ])

    // Setup Umi and fetch current metadata
    const spinner = ora('Fetching current metadata...').start()

    try {
      const umi = createUmi(getNetworkUrl(network))
        .use(mplTokenMetadata())

      // Load wallet
      const walletData = walletUtils.loadWallet(walletFile)
      const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(walletData))
      umi.use(keypairIdentity(keypair))

      const mintAddress = publicKey(tokenAddress)
      
      // Fetch current metadata
      const currentMetadata = await fetchMetadataFromSeeds(umi, { mint: mintAddress })
      
      spinner.succeed('Current metadata fetched')

      // Display current metadata
      log.separator()
      log.title('📋 CURRENT METADATA')
      console.log('Name:', currentMetadata.name)
      console.log('Symbol:', currentMetadata.symbol)
      console.log('URI:', currentMetadata.uri)
      console.log('Update Authority:', currentMetadata.updateAuthority.toString())
      console.log('Is Mutable:', currentMetadata.isMutable)
      log.separator()

      // Check if user is update authority
      const isUpdateAuthority = currentMetadata.updateAuthority.toString() === keypair.publicKey.toString()
      
      if (!isUpdateAuthority) {
        log.error('❌ You are not the update authority for this token!')
        log.info(`Update authority: ${currentMetadata.updateAuthority.toString()}`)
        log.info(`Your wallet: ${keypair.publicKey.toString()}`)
        return
      }

      if (!currentMetadata.isMutable) {
        log.error('❌ This token metadata is immutable and cannot be updated!')
        return
      }

      log.success('✅ You are authorized to update this token metadata')

      // Get what to update
      const { fieldsToUpdate } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'fieldsToUpdate',
          message: 'What would you like to update?',
          choices: [
            { name: 'Token Name', value: 'name' },
            { name: 'Token Symbol', value: 'symbol' },
            { name: 'Description', value: 'description' },
            { name: 'Image URL', value: 'image' },
            { name: 'External URL', value: 'externalUrl' }
          ],
          validate: (input) => input.length > 0 ? true : 'Please select at least one field to update'
        }
      ])

      // Get new values
      const updates = {}
      
      if (fieldsToUpdate.includes('name')) {
        const { name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'New token name:',
            default: currentMetadata.name,
            validate: (input) => input.length > 0 ? true : 'Token name is required'
          }
        ])
        updates.name = name
      }

      if (fieldsToUpdate.includes('symbol')) {
        const { symbol } = await inquirer.prompt([
          {
            type: 'input',
            name: 'symbol',
            message: 'New token symbol:',
            default: currentMetadata.symbol,
            validate: (input) => {
              if (!input) return 'Token symbol is required'
              if (input.length > 10) return 'Symbol should be 10 characters or less'
              return true
            },
            transformer: (input) => input.toUpperCase()
          }
        ])
        updates.symbol = symbol
      }

      if (fieldsToUpdate.includes('description')) {
        const { description } = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'New description:',
            default: tokenInfo?.description || '',
            validate: (input) => input.length > 0 ? true : 'Description is required'
          }
        ])
        updates.description = description
      }

      if (fieldsToUpdate.includes('image')) {
        const { image } = await inquirer.prompt([
          {
            type: 'input',
            name: 'image',
            message: 'New image URL:',
            default: tokenInfo?.imageUri || 'https://ipfs.io/ipfs/bafkreia4mu5q7xpmajldouuuvv6kgiac6bxisy4ekg5hdijbscki5oloo4'
          }
        ])
        updates.image = image
      }

      if (fieldsToUpdate.includes('externalUrl')) {
        const { externalUrl } = await inquirer.prompt([
          {
            type: 'input',
            name: 'externalUrl',
            message: 'New external URL:',
            default: tokenInfo?.externalUrl || ''
          }
        ])
        updates.externalUrl = externalUrl
      }

      // Create updated metadata
      const updatedMetadata = {
        name: updates.name || currentMetadata.name,
        symbol: updates.symbol || currentMetadata.symbol,
        description: updates.description || tokenInfo?.description || 'Updated token metadata',
        image: updates.image || tokenInfo?.imageUri || 'https://ipfs.io/ipfs/bafkreia4mu5q7xpmajldouuuvv6kgiac6bxisy4ekg5hdijbscki5oloo4',
        external_url: updates.externalUrl || tokenInfo?.externalUrl || undefined,
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
            trait_type: "Last Updated",
            value: new Date().toISOString().split('T')[0]
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

      // Show preview of changes
      log.separator()
      log.title('📋 PREVIEW OF CHANGES')
      
      if (updates.name) {
        console.log('Name:', currentMetadata.name, '→', updates.name)
      }
      if (updates.symbol) {
        console.log('Symbol:', currentMetadata.symbol, '→', updates.symbol)
      }
      if (updates.description) {
        console.log('Description: [Updated]')
      }
      if (updates.image) {
        console.log('Image: [Updated]')
      }
      if (updates.externalUrl) {
        console.log('External URL: [Updated]')
      }
      
      log.separator()

      const { confirmUpdate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmUpdate',
          message: '📝 Proceed with metadata update?',
          default: true
        }
      ])

      if (!confirmUpdate) {
        log.info('Metadata update cancelled')
        return
      }

      // Upload new metadata to Pinata
      spinner.start('Uploading updated metadata to IPFS...')
      const metadataUri = await pinataUtils.uploadJson(
        updatedMetadata, 
        `${updatedMetadata.symbol}-updated-metadata`
      )
      spinner.succeed('Updated metadata uploaded to IPFS')

      // Update on-chain metadata
      spinner.start('Updating on-chain metadata...')
      
      const updateIx = updateV1(umi, {
        mint: mintAddress,
        authority: keypair,
        data: some({
          name: updatedMetadata.name,
          symbol: updatedMetadata.symbol,
          uri: metadataUri,
          sellerFeeBasisPoints: currentMetadata.sellerFeeBasisPoints,
          creators: currentMetadata.creators,
          collection: currentMetadata.collection,
          uses: currentMetadata.uses,
        }),
        discriminator: currentMetadata.discriminator,
        isMutable: some(true),
        newUpdateAuthority: some(keypair.publicKey),
        primarySaleHappened: currentMetadata.primarySaleHappened,
      })

      const tx = await updateIx.sendAndConfirm(umi, {
        send: { 
          skipPreflight: false,
          maxRetries: 3,
        },
        confirm: { 
          commitment: 'confirmed'
        }
      })

      const signature = Array.from(tx.signature)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')

      spinner.succeed('Metadata updated successfully!')

      // Update token info file if we have it
      if (tokenInfo) {
        try {
          const tokenFiles = tokenUtils.listTokens()
          const tokenFile = tokenFiles.find(file => {
            try {
              const data = fileUtils.loadJson(file)
              return data.mintAddress === tokenAddress
            } catch {
              return false
            }
          })

          if (tokenFile) {
            const updatedInfo = {
              ...tokenInfo,
              ...updates,
              metadataUri: metadataUri,
              lastUpdateTransaction: signature,
              lastUpdateDate: new Date().toISOString()
            }
            
            fileUtils.saveJson(tokenFile, updatedInfo)
            log.success('Token info file updated')
          }
        } catch (error) {
          log.warning('Could not update token info file')
        }
      }

      // Show results
      log.success('🎉 METADATA UPDATED SUCCESSFULLY!')
      log.separator()
      console.log('Token Address:', tokenAddress)
      console.log('New Metadata URI:', metadataUri)
      console.log('Transaction Signature:', signature)
      console.log('Network:', network)
      log.separator()

      // Display explorer links
      displayUtils.displayExplorerLinks(signature, 'tx', network)
      displayUtils.displayExplorerLinks(tokenAddress, 'address', network)

    } catch (error) {
      spinner.fail('Metadata update failed')
      throw error
    }

  } catch (error) {
    log.error(`Metadata update failed: ${error.message}`)
    
    // Provide helpful error messages
    if (error.message.includes('insufficient funds')) {
      log.info('💡 Solution: Add SOL to your wallet for transaction fees')
    } else if (error.message.includes('unauthorized')) {
      log.info('💡 Solution: Make sure you\'re using the update authority wallet')
    } else if (error.message.includes('account not found')) {
      log.info('💡 Solution: Check if the token and metadata exist on the selected network')
    } else if (error.message.includes('Pinata')) {
      log.info('💡 Solution: Check Pinata configuration in config/config.js')
    }
    
    throw error
  }
}