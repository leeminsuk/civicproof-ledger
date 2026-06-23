import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('ClaimRegistry contract', function () {
  async function deployRegistry() {
    const [owner, issuer, stranger] = await ethers.getSigners();
    const ClaimRegistry = await ethers.getContractFactory('ClaimRegistry');
    const registry = await ClaimRegistry.deploy();
    return { registry, owner, issuer, stranger };
  }

  const programA = ethers.id('osscontest-2026');
  const programB = ethers.id('scholarship-2026');
  const nullifier = ethers.keccak256(ethers.toUtf8Bytes('alice:nullifier'));
  const commitmentA = ethers.keccak256(ethers.toUtf8Bytes('commitment:a'));
  const commitmentB = ethers.keccak256(ethers.toUtf8Bytes('commitment:b'));

  it('deploys with zero counters and owner authorized as issuer', async function () {
    const { registry, owner } = await deployRegistry();

    expect(await registry.totalClaims()).to.equal(0n);
    expect(await registry.duplicateAttempts()).to.equal(0n);
    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.isAuthorizedIssuer(owner.address)).to.equal(true);
  });

  it('registers the first claim and emits ClaimRegistered for authorized issuer', async function () {
    const { registry } = await deployRegistry();

    const receipt = await (await registry.registerClaim(programA, nullifier, commitmentA, 'ipfs://vc-a')).wait();
    const event = eventByName(registry, receipt, 'ClaimRegistered');

    expect(event.args.programId).to.equal(programA);
    expect(event.args.nullifierHash).to.equal(nullifier);
    expect(event.args.commitmentHash).to.equal(commitmentA);
    expect(event.args.metadataUri).to.equal('ipfs://vc-a');

    expect(await registry.totalClaims()).to.equal(1n);
    expect(await registry.programClaimCounts(programA)).to.equal(1n);
  });

  it('rejects unauthorized issuers before state changes', async function () {
    const { registry, stranger } = await deployRegistry();

    await expectRevertedWith(
      registry.connect(stranger).registerClaim(programA, nullifier, commitmentA, 'ipfs://vc-a'),
      'UnauthorizedIssuer'
    );
    expect(await registry.totalClaims()).to.equal(0n);
  });

  it('owner can authorize a new issuer and emits IssuerAuthorizationUpdated', async function () {
    const { registry, issuer } = await deployRegistry();

    const receipt = await (await registry.authorizeIssuer(issuer.address, true)).wait();
    const event = eventByName(registry, receipt, 'IssuerAuthorizationUpdated');

    expect(event.args.issuer).to.equal(issuer.address);
    expect(event.args.authorized).to.equal(true);
    expect(await registry.isAuthorizedIssuer(issuer.address)).to.equal(true);
  });

  it('newly authorized issuer can register claims', async function () {
    const { registry, issuer } = await deployRegistry();
    await registry.authorizeIssuer(issuer.address, true);

    await registry.connect(issuer).registerClaim(programA, nullifier, commitmentA, 'ipfs://issuer-vc');

    expect(await registry.totalClaims()).to.equal(1n);
    const claim = await registry.getClaim(programA, nullifier);
    expect(claim.metadataUri).to.equal('ipfs://issuer-vc');
  });

  it('non-owner cannot authorize issuers', async function () {
    const { registry, issuer, stranger } = await deployRegistry();

    await expectRevertedWith(
      registry.connect(stranger).authorizeIssuer(issuer.address, true),
      'OwnableUnauthorizedAccount'
    );
    expect(await registry.isAuthorizedIssuer(issuer.address)).to.equal(false);
  });

  it('owner can revoke an issuer', async function () {
    const { registry, issuer } = await deployRegistry();
    await registry.authorizeIssuer(issuer.address, true);
    await registry.authorizeIssuer(issuer.address, false);

    expect(await registry.isAuthorizedIssuer(issuer.address)).to.equal(false);
    await expectRevertedWith(
      registry.connect(issuer).registerClaim(programA, nullifier, commitmentA, 'ipfs://revoked'),
      'UnauthorizedIssuer'
    );
  });

  it('rejects zero programId as invalid input', async function () {
    const { registry } = await deployRegistry();

    await expectRevertedWith(
      registry.registerClaim(ethers.ZeroHash, nullifier, commitmentA, 'ipfs://vc-a'),
      'InvalidInput'
    );
  });

  it('rejects zero nullifierHash as invalid input', async function () {
    const { registry } = await deployRegistry();

    await expectRevertedWith(
      registry.registerClaim(programA, ethers.ZeroHash, commitmentA, 'ipfs://vc-a'),
      'InvalidInput'
    );
  });

  it('rejects zero commitmentHash as invalid input', async function () {
    const { registry } = await deployRegistry();

    await expectRevertedWith(
      registry.registerClaim(programA, nullifier, ethers.ZeroHash, 'ipfs://vc-a'),
      'InvalidInput'
    );
  });

  it('rejects empty metadataUri as invalid input', async function () {
    const { registry } = await deployRegistry();

    await expectRevertedWith(
      registry.registerClaim(programA, nullifier, commitmentA, ''),
      'InvalidInput'
    );
  });

  it('rejects duplicate claims and emits DuplicateDetected after issuer authorization', async function () {
    const { registry, issuer } = await deployRegistry();
    await registry.authorizeIssuer(issuer.address, true);
    await registry.connect(issuer).registerClaim(programA, nullifier, commitmentA, 'ipfs://vc-a');

    const receipt = await (await registry.connect(issuer).registerClaim(programA, nullifier, commitmentB, 'ipfs://vc-duplicate')).wait();
    const event = eventByName(registry, receipt, 'DuplicateDetected');

    expect(event.args.programId).to.equal(programA);
    expect(event.args.nullifierHash).to.equal(nullifier);
    expect(event.args.commitmentHash).to.equal(commitmentB);
    expect(event.args.metadataUri).to.equal('ipfs://vc-duplicate');

    expect(await registry.totalClaims()).to.equal(1n);
    expect(await registry.duplicateAttempts()).to.equal(1n);
  });

  it('allows the same nullifier in separate programs', async function () {
    const { registry } = await deployRegistry();

    await registry.registerClaim(programA, nullifier, commitmentA, 'ipfs://vc-a');
    await registry.registerClaim(programB, nullifier, commitmentB, 'ipfs://vc-b');

    expect(await registry.totalClaims()).to.equal(2n);
    expect(await registry.programClaimCounts(programA)).to.equal(1n);
    expect(await registry.programClaimCounts(programB)).to.equal(1n);
  });

  it('reads registered claim data', async function () {
    const { registry } = await deployRegistry();
    await registry.registerClaim(programA, nullifier, commitmentA, 'ipfs://vc-a');

    const claim = await registry.getClaim(programA, nullifier);
    expect(claim.commitmentHash).to.equal(commitmentA);
    expect(claim.metadataUri).to.equal('ipfs://vc-a');
    expect(claim.registeredAt).to.be.greaterThan(0n);
    expect(await registry.claimStatus(programA, nullifier)).to.equal(1n);
  });

  it('returns empty claim data for missing claims', async function () {
    const { registry } = await deployRegistry();

    const claim = await registry.getClaim(programA, nullifier);
    expect(claim.commitmentHash).to.equal(ethers.ZeroHash);
    expect(claim.metadataUri).to.equal('');
    expect(claim.registeredAt).to.equal(0n);
    expect(await registry.claimStatus(programA, nullifier)).to.equal(0n);
  });
});

async function expectRevertedWith(promise, expectedName) {
  try {
    await promise;
  } catch (error) {
    expect(String(error)).to.contain(expectedName);
    return;
  }
  throw new Error(`Expected revert with ${expectedName}`);
}

function eventByName(contract, receipt, name) {
  for (const log of receipt.logs) {
    const parsed = contract.interface.parseLog(log);
    if (parsed?.name === name) {
      return parsed;
    }
  }
  throw new Error(`Expected event ${name}`);
}
