import {
  mplTokenMetadata,
  findMetadataPda,
  fetchMetadataFromSeeds,
} from '@metaplex-foundation/mpl-token-metadata'
import {
  publicKey,
} from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import inquirer from 'inquirer'
import ora from 'ora'
import chalk from 'chalk'
import fetch from 'node-fetch'

import { CONFIG, getNetworkUrl } from '../config/config.js'
import { 
  log, 
  tokenUtils, 
  validators, 
  displayUtils,
  fileUtils 
} from './utils.js'

export async function checkToken() {
  try {
    log.title('🔍 CHECK TOKEN INFORMATION')

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
          message: 'Select token to check:',
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

    // Fetch token information
    const spinner = ora('Fetching token information...').start()

    try {
      const umi = createUmi(getNetworkUrl(network))
        .use(mplTokenMetadata())

      const mintAddress = publicKey(tokenAddress)
      
      // Check if mint account exists
      spinner.text = 'Checking mint account...'
      const mintAccount = await umi.rpc.getAccount(mintAddress)
      
      if (!mintAccount.exists) {
        spinner.fail('Token mint account not found')
        log.error('The specified token address does not exist on this network')
        return
      }

      spinner.text = 'Fetching mint account data...'
      
      // Parse mint account data (basic info)
      const mintData = mintAccount.data
      let mintInfo = null
      
      try {
        // Basic mint account parsing (simplified)
        if (mintData.length >= 82) {
          const supply = new DataView(mintData.buffer, mintData.byteOffset + 36, 8)
          const decimals = mintData[44]
          const isInitialized = mintData[45] === 1
          
          mintInfo = {
            supply: supply.getBigUint64(0, true),
            decimals: decimals,
            isInitialized: isInitialized
          }
        }
      } catch (error) {
        log.warning('Could not parse mint account data details')
      }

      spinner.text = 'Fetching metadata...'
      
      // Try to fetch metadata
      let metadata = null
      let metadataExists = false
      
      try {
        metadata = await fetchMetadataFromSeeds(umi, { mint: mintAddress })
        metadataExists = true
        spinner.succeed('Token information fetched successfully')
      } catch (error) {
        spinner.warn('Token exists but has no metadata')
        metadataExists = false
      }

      // Display results
      log.separator()
      log.title('🪙 TOKEN INFORMATION')
      
      console.log(chalk.cyan('Token Address:'), chalk.yellow(tokenAddress))
      console.log(chalk.cyan('Network:'), chalk.white(network))
      console.log(chalk.cyan('Mint Account:'), chalk.green('✅ Exists'))
      
      if (mintInfo) {
        console.log(chalk.cyan('Supply:'), chalk.white(mintInfo.supply.toString()))
        console.log(chalk.cyan('Decimals:'), chalk.white(mintInfo.decimals))
        console.log(chalk.cyan('Initialized:'), mintInfo.isInitialized ? chalk.green('✅ Yes') : chalk.red('❌ No'))
      }

      if (metadataExists && metadata) {
        log.separator()
        log.title('📋 METADATA INFORMATION')
        
        console.log(chalk.cyan('Name:'), chalk.white(metadata.name))
        console.log(chalk.cyan('Symbol:'), chalk.white(metadata.symbol))
        console.log(chalk.cyan('URI:'), chalk.blue(metadata.uri))
        console.log(chalk.cyan('Update Authority:'), chalk.yellow(metadata.updateAuthority.toString()))
        console.log(chalk.cyan('Mint Authority:'), chalk.yellow('Check via CLI'))
        console.log(chalk.cyan('Is Mutable:'), metadata.isMutable ? chalk.green('✅ Yes') : chalk.red('❌ No'))
        console.log(chalk.cyan('Primary Sale:'), metadata.primarySaleHappened ? chalk.green('✅ Yes') : chalk.yellow('❌ No'))
        console.log(chalk.cyan('Seller Fee:'), chalk.white(`${metadata.sellerFeeBasisPoints / 100}%`))
        console.log(chalk.cyan('Token Standard:'), chalk.white(metadata.tokenStandard || 'Unknown'))
        
        if (metadata.creators && metadata.creators.length > 0) {
          console.log(chalk.cyan('Creators:'))
          metadata.creators.forEach((creator, index) => {
            console.log(chalk.gray(`  ${index + 1}. ${creator.address} (${creator.share}%) ${creator.verified ? '✅' : '❌'}`))
          })
        }

        // Try to fetch off-chain metadata
        if (metadata.uri) {
          spinner.start('Fetching off-chain metadata...')
          try {
            const response = await fetch(metadata.uri)
            if (response.ok) {
              const offChainData = await response.json()
              spinner.succeed('Off-chain metadata fetched')
              
              log.separator()
              log.title('🌐 OFF-CHAIN METADATA')
              
              if (offChainData.description) {
                console.log(chalk.cyan('Description:'), chalk.white(offChainData.description.substring(0, 100) + '...'))
              }
              if (offChainData.image) {
                console.log(chalk.cyan('Image:'), chalk.blue(offChainData.image))
              }
              if (offChainData.external_url) {
                console.log(chalk.cyan('External URL:'), chalk.blue(offChainData.external_url))
              }
              if (offChainData.attributes && offChainData.attributes.length > 0) {
                console.log(chalk.cyan('Attributes:'))
                offChainData.attributes.forEach(attr => {
                  console.log(chalk.gray(`  ${attr.trait_type}: ${attr.value}`))
                })
              }
            } else {
              spinner.warn('Could not fetch off-chain metadata')
            }
          } catch (error) {
            spinner.warn('Could not fetch off-chain metadata')
          }
        }
      } else {
        log.separator()
        log.title('📋 METADATA INFORMATION')
        console.log(chalk.red('❌ No metadata found for this token'))
        console.log(chalk.gray('This token was created without Metaplex metadata'))
      }

      // Show local token info if available
      if (tokenInfo) {
        log.separator()
        log.title('💾 LOCAL TOKEN INFO')
        
        console.log(chalk.cyan('Created:'), chalk.white(new Date(tokenInfo.createdAt).toLocaleString()))
        console.log(chalk.cyan('Tool Version:'), chalk.white(tokenInfo.toolVersion || 'Unknown'))
        console.log(chalk.cyan('Wallet Used:'), chalk.white(tokenInfo.walletFile || 'Unknown'))
        
        if (tokenInfo.createTransaction) {
          console.log(chalk.cyan('Create Tx:'), chalk.green(tokenInfo.createTransaction))
        }
        
        if (tokenInfo.lastUpdateDate) {
          console.log(chalk.cyan('Last Updated:'), chalk.white(new Date(tokenInfo.lastUpdateDate).toLocaleString()))
        }
        
        if (tokenInfo.totalMinted) {
          console.log(chalk.cyan('Total Minted:'), chalk.white(tokenInfo.totalMinted.toLocaleString()))
        }
      }

      // Display explorer links
      log.separator()
      displayUtils.displayExplorerLinks(tokenAddress, 'address', network)

      // Show additional actions
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do next?',
          choices: [
            { name: '🔙 Back to main menu', value: 'back' },
            { name: '🪙 Mint tokens', value: 'mint' },
            { name: '📝 Update metadata', value: 'update' },
            { name: '🔗 Open in browser', value: 'browser' }
          ]
        }
      ])

      if (action === 'mint') {
        log.info('Redirecting to mint tokens...')
        // This would call the mint function
      } else if (action === 'update') {
        log.info('Redirecting to update metadata...')
        // This would call the update function
      } else if (action === 'browser') {
        const urls = tokenUtils.getExplorerUrls(tokenAddress, 'address', network)
        log.info('Explorer URLs:')
        console.log('Solana Explorer:', urls.solana)
        console.log('SolScan:', urls.solscan)
      }

    } catch (error) {
      spinner.fail('Failed to fetch token information')
      throw error
    }

  } catch (error) {
    log.error(`Token check failed: ${error.message}`)
    
    // Provide helpful error messages
    if (error.message.includes('account not found')) {
      log.info('💡 The token address does not exist on the selected network')
      log.info('   - Check the address is correct')
      log.info('   - Make sure you\'re on the right network')
    } else if (error.message.includes('Invalid address')) {
      log.info('💡 Please enter a valid Solana address (32-44 characters)')
    } else if (error.message.includes('network')) {
      log.info('💡 Network connection issue - try again in a moment')
    }
    
    throw error
  }
}