import { exec } from 'child_process'
import { promisify } from 'util'
import inquirer from 'inquirer'
import ora from 'ora'
import path from 'path'

import { CONFIG } from '../config/config.js'
import { 
  log, 
  walletUtils, 
  tokenUtils, 
  validators, 
  displayUtils,
  fileUtils 
} from './utils.js'

const execAsync = promisify(exec)

export async function mintTokens() {
  try {
    log.title('🪙 MINT TOKENS')

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
          message: 'Select token to mint:',
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

    // Select wallet
    const { walletFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'walletFile',
        message: 'Select wallet to use (must be mint authority):',
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
          { name: 'Devnet', value: 'devnet' },
          { name: 'Mainnet', value: 'mainnet-beta' },
          { name: 'Testnet', value: 'testnet' }
        ],
        default: tokenInfo?.network || 'devnet'
      }
    ])

    // Get mint amount
    const { amount } = await inquirer.prompt([
      {
        type: 'number',
        name: 'amount',
        message: 'How many tokens to mint?',
        validate: (input) => {
          if (input <= 0) return 'Amount must be greater than 0'
          return true
        }
      }
    ])

    // Get recipient (optional)
    const { useRecipient } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useRecipient',
        message: 'Mint to a different address? (default: your wallet)',
        default: false
      }
    ])

    let recipient = null
    if (useRecipient) {
      const { recipientAddress } = await inquirer.prompt([
        {
          type: 'input',
          name: 'recipientAddress',
          message: 'Enter recipient address:',
          validate: (input) => {
            if (!validators.validateAddress(input)) {
              return 'Please enter a valid Solana address'
            }
            return true
          }
        }
      ])
      recipient = recipientAddress
    }

    // Show summary
    log.separator()
    log.title('📋 MINTING SUMMARY')
    console.log('Token Address:', tokenAddress)
    if (tokenInfo) {
      console.log('Token Name:', `${tokenInfo.name} (${tokenInfo.symbol})`)
    }
    console.log('Amount:', amount.toLocaleString())
    console.log('Network:', network)
    console.log('Mint Authority:', walletFile.split('/').pop())
    if (recipient) {
      console.log('Recipient:', recipient)
    }
    log.separator()

    const { confirmMint } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmMint',
        message: '🪙 Proceed with minting?',
        default: true
      }
    ])

    if (!confirmMint) {
      log.info('Minting cancelled')
      return
    }

    // Start minting process
    const spinner = ora('Setting up Solana configuration...').start()

    try {
      // Get absolute path to wallet file
      const absoluteWalletPath = path.resolve(walletFile)
      
      // Set up Solana config with the wallet
      spinner.text = 'Configuring Solana CLI with wallet...'
      
      const configSetCmd = `solana config set --keypair ${absoluteWalletPath} --url ${network}`
      log.info(`Setting config: ${configSetCmd}`)
      
      const { stdout: configStdout, stderr: configStderr } = await execAsync(configSetCmd)
      
      if (configStderr) {
        log.warning(`Config warning: ${configStderr}`)
      }
      
      if (configStdout) {
        log.info(`Config set: ${configStdout.trim()}`)
      }
      
      spinner.succeed('Solana CLI configured successfully')

      // Verify configuration
      spinner.start('Verifying configuration...')
      
      const { stdout: verifyStdout } = await execAsync('solana config get')
      log.info(`Current config:\n${verifyStdout}`)
      
      spinner.succeed('Configuration verified')

      // Create associated token account if needed
      spinner.start('Creating associated token account (if needed)...')
      
      let createAtaCmd = `spl-token create-account ${tokenAddress} --url ${network}`
      if (recipient) {
        createAtaCmd += ` --owner ${recipient}`
      }

      try {
        const { stdout: createStdout, stderr: createStderr } = await execAsync(createAtaCmd)
        
        if (createStderr && !createStderr.includes('Error: Account already exists')) {
          spinner.warn(`ATA creation output: ${createStderr}`)
        } else {
          spinner.succeed('Associated token account ready')
        }
      } catch (createError) {
        if (createError.message.includes('Account already exists')) {
          spinner.succeed('Associated token account already exists')
        } else {
          spinner.warn(`ATA creation issue (continuing): ${createError.message}`)
        }
      }

      // Mint tokens
      spinner.start('Minting tokens...')
      
      let mintCmd = `spl-token mint ${tokenAddress} ${amount} --url ${network}`
      if (recipient) {
        mintCmd += ` ${recipient}`
      }

      log.info(`Executing: ${mintCmd}`)
      
      const { stdout, stderr } = await execAsync(mintCmd)
      
      if (stderr && !stderr.includes('Signature:')) {
        spinner.warn(`Command output: ${stderr}`)
      }
      
      if (stdout) {
        spinner.succeed('Tokens minted successfully!')
        log.info(`Output: ${stdout}`)
        
        // Extract transaction signature from output if present
        const signatureMatch = stdout.match(/Signature: ([A-Za-z0-9]+)/i)
        if (signatureMatch) {
          const signature = signatureMatch[1]
          log.success(`Transaction signature: ${signature}`)
        }
      }

      // Check balance
      spinner.start('Checking token balance...')
      
      try {
        let balanceCmd = `spl-token balance ${tokenAddress} --url ${network}`
        if (recipient) {
          balanceCmd += ` --owner ${recipient}`
        }
        
        const { stdout: balanceStdout } = await execAsync(balanceCmd)
        spinner.succeed(`Current token balance: ${balanceStdout.trim()}`)
      } catch (balanceError) {
        spinner.warn(`Could not check balance: ${balanceError.message}`)
      }

      // Show results
      log.success('🎉 TOKENS MINTED SUCCESSFULLY!')
      log.separator()
      console.log('Token Address:', tokenAddress)
      console.log('Amount Minted:', amount.toLocaleString())
      console.log('Network:', network.toUpperCase())
      if (recipient) {
        console.log('Recipient:', recipient)
      }
      log.separator()

      // Display explorer links
      displayUtils.displayExplorerLinks(tokenAddress, 'address', network.toUpperCase())

      // Update token info if we have it
      if (tokenInfo) {
        try {
          // Find and update the token info file
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
              lastMintAmount: amount,
              lastMintDate: new Date().toISOString(),
              totalMinted: (tokenInfo.totalMinted || 0) + amount
            }
            
            fileUtils.saveJson(tokenFile, updatedInfo)
            log.info('Token info updated with minting details')
          }
        } catch (error) {
          log.warning('Could not update token info file')
        }
      }

      // Show additional actions
      const { nextAction } = await inquirer.prompt([
        {
          type: 'list',
          name: 'nextAction',
          message: 'What would you like to do next?',
          choices: [
            { name: '🔙 Back to main menu', value: 'back' },
            { name: '🪙 Mint more tokens', value: 'mint-more' },
            { name: '🔍 Check token info', value: 'check' },
            { name: '🔗 View on explorer', value: 'explorer' }
          ]
        }
      ])

      if (nextAction === 'mint-more') {
        log.info('Starting another minting session...')
        await mintTokens() // Recursive call for another mint
      } else if (nextAction === 'explorer') {
        const urls = tokenUtils.getExplorerUrls(tokenAddress, 'address', network.toUpperCase())
        log.info('🔗 Explorer URLs:')
        console.log('Solana Explorer:', urls.solana)
        console.log('SolScan:', urls.solscan)
      }

    } catch (error) {
      spinner.fail('Token minting failed')
      throw error
    }

  } catch (error) {
    log.error(`Token minting failed: ${error.message}`)
    
    // Provide helpful error messages
    if (error.message.includes('insufficient funds')) {
      log.info('💡 Solution: Add SOL to your wallet for transaction fees')
      log.info('   For devnet: solana airdrop 2 --url devnet')
    } else if (error.message.includes('not found')) {
      log.info('💡 Solution: Make sure Solana CLI tools are installed')
      log.info('   Install from: https://docs.solana.com/cli/install-solana-cli-tools')
    } else if (error.message.includes('authority')) {
      log.info('💡 Solution: Make sure you\'re using the mint authority wallet')
      log.info('   The wallet must be the same one used to create the token')
    } else if (error.message.includes('Invalid mint')) {
      log.info('💡 Solution: Check the token address is correct')
      log.info('   Make sure the token exists on the selected network')
    } else if (error.message.includes('config')) {
      log.info('💡 Solution: Solana CLI configuration issue')
      log.info('   Try running: solana config get')
    }
    
    throw error
  }
}