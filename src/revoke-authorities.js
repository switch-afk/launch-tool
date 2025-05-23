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

export async function revokeAuthorities() {
  try {
    log.title('🔒 REVOKE TOKEN AUTHORITIES')
    
    log.info('⚠️  WARNING: Revoking authorities is PERMANENT and cannot be undone!')
    log.info('- Revoke Mint Authority: No more tokens can be minted')
    log.info('- Revoke Freeze Authority: No accounts can be frozen/unfrozen')

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
          message: 'Select token to revoke authorities:',
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

    // Select what to revoke
    const { authoritiesToRevoke } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'authoritiesToRevoke',
        message: 'Which authorities would you like to revoke?',
        choices: [
          { name: '🚫 Revoke Mint Authority (No more tokens can be minted)', value: 'mint' },
          { name: '❄️  Revoke Freeze Authority (No accounts can be frozen)', value: 'freeze' }
        ],
        validate: (input) => input.length > 0 ? true : 'Please select at least one authority to revoke'
      }
    ])

    // Select wallet (must be current authority)
    const { walletFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'walletFile',
        message: 'Select wallet to use (must be current authority):',
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

    // Show summary and final warning
    log.separator()
    log.title('📋 REVOKE AUTHORITIES SUMMARY')
    console.log('Token Address:', tokenAddress)
    if (tokenInfo) {
      console.log('Token Name:', `${tokenInfo.name} (${tokenInfo.symbol})`)
    }
    console.log('Authorities to Revoke:', authoritiesToRevoke.map(auth => 
      auth === 'mint' ? 'Mint Authority' : 'Freeze Authority'
    ).join(', '))
    console.log('Network:', network)
    console.log('Authority Wallet:', walletFile.split('/').pop())
    log.separator()

    log.warning('⚠️  FINAL WARNING: This action is PERMANENT and IRREVERSIBLE!')
    
    if (authoritiesToRevoke.includes('mint')) {
      log.warning('🚫 After revoking mint authority, NO MORE TOKENS can ever be minted')
    }
    
    if (authoritiesToRevoke.includes('freeze')) {
      log.warning('❄️  After revoking freeze authority, NO ACCOUNTS can be frozen/unfrozen')
    }

    const { confirmRevoke } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmRevoke',
        message: '🔒 Are you absolutely sure you want to proceed with revoking these authorities?',
        default: false
      }
    ])

    if (!confirmRevoke) {
      log.info('Authority revocation cancelled')
      return
    }

    // Double confirmation for safety
    const { doubleConfirm } = await inquirer.prompt([
      {
        type: 'input',
        name: 'doubleConfirm',
        message: 'Type "REVOKE" in capital letters to confirm:',
        validate: (input) => input === 'REVOKE' ? true : 'Please type "REVOKE" exactly as shown'
      }
    ])

    // Start revocation process
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
      
      spinner.succeed('Solana CLI configured successfully')

      // Process each authority revocation
      const results = {}

      for (const authority of authoritiesToRevoke) {
        if (authority === 'mint') {
          spinner.start('Revoking mint authority...')
          
          try {
            const revokeMintCmd = `spl-token authorize ${tokenAddress} mint --disable --url ${network}`
            log.info(`Executing: ${revokeMintCmd}`)
            
            const { stdout, stderr } = await execAsync(revokeMintCmd)
            
            if (stderr && !stderr.includes('Signature:')) {
              spinner.warn(`Mint authority revocation output: ${stderr}`)
            }
            
            if (stdout) {
              spinner.succeed('🚫 Mint authority revoked successfully!')
              log.info(`Output: ${stdout}`)
              
              // Extract transaction signature
              const signatureMatch = stdout.match(/Signature: ([A-Za-z0-9]+)/i)
              if (signatureMatch) {
                results.mintRevokeSignature = signatureMatch[1]
                log.success(`Mint revoke transaction: ${signatureMatch[1]}`)
              }
            }
            
            results.mintRevoked = true
            
          } catch (error) {
            spinner.fail('Failed to revoke mint authority')
            log.error(`Mint authority revocation failed: ${error.message}`)
            results.mintRevoked = false
            results.mintError = error.message
          }
        }

        if (authority === 'freeze') {
          spinner.start('Revoking freeze authority...')
          
          try {
            const revokeFreezeCmd = `spl-token authorize ${tokenAddress} freeze --disable --url ${network}`
            log.info(`Executing: ${revokeFreezeCmd}`)
            
            const { stdout, stderr } = await execAsync(revokeFreezeCmd)
            
            if (stderr && !stderr.includes('Signature:')) {
              spinner.warn(`Freeze authority revocation output: ${stderr}`)
            }
            
            if (stdout) {
              spinner.succeed('❄️  Freeze authority revoked successfully!')
              log.info(`Output: ${stdout}`)
              
              // Extract transaction signature
              const signatureMatch = stdout.match(/Signature: ([A-Za-z0-9]+)/i)
              if (signatureMatch) {
                results.freezeRevokeSignature = signatureMatch[1]
                log.success(`Freeze revoke transaction: ${signatureMatch[1]}`)
              }
            }
            
            results.freezeRevoked = true
            
          } catch (error) {
            spinner.fail('Failed to revoke freeze authority')
            log.error(`Freeze authority revocation failed: ${error.message}`)
            results.freezeRevoked = false
            results.freezeError = error.message
          }
        }
      }

      // Show final results
      log.success('🎉 AUTHORITY REVOCATION COMPLETE!')
      log.separator()
      console.log('Token Address:', tokenAddress)
      
      if (results.mintRevoked) {
        console.log('✅ Mint Authority: REVOKED')
        if (results.mintRevokeSignature) {
          console.log('   Transaction:', results.mintRevokeSignature)
        }
      } else if (authoritiesToRevoke.includes('mint')) {
        console.log('❌ Mint Authority: REVOCATION FAILED')
        if (results.mintError) {
          console.log('   Error:', results.mintError)
        }
      }
      
      if (results.freezeRevoked) {
        console.log('✅ Freeze Authority: REVOKED')
        if (results.freezeRevokeSignature) {
          console.log('   Transaction:', results.freezeRevokeSignature)
        }
      } else if (authoritiesToRevoke.includes('freeze')) {
        console.log('❌ Freeze Authority: REVOCATION FAILED')
        if (results.freezeError) {
          console.log('   Error:', results.freezeError)
        }
      }
      
      console.log('Network:', network.toUpperCase())
      log.separator()

      // Display explorer links for transactions
      if (results.mintRevokeSignature) {
        displayUtils.displayExplorerLinks(results.mintRevokeSignature, 'tx', network.toUpperCase())
      }
      
      if (results.freezeRevokeSignature && results.freezeRevokeSignature !== results.mintRevokeSignature) {
        displayUtils.displayExplorerLinks(results.freezeRevokeSignature, 'tx', network.toUpperCase())
      }

      // Update token info if we have it
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
              mintAuthorityRevoked: results.mintRevoked || tokenInfo.mintAuthorityRevoked,
              freezeAuthorityRevoked: results.freezeRevoked || tokenInfo.freezeAuthorityRevoked,
              mintRevokeTransaction: results.mintRevokeSignature || tokenInfo.mintRevokeTransaction,
              freezeRevokeTransaction: results.freezeRevokeSignature || tokenInfo.freezeRevokeTransaction,
              lastRevokeDate: new Date().toISOString()
            }
            
            fileUtils.saveJson(tokenFile, updatedInfo)
            log.info('Token info updated with revocation details')
          }
        } catch (error) {
          log.warning('Could not update token info file')
        }
      }

      // Final status summary
      log.separator()
      log.title('🔒 TOKEN STATUS AFTER REVOCATION')
      
      if (results.mintRevoked) {
        log.warning('🚫 MINT AUTHORITY: PERMANENTLY DISABLED')
        log.info('   - No more tokens can ever be minted')
        log.info('   - Token supply is now fixed forever')
      }
      
      if (results.freezeRevoked) {
        log.warning('❄️  FREEZE AUTHORITY: PERMANENTLY DISABLED')
        log.info('   - No token accounts can be frozen')
        log.info('   - All tokens are permanently transferable')
      }
      
      if (results.mintRevoked || results.freezeRevoked) {
        log.success('✅ Your token is now more decentralized!')
      }

    } catch (error) {
      spinner.fail('Authority revocation failed')
      throw error
    }

  } catch (error) {
    log.error(`Authority revocation failed: ${error.message}`)
    
    // Provide helpful error messages
    if (error.message.includes('insufficient funds')) {
      log.info('💡 Solution: Add SOL to your wallet for transaction fees')
      log.info('   For devnet: solana airdrop 1 --url devnet')
    } else if (error.message.includes('not found')) {
      log.info('💡 Solution: Make sure Solana CLI tools are installed')
    } else if (error.message.includes('authority')) {
      log.info('💡 Solution: Make sure you\'re using the current authority wallet')
      log.info('   Only the current authority can revoke authorities')
    } else if (error.message.includes('Invalid mint')) {
      log.info('💡 Solution: Check the token address is correct')
    } else if (error.message.includes('already disabled')) {
      log.info('💡 Info: The authority may already be revoked')
    }
    
    throw error
  }
}