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

## Disclaimer

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

By using this software, you acknowledge and agree that the authors and contributors of this software are not responsible or liable, directly or indirectly, for any damage or loss caused, or alleged to be caused, by or in connection with the use of or reliance on this software. This includes, but is not limited to, any bugs, errors, defects, failures, or omissions in the software or its documentation. Additionally, the authors are not responsible for any security vulnerabilities or potential breaches that may arise from the use of this software.

You are solely responsible for the risks associated with using this software and should take any necessary precautions before utilizing it in any production or critical systems. It's strongly recommended to review the software thoroughly and test its functionalities in a controlled environment before any broader application.
