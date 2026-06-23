import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('ClaimRegistry contract', function () {
  async function deployRegistry() {
    const ClaimRegistry = await ethers.getContractFactory('ClaimRegistry');
    return ClaimRegistry.deploy();
  }

  const programA = ethers.id('osscontest-2026');
  const programB = ethers.id('scholarship-2026');
  const nullifier = ethers.keccak256(ethers.toUtf8Bytes('alice:nullifier'));
  const commitmentA = ethers.keccak256(ethers.toUtf8Bytes('commitment:a'));
  const commitmentB = ethers.keccak256(ethers.toUtf8Bytes('commitment:b'));

  it('deploys with zero counters', async function () {
    const registry = await deployRegistry();

    expect(await registry.totalClaims()).to.equal(0n);
    expect(await registry.duplicateAttempts()).to.equal(0n);
  });

  it('registers the first claim and emits ClaimRegistered', async function () {
    const registry = await deployRegistry();

    const receipt = await (await registry.registerClaim(programA, nullifier, commitmentA, 'ipfs://vc-a')).wait();
    const event = eventByName(registry, receipt, 'ClaimRegistered');

    expect(event.args.programId).to.equal(programA);
    expect(event.args.nullifierHash).to.equal(nullifier);
    expect(event.args.commitmentHash).to.equal(commitmentA);
    expect(event.args.metadataUri).to.equal('ipfs://vc-a');

    expect(await registry.totalClaims()).to.equal(1n);
    expect(await registry.programClaimCounts(programA)).to.equal(1n);
  });

  it('rejects duplicate claims and emits DuplicateDetected', async function () {
    const registry = await deployRegistry();
    await registry.registerClaim(programA, nullifier, commitmentA, 'ipfs://vc-a');

    const receipt = await (await registry.registerClaim(programA, nullifier, commitmentB, 'ipfs://vc-duplicate')).wait();
    const event = eventByName(registry, receipt, 'DuplicateDetected');

    expect(event.args.programId).to.equal(programA);
    expect(event.args.nullifierHash).to.equal(nullifier);
    expect(event.args.commitmentHash).to.equal(commitmentB);
    expect(event.args.metadataUri).to.equal('ipfs://vc-duplicate');

    expect(await registry.totalClaims()).to.equal(1n);
    expect(await registry.duplicateAttempts()).to.equal(1n);
  });

  it('allows the same nullifier in separate programs', async function () {
    const registry = await deployRegistry();

    await registry.registerClaim(programA, nullifier, commitmentA, 'ipfs://vc-a');
    await registry.registerClaim(programB, nullifier, commitmentB, 'ipfs://vc-b');

    expect(await registry.totalClaims()).to.equal(2n);
    expect(await registry.programClaimCounts(programA)).to.equal(1n);
    expect(await registry.programClaimCounts(programB)).to.equal(1n);
  });

  it('reads registered claim data', async function () {
    const registry = await deployRegistry();
    await registry.registerClaim(programA, nullifier, commitmentA, 'ipfs://vc-a');

    const claim = await registry.getClaim(programA, nullifier);
    expect(claim.commitmentHash).to.equal(commitmentA);
    expect(claim.metadataUri).to.equal('ipfs://vc-a');
    expect(claim.registeredAt).to.be.greaterThan(0n);
    expect(await registry.claimStatus(programA, nullifier)).to.equal(1n);
  });

  it('returns empty claim data for missing claims', async function () {
    const registry = await deployRegistry();

    const claim = await registry.getClaim(programA, nullifier);
    expect(claim.commitmentHash).to.equal(ethers.ZeroHash);
    expect(claim.metadataUri).to.equal('');
    expect(claim.registeredAt).to.equal(0n);
    expect(await registry.claimStatus(programA, nullifier)).to.equal(0n);
  });
});

function eventByName(contract, receipt, name) {
  for (const log of receipt.logs) {
    const parsed = contract.interface.parseLog(log);
    if (parsed?.name === name) {
      return parsed;
    }
  }
  throw new Error(`Expected event ${name}`);
}
