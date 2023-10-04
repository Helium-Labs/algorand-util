# Algorand Blockchain Utilities

This package offers a collection of utility functions specifically designed for interacting with the Algorand blockchain. It's equipped to handle various operations, including signing transactions in multiple ways, creating, updating, and interacting with smart contracts, asset transfers, and more.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## Features

- Exports to ESM and CJS with Node/Browser compatibility using Rollup.
- Provide functions to sign transactions in various ways for the Algorand Blockchain.
- Utilities for various tasks, such as:
  - Compile a program source file
  - Wait for transaction confirmation
  - Send raw transactions
  - Execute transactions with or without signing
  - Opt-in to assets and apps
  - Interact with assets and apps
  - Compile, create, update, and delete Algorand smart contracts
  - Utility functions for Algorand wallets
  - And more...

## Installation

Install via npm:

```bash
npm install @gradian/util
```

## Usage

Import the desired utilities and start using them:

```javascript
import { Types, sendRawTransaction, compileProgram, getWalletInfo } from '@gradian/util';
```

Refer to the individual utility functions documentation and the provided examples for more detailed usage.

## Building

To build the project, run:

```bash
rollup --config rollup.config.mjs
```

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.


This `README.md` provides a comprehensive overview of the `@gradian/util` package, showcasing its capabilities and features in an organized manner. The actual `README.md` might be extended with more examples, a detailed API reference, or a contribution guide.
