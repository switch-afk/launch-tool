import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import chalk from 'chalk'
import { CONFIG } from '../config/config.js'

// Console styling functions
export const log = {
  success: (msg) => console.log(chalk.green('✅', msg)),
  error: (msg) => console.log(chalk.red('❌', msg)),
  warning: (msg) => console.log(chalk.yellow('⚠️ ', msg)),
  info: (msg) => console.log(chalk.blue('ℹ️ ', msg)),
  step: (msg) => console.log(chalk.cyan('🔧', msg)),
  title: (msg) => console.log(chalk.magenta.bold('\n' + msg)),
  separator: () => console.log(chalk.gray('═'.repeat(50)))
}

// File system utilities
export const fileUtils = {
  // Ensure directory exists
  ensureDir: (dirPath) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  },

  // Save JSON file
  saveJson: (filePath, data) => {
    const dir = path.dirname(filePath)
    fileUtils.ensureDir(dir)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  },

  // Load JSON file
  loadJson: (filePath) => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  },

  // Check if file exists
  exists: (filePath) => fs.existsSync(filePath),

  // List files in directory
  listFiles: (dirPath, extension = '') => {
    if (!fs.existsSync(dirPath)) return []
    return fs.readdirSync(dirPath)
      .filter(file => extension ? file.endsWith(extension) : true)
      .map(file => path.join(dirPath, file))
  }
}

// Pinata IPFS utilities
export const pinataUtils = {
  // Upload JSON to Pinata
  uploadJson: async (jsonData, name) => {
    try {
      log.step(`Uploading ${name} to IPFS...`)
      
      const response = await fetch(CONFIG.PINATA.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.PINATA.JWT}`
        },
        body: JSON.stringify({
          pinataContent: jsonData,
          pinataMetadata: { name }
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Pinata upload failed: ${response.status} - ${errorData}`)
      }

      const result = await response.json()
      const uri = `${CONFIG.PINATA.GATEWAY}${result.IpfsHash}`
      
      log.success(`Uploaded to IPFS: ${uri}`)
      return uri
    } catch (error) {
      log.error(`Failed to upload to Pinata: ${error.message}`)
      throw error
    }
  },

  // Upload image to Pinata (placeholder for future implementation)
  uploadImage: async (imagePath, imageName) => {
    log.warning('Image upload not yet implemented')
    return null
  }
}

// Wallet utilities
export const walletUtils = {
  // Load wallet from file
  loadWallet: (walletPath) => {
    try {
      if (!fileUtils.exists(walletPath)) {
        throw new Error(`Wallet file not found: ${walletPath}`)
      }
      
      const walletData = fileUtils.loadJson(walletPath)
      if (!Array.isArray(walletData) || walletData.length !== 64) {
        throw new Error('Invalid wallet format. Expected array of 64 numbers.')
      }
      
      log.success(`Wallet loaded: ${walletPath}`)
      return walletData
    } catch (error) {
      log.error(`Failed to load wallet: ${error.message}`)
      throw error
    }
  },

  // List available wallets
  listWallets: () => {
    const walletDir = CONFIG.PATHS.WALLETS
    return fileUtils.listFiles(walletDir, '.json')
  }
}

// Token utilities
export const tokenUtils = {
  // Save token information
  saveTokenInfo: (tokenData) => {
    const fileName = `${tokenData.symbol}-${Date.now()}.json`
    const filePath = path.join(CONFIG.PATHS.TOKENS, fileName)
    
    fileUtils.saveJson(filePath, {
      ...tokenData,
      createdAt: new Date().toISOString(),
      toolVersion: "1.0.0"
    })
    
    log.success(`Token info saved: ${filePath}`)
    return filePath
  },

  // Load token information
  loadTokenInfo: (filePath) => {
    return fileUtils.loadJson(filePath)
  },

  // List created tokens
  listTokens: () => {
    const tokenDir = CONFIG.PATHS.TOKENS
    return fileUtils.listFiles(tokenDir, '.json')
  },

  // Generate explorer URLs
  getExplorerUrls: (address, type = 'address', network = CONFIG.DEFAULT_NETWORK) => {
    const cluster = network.toLowerCase() === 'mainnet' ? '' : `?cluster=${network.toLowerCase()}`
    
    return {
      solana: `https://explorer.solana.com/${type}/${address}${cluster}`,
      solscan: `https://solscan.io/${type}/${address}${cluster}`
    }
  }
}

// Validation utilities
export const validators = {
  // Validate token configuration
  validateTokenConfig: (config) => {
    const required = ['name', 'symbol', 'description']
    const missing = required.filter(field => !config[field])
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }

    if (config.symbol.length > 10) {
      throw new Error('Token symbol should be 10 characters or less')
    }

    if (config.decimals < 0 || config.decimals > 18) {
      throw new Error('Decimals must be between 0 and 18')
    }

    return true
  },

  // Validate wallet address format
  validateAddress: (address) => {
    if (!address || typeof address !== 'string') {
      return false
    }
    
    // Basic Solana address validation (44 characters, base58)
    return address.length >= 32 && address.length <= 44
  }
}

// Display utilities
export const displayUtils = {
  // Display token information in a formatted way
  displayTokenInfo: (tokenData) => {
    log.separator()
    log.title('🪙 TOKEN INFORMATION')
    console.log(chalk.cyan('Name:'), chalk.white(tokenData.name))
    console.log(chalk.cyan('Symbol:'), chalk.white(tokenData.symbol))
    console.log(chalk.cyan('Mint Address:'), chalk.yellow(tokenData.mintAddress))
    console.log(chalk.cyan('Decimals:'), chalk.white(tokenData.decimals))
    console.log(chalk.cyan('Supply:'), chalk.white(tokenData.initialSupply?.toLocaleString() || 'N/A'))
    console.log(chalk.cyan('Creator:'), chalk.white(tokenData.creator))
    console.log(chalk.cyan('Network:'), chalk.white(tokenData.network?.toUpperCase() || 'DEVNET'))
    
    if (tokenData.metadataUri) {
      console.log(chalk.cyan('Metadata:'), chalk.blue(tokenData.metadataUri))
    }
    
    if (tokenData.createTransaction) {
      console.log(chalk.cyan('Tx Hash:'), chalk.green(tokenData.createTransaction))
    }
    
    log.separator()
  },

  // Display explorer links
  displayExplorerLinks: (address, type = 'address', network = CONFIG.DEFAULT_NETWORK) => {
    const urls = tokenUtils.getExplorerUrls(address, type, network)
    
    log.title('🔗 EXPLORER LINKS')
    console.log(chalk.cyan('Solana Explorer:'), chalk.blue(urls.solana))
    console.log(chalk.cyan('SolScan:'), chalk.blue(urls.solscan))
    log.separator()
  }
}