# 🚀 Solana Token Launcher

A professional, interactive CLI tool for creating and managing SPL tokens on Solana with metadata support via Metaplex and IPFS storage.

![Solana Token Launcher](https://img.shields.io/badge/Solana-Token%20Launcher-purple?style=for-the-badge&logo=solana)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## ✨ Features

- 🆕 **Create New Tokens** - Generate SPL tokens with rich metadata
- 🪙 **Mint Tokens** - Mint tokens to any address with CLI integration
- 🔒 **Revoke Authorities** - Permanently revoke mint/freeze authorities for decentralization
- 📝 **Update Metadata** - Modify token metadata with IPFS storage
- 🔍 **Check Token Info** - Inspect token details, metadata, and authorities
- 📋 **Token Management** - Track and manage all created tokens
- 🌐 **Multi-Network** - Support for Devnet, Mainnet, and Testnet
- 🎨 **Beautiful CLI** - Interactive menus with colors and progress indicators
- 💾 **Auto-Save** - Automatic token information storage and management
- 🔗 **Explorer Links** - Direct links to Solana Explorer and SolScan

## 🛠️ Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Solana CLI Tools** - [Installation guide](https://docs.solana.com/cli/install-solana-cli-tools)
- **Pinata Account** - For IPFS metadata storage (optional but recommended)

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/solana-token-launcher.git
   cd solana-token-launcher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Pinata (Optional)**
   - Create a [Pinata](https://pinata.cloud) account
   - Get your JWT token
   - Update `config/config.js` with your Pinata JWT

4. **Add your wallet**
   ```bash
   # Copy your wallet file to the wallets directory
   cp /path/to/your/wallet.json ./wallets/wallet.json
   ```

## 🚀 Quick Start

1. **Start the application**
   ```bash
   npm start
   # or
   node index.js
   ```

2. **Create your first token**
   - Select "🆕 Create New Token"
   - Choose your wallet and network
   - Fill in token details
   - Confirm creation

3. **Mint tokens**
   - Select "🪙 Mint Tokens"
   - Choose your token
   - Specify amount and recipient
   - Confirm minting

## 📁 Project Structure

```
solana-token-launcher/
├── index.js                 # Main CLI interface
├── package.json             # Dependencies and scripts
├── config/
│   └── config.js           # Configuration settings
├── src/
│   ├── utils.js            # Utility functions
│   ├── create-token.js     # Token creation module
│   ├── mint-tokens.js      # Token minting module
│   ├── revoke-authorities.js # Authority revocation module
│   ├── update-metadata.js  # Metadata update module
│   └── check-token.js      # Token checking module
├── wallets/                # Store wallet files here
├── tokens/                 # Created token info saved here
└── README.md               # This file
```

## ⚙️ Configuration

### Network Settings
Edit `config/config.js` to change default network:
```javascript
DEFAULT_NETWORK: "DEVNET", // Change to "MAINNET" for production
```

### Pinata Configuration
Update your Pinata JWT token in `config/config.js`:
```javascript
PINATA: {
  JWT: "your-pinata-jwt-token-here"
}
```

## 🎯 Usage Examples

### Creating a Token
```bash
# Start the app
node index.js

# Select: 🆕 Create New Token
# Follow the interactive prompts
```

### Minting Tokens
```bash
# From main menu: 🪙 Mint Tokens
# Choose token from list or enter address manually
# Specify amount and recipient
```

### Revoking Authorities
```bash
# From main menu: 🔒 Revoke Authorities
# ⚠️ WARNING: This is permanent and irreversible!
# Choose mint authority, freeze authority, or both
```

## 🔧 CLI Commands

The tool also provides npm scripts for direct access:

```bash
npm run create    # Create new token
npm run mint      # Mint tokens
npm run update    # Update metadata
npm run check     # Check token info
```

## 🌐 Network Support

- **Devnet** - For testing (recommended for new users)
- **Mainnet** - For production (costs real SOL)
- **Testnet** - For additional testing

## 📋 Token Standards

This tool creates **Fungible SPL Tokens** with:
- ✅ Metaplex Token Metadata
- ✅ IPFS-hosted metadata
- ✅ Solana Token Standard compliance
- ✅ Explorer compatibility
- ✅ Wallet integration support

## 🔒 Security Features

- **Multiple Confirmations** - Safety prompts for irreversible actions
- **Authority Management** - Revoke authorities for decentralization
- **Local Wallet Storage** - Wallets stored locally, never transmitted
- **Transaction Verification** - All transactions verified and logged

## 🐛 Troubleshooting

### Common Issues

**"No wallet files found"**
```bash
# Add your wallet to the wallets directory
cp your-wallet.json ./wallets/wallet.json
```

**"Insufficient funds"**
```bash
# For devnet, airdrop SOL
solana airdrop 2 --url devnet
```

**"Authority not found"**
- Make sure you're using the correct wallet (mint/update authority)
- Verify the wallet has the required permissions

**"Pinata upload failed"**
- Check your Pinata JWT token in config/config.js
- Verify your Pinata account has sufficient storage

### Getting Help

1. Check the built-in help: Select "❓ Help" from the main menu
2. Review transaction on Solana Explorer
3. Check the `tokens/` directory for saved token information
4. Verify Solana CLI installation: `solana --version`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Solana Labs](https://solana.com/) - For the amazing blockchain platform
- [Metaplex](https://metaplex.com/) - For the token metadata standard
- [Pinata](https://pinata.cloud/) - For IPFS storage solutions
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/) - For beautiful CLI interactions

## 📞 Support

- **Documentation**: Check the built-in help system
- **Issues**: Open an issue on GitHub
- **Community**: Join the Solana Discord

---

**⚠️ Disclaimer**: This tool is for educational and development purposes. Always test on devnet before using on mainnet. The authors are not responsible for any losses incurred through the use of this software.

## 🔮 Roadmap

- [ ] Token burn functionality
- [ ] Batch operations
- [ ] Token metadata templates
- [ ] Integration with more IPFS providers
- [ ] Token analytics dashboard
- [ ] Multi-signature support

---

Made with ❤️ for the Solana community