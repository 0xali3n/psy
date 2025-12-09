# ZeroTrace Architecture

## Overview

ZeroTrace is an end-to-end encrypted messaging DApp built on **Psy Protocol**, leveraging zero-knowledge proofs for privacy-preserving, provable messaging with programmable identities.

## Core Principles

1. **End-to-End Encryption**: All messages encrypted with XChaCha20-Poly1305
2. **Zero-Knowledge Proofs**: ZK proofs (Psy Protocol CFC) prove valid state transitions without revealing content
3. **Programmable Identities**: SDKey-style identity system with attestations
4. **Privacy-Preserving**: Only commitments and proofs on-chain, encrypted data off-chain
5. **Decentralized**: Designed for Psy Protocol's decentralized infrastructure

## System Architecture

```
┌─────────────────┐
│  Client (Rust)  │
│  - Identity     │
│  - Encryption   │
│  - ZK Prover    │
└────────┬────────┘
         │
         │ EndCap (proof + encrypted blob)
         ▼
┌─────────────────┐
│  API Server     │
│  - Validation   │
│  - Storage      │
│  - Relay        │
└────────┬────────┘
         │
         │ Proofs + Commitments
         ▼
┌─────────────────┐
│  Psy Protocol   │
│  - Realm        │
│  - UCON/CLEAF   │
│  - DA Miner     │
└─────────────────┘
```

## Components

### 1. Identity System (`identity.rs`)

**Programmable Identity (SDKey-style)**
- ED25519 keypairs for signing
- Privacy-preserving identity hashes (Poseidon-style)
- Attestation system for claims
- Contact management

**Key Features:**
- Deterministic identity from seed
- Identity hash = `Poseidon(public_key)` (privacy-preserving)
- Attestations prove claims without revealing values

### 2. Encryption (`lib.rs`)

**XChaCha20-Poly1305**
- Authenticated encryption
- 24-byte nonces (XChaCha20)
- 256-bit keys
- AEAD (Authenticated Encryption with Associated Data)

### 3. Commitments (`commitments.rs`)

**Poseidon-style Hashing**
- Message commitments: `Poseidon(sender, thread_id, nonce, plaintext_hash)`
- CSTATE roots: Merkle root of contract state
- Privacy: Only commitments on-chain, plaintext off-chain

**State Management:**
- CSTATE = Contract State (user's message state)
- Thread roots = Merkle roots per conversation thread
- CSTATE root = Merkle root of all thread roots

### 4. ZK Proofs (`proofs.rs`)

**Psy Protocol CFC Proofs**
- CFC = Contract Function Code (whitelisted functions)
- Proof structure:
  - `cfc_fingerprint`: Hash of function code
  - `start_cstate_root`: State before execution
  - `end_cstate_root`: State after execution
  - `proof_bytes`: ZK proof (plonky2-hwa)
  - `public_inputs`: Public values in proof

**EndCap Format:**
- CFC proof
- Encrypted blob address (DA/storage)
- VAA nonce (replay protection)
- Signature

**Current Status:**
- Proof generation/verification stubbed (simulated)
- Ready for plonky2-hwa integration
- Proof structure matches Psy Protocol spec

### 5. Message Flow

**Sending a Message:**

1. **Client Side:**
   - Encrypt plaintext with XChaCha20-Poly1305
   - Compute message commitment (Poseidon)
   - Get current CSTATE root
   - Generate CFC proof (proves valid state transition)
   - Create EndCap (proof + encrypted blob address)
   - Sign EndCap with identity

2. **Server Side:**
   - Verify proof
   - Verify signature
   - Check VAA nonce (replay protection)
   - Update CSTATE root
   - Store encrypted message
   - Relay to recipient/indexer

3. **On-Chain (Psy Protocol):**
   - Submit EndCap to Realm
   - Verify proof on-chain
   - Update UCON (user contract) leaf
   - Store encrypted blob address in DA

**Receiving a Message:**

1. Client queries indexer for new messages
2. Fetch encrypted blob from DA
3. Decrypt with shared key
4. Verify message commitment
5. Update local CSTATE

## Data Model

### Message
```rust
struct Message {
    thread_id: String,
    sender_id: String,           // Identity hash
    ciphertext: String,          // Base64 encrypted
    iv: String,                  // Base64 nonce
    timestamp: u64,
    message_commitment: String,  // Poseidon commitment
    endcap: Option<EndCap>,      // ZK proof + metadata
}
```

### CSTATE (Contract State)
- Per-user state tree
- Leaves = thread roots
- Root = CSTATE root (stored in UCON)

### Identity
- Public key: ED25519 (32 bytes)
- Identity hash: `Poseidon(public_key)` (privacy-preserving)
- Attestations: Signed claims about identity

## Security Features

1. **Encryption**: XChaCha20-Poly1305 (authenticated)
2. **Nonce Reuse Protection**: Unique nonces per message
3. **Replay Protection**: VAA nonces per identity
4. **Proof Verification**: ZK proofs ensure valid state transitions
5. **Signature Verification**: ED25519 signatures on EndCaps
6. **Privacy**: Only commitments on-chain, plaintext off-chain

## Integration Points

### Psy Protocol Components

1. **Realm**: Submits EndCaps, verifies proofs
2. **UCON**: Stores CSTATE roots per user
3. **CLEAF**: Whitelist of allowed CFCs
4. **DA Miner**: Stores encrypted message blobs
5. **Indexer**: Indexes messages, handles reorgs

### Current Implementation Status

- ✅ Identity system (ED25519, hashes, attestations)
- ✅ Encryption (XChaCha20-Poly1305)
- ✅ Commitments (Poseidon-style simulation)
- ✅ ZK proof structure (CFC, EndCap format)
- ⏳ Real plonky2-hwa integration (stubbed)
- ⏳ Psy Protocol Realm integration (simulated)
- ⏳ DA Miner integration (simulated)

## Future Enhancements

1. **Real ZK Proving**: Integrate plonky2-hwa for actual proofs
2. **Psy Testnet**: Connect to Psy Protocol testnet
3. **DA Integration**: Real decentralized storage (IPFS/Arweave)
4. **Indexer**: Reorg-tolerant message indexing
5. **Multi-device**: Sync CSTATE across devices
6. **Group Messaging**: Multi-party threads with shared keys

## References

- [Psy Protocol Docs](https://psy.xyz/docs)
- [Psy Protocol GitHub](https://github.com/psyprotocol)
- [plonky2-hwa](https://github.com/PsyProtocol/plonky2-hwa)
- [Poseidon2](https://github.com/OpenAssetStandards/poseidon2)

