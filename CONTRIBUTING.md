# Contributing to Solana Token Launcher

We love your input! We want to make contributing to Solana Token Launcher as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## Pull Requests

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issue tracker](https://github.com/your-username/solana-token-launcher/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/your-username/solana-token-launcher/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

People *love* thorough bug reports. I'm not even kidding.

## Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/solana-token-launcher.git
   cd solana-token-launcher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your development environment**
   ```bash
   # Copy example wallet (for testing only)
   cp example-wallet.json ./wallets/dev-wallet.json
   
   # Configure for devnet testing
   # Edit config/config.js if needed
   ```

4. **Run the application**
   ```bash
   npm start
   ```

## Code Style

- Use ESLint and Prettier for code formatting
- Follow existing code patterns
- Add comments for complex logic
- Use meaningful variable and function names

## Testing

- Test all new features thoroughly on devnet
- Include unit tests for utility functions
- Test error handling paths
- Verify CLI interactions work correctly

## Security Considerations

When contributing to this project, please keep in mind:

- **Never commit wallet files or private keys**
- **Be careful with sensitive configuration data**
- **Test thoroughly on devnet before mainnet**
- **Consider the security implications of new features**

## Feature Requests

We use GitHub issues to track feature requests. Before creating a new feature request:

1. **Check existing issues** to avoid duplicates
2. **Provide detailed description** of the feature
3. **Explain the use case** and why it would be valuable
4. **Consider implementation complexity** and maintenance burden

## Code Review Process

The core team looks at Pull Requests on a regular basis. After feedback has been given we expect responses within two weeks. After two weeks we may close the pull request if it isn't showing any activity.

## Community

- Be respectful and inclusive
- Help others learn and grow
- Share knowledge and best practices
- Provide constructive feedback

## Areas for Contribution

Here are some areas where contributions would be especially welcome:

### 🐛 Bug Fixes
- Error handling improvements
- CLI interaction issues
- Network connection problems
- File system operations

### ✨ New Features
- Token burn functionality
- Batch operations
- Additional metadata fields
- Integration with more IPFS providers
- Token analytics and statistics

### 📚 Documentation
- Code comments
- README improvements
- Tutorial content
- FAQ sections

### 🧪 Testing
- Unit tests
- Integration tests
- Error scenario testing
- Performance testing

### 🎨 User Experience
- CLI interface improvements
- Better error messages
- Progress indicators
- Help system enhancements

## Getting Help

If you need help with your contribution:

1. **Check the documentation** first
2. **Look at existing code** for patterns
3. **Open a discussion** on GitHub
4. **Ask questions** in your pull request

## Recognition

Contributors will be recognized in:
- README.md acknowledgments
- Release notes
- Project documentation

Thank you for contributing to Solana Token Launcher! 🚀