// SPDX-License-Identifier: Apache-2.0
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';

/** @type {import('hardhat/config').HardhatUserConfig} */
export default {
  plugins: [hardhatEthers, hardhatMocha],
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    tests: './tests/contracts'
  }
};
