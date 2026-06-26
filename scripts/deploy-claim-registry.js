import { network } from 'hardhat';

const { ethers } = await network.create();
const [deployer] = await ethers.getSigners();
const factory = await ethers.getContractFactory('ClaimRegistry');
const registry = await factory.deploy();
await registry.waitForDeployment();

const deployment = {
  network: network.name ?? 'hardhat',
  chainId: Number((await ethers.provider.getNetwork()).chainId),
  contract: 'ClaimRegistry',
  address: await registry.getAddress(),
  deployer: deployer.address,
  owner: await registry.owner(),
  deployerAuthorized: await registry.isAuthorizedIssuer(deployer.address),
  totalClaims: Number(await registry.totalClaims()),
  duplicateAttempts: Number(await registry.duplicateAttempts()),
  note: 'Local proof-of-deploy artifact. For Sepolia/Amoy, run the same script with a funded deployer and publish the block explorer URL.'
};

console.log(JSON.stringify(deployment, null, 2));
