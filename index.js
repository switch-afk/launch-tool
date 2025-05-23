#!/usr/bin/env node

import inquirer from 'inquirer'
import chalk from 'chalk'
import figlet from 'figlet'
import { log, fileUtils } from './src/utils.js'
import { CONFIG } from './config/config.js'

// Import our modules
import { createToken } from './src/create-token.js'
import { mintTokens } from './src/mint-tokens.js'
import { updateMetadata } from './src/update-metadata.js'
import { checkToken } from './src/check-token.js'
import { revokeAuthorities } from './src/revoke-authorities.js'

// Display welcome banner
function displayBanner() {
  console.clear()
  console.log(
    chalk.cyan(
      figlet.textSync('SOLANA TOKEN', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default'
      })
    )
  )
  console.log(
    chalk.cyan(
      figlet.textSync('LAUNCHER', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default'
      })
    )
  )
  
  console.log(chalk.yellow('\n🚀 Professional SPL Token Creation Tool'))
  console.log(chalk.gray('Version 1.0.0 | Built with Metaplex & Umi\n'))
}

// Main menu options
const MENU_OPTIONS = [
  {
    name: '🆕 Create New Token',
    value: 'create'
  },
  {
    name: '🪙 Mint Tokens',
    value: 'mint'
  },
  {
    name: '🔒 Revoke Authorities',
    value: 'revoke'
  },
  {
    name: '📝 Update Token Metadata',
    value: 'update'
  },
  {
    name: '🔍 Check Token Info',
    value: 'check'
  },
  {
    name: '⚙️  Settings',
    value: 'settings'
  },
  {
    name: '📋 View Created Tokens',
    value: 'list'
  },
  {
    name: '❓ Help',
    value: 'help'
  },
  {
    name: '🚪 Exit',
    value: 'exit'
  }
]

// Display help information
function displayHelp() {
  log.title('📖 SOLANA TOKEN LAUNCHER HELP')
  
  console.log(chalk.cyan('\n🆕 Create New Token:'))
  console.log('   Create a new SPL token with metadata on Solana')
  console.log('   Includes automatic IPFS upload via Pinata')
  
  console.log(chalk.cyan('\n🪙 Mint Tokens:'))
  console.log('   Mint tokens to your wallet or specified address')
  console.log('   Supports both CLI and programmatic minting')
  
  console.log(chalk.cyan('\n🔒 Revoke Authorities:'))
  console.log('   Permanently revoke mint or freeze authorities')
  console.log('   Makes your token more decentralized (IRREVERSIBLE!)')
  
  console.log(chalk.cyan('\n📝 Update Token Metadata:'))
  console.log('   Update existing token metadata')
  console.log('   Requires update authority')
  
  console.log(chalk.cyan('\n🔍 Check Token Info:'))
  console.log('   View detailed information about any token')
  console.log('   Shows metadata, supply, authorities, etc.')
  
  console.log(chalk.cyan('\n⚙️  Settings:'))
  console.log('   Configure network, Pinata settings, defaults')
  
  console.log(chalk.cyan('\n📁 File Structure:'))
  console.log('   ./wallets/     - Store your wallet files here')
  console.log('   ./tokens/      - Created token info saved here')
  console.log('   ./config/      - Configuration files')
  
  console.log(chalk.cyan('\n🔗 Networks Supported:'))
  console.log('   • Devnet (default)')
  console.log('   • Mainnet-beta')
  console.log('   • Testnet')
  
  console.log(chalk.yellow('\n💡 Tips:'))
  console.log('   • Always test on devnet first')
  console.log('   • Keep your wallet files secure')
  console.log('   • Save token info files for reference')
  console.log('   • Check explorer links after transactions')
}

// Display settings menu
async function displaySettings() {
  log.title('⚙️  CURRENT SETTINGS')
  
  console.log(chalk.cyan('Network:'), chalk.white(CONFIG.DEFAULT_NETWORK))
  console.log(chalk.cyan('RPC URL:'), chalk.white(CONFIG.NETWORK[CONFIG.DEFAULT_NETWORK]))
  console.log(chalk.cyan('Default Decimals:'), chalk.white(CONFIG.DEFAULTS.DECIMALS))
  console.log(chalk.cyan('Default Supply:'), chalk.white(CONFIG.DEFAULTS.INITIAL_SUPPLY.toLocaleString()))
  console.log(chalk.cyan('Pinata Configured:'), chalk.white(CONFIG.PINATA.JWT ? 'Yes' : 'No'))
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🔙 Back to Main Menu', value: 'back' },
        { name: '🌐 Change Network', value: 'network' },
        { name: '📝 Edit Config File', value: 'edit' }
      ]
    }
  ])
  
  if (action === 'network') {
    const { network } = await inquirer.prompt([
      {
        type: 'list',
        name: 'network',
        message: 'Select network:',
        choices: [
          { name: 'Devnet (Recommended for testing)', value: 'DEVNET' },
          { name: 'Mainnet (Production)', value: 'MAINNET' },
          { name: 'Testnet', value: 'TESTNET' }
        ]
      }
    ])
    
    log.warning(`Network change requires editing config/config.js manually`)
    log.info(`Change DEFAULT_NETWORK to "${network}"`)
  }
}

// List created tokens
function listCreatedTokens() {
  log.title('📋 CREATED TOKENS')
  
  const tokenFiles = fileUtils.listFiles(CONFIG.PATHS.TOKENS, '.json')
  
  if (tokenFiles.length === 0) {
    log.warning('No tokens created yet')
    return
  }
  
  tokenFiles.forEach((file, index) => {
    try {
      const tokenData = fileUtils.loadJson(file)
      console.log(chalk.cyan(`${index + 1}.`), chalk.white(tokenData.name), 
                  chalk.gray(`(${tokenData.symbol})`), 
                  chalk.yellow(tokenData.mintAddress))
    } catch (error) {
      log.error(`Error reading ${file}: ${error.message}`)
    }
  })
}

// Initialize required directories
function initializeDirectories() {
  fileUtils.ensureDir(CONFIG.PATHS.WALLETS)
  fileUtils.ensureDir(CONFIG.PATHS.TOKENS)
  fileUtils.ensureDir(CONFIG.PATHS.CONFIG)
}

// Main menu loop
async function mainMenu() {
  while (true) {
    try {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: MENU_OPTIONS,
          pageSize: 10
        }
      ])
      
      switch (action) {
        case 'create':
          await createToken()
          break
          
        case 'mint':
          await mintTokens()
          break
          
        case 'revoke':
          await revokeAuthorities()
          break
          
        case 'update':
          await updateMetadata()
          break
          
        case 'check':
          await checkToken()
          break
          
        case 'settings':
          await displaySettings()
          break
          
        case 'list':
          listCreatedTokens()
          break
          
        case 'help':
          displayHelp()
          break
          
        case 'exit':
          console.log(chalk.green('\n👋 Thank you for using Solana Token Launcher!'))
          console.log(chalk.gray('Visit https://solana.com for more resources\n'))
          process.exit(0)
          break
          
        default:
          log.error('Invalid option selected')
      }
      
      // Wait for user to continue
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...'
        }
      ])
      
    } catch (error) {
      log.error(`An error occurred: ${error.message}`)
      
      const { retry } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'retry',
          message: 'Would you like to try again?',
          default: true
        }
      ])
      
      if (!retry) {
        break
      }
    }
  }
}

// Main function
async function main() {
  try {
    displayBanner()
    initializeDirectories()
    
    log.success('Solana Token Launcher initialized!')
    log.info(`Network: ${CONFIG.DEFAULT_NETWORK}`)
    log.info(`Wallets directory: ${CONFIG.PATHS.WALLETS}`)
    log.info(`Tokens directory: ${CONFIG.PATHS.TOKENS}`)
    
    await mainMenu()
    
  } catch (error) {
    log.error(`Failed to start application: ${error.message}`)
    process.exit(1)
  }
}

// Run the application
main()