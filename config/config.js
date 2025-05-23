// Main configuration file for the Token Launch Tool

export const CONFIG = {
  // Network settings
  NETWORK: {
    DEVNET: "https://api.devnet.solana.com",
    MAINNET: "https://api.mainnet-beta.solana.com",
    TESTNET: "https://api.testnet.solana.com"
  },

  // Default network (change to MAINNET for production)
  DEFAULT_NETWORK: "DEVNET",

  // Pinata IPFS settings
  PINATA: {
    JWT: "enter your pinata JWT here",
    API_URL: "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    GATEWAY: "https://gateway.pinata.cloud/ipfs/"
  },

  // Default token settings
  DEFAULTS: {
    DECIMALS: 9,
    SELLER_FEE_BASIS_POINTS: 0,
    IS_MUTABLE: true,
    INITIAL_SUPPLY: 1000000
  },

  // File paths
  PATHS: {
    WALLETS: "./wallets",
    TOKENS: "./tokens",
    CONFIG: "./config"
  },

  // Explorer URLs
  EXPLORERS: {
    DEVNET: {
      SOLANA: "https://explorer.solana.com",
      SOLSCAN: "https://solscan.io"
    },
    MAINNET: {
      SOLANA: "https://explorer.solana.com",
      SOLSCAN: "https://solscan.io"
    }
  }
}

// Helper function to get network URL
export function getNetworkUrl(network = CONFIG.DEFAULT_NETWORK) {
  return CONFIG.NETWORK[network.toUpperCase()]
}

// Helper function to get explorer URL
export function getExplorerUrl(type = "SOLANA", network = CONFIG.DEFAULT_NETWORK) {
  const cluster = network.toLowerCase() === "mainnet" ? "" : `?cluster=${network.toLowerCase()}`
  return CONFIG.EXPLORERS[network.toUpperCase()][type.toUpperCase()] + cluster
}

// Helper function to get network cluster parameter
export function getNetworkCluster(network = CONFIG.DEFAULT_NETWORK) {
  return network.toLowerCase() === "mainnet" ? "" : `?cluster=${network.toLowerCase()}`
}
