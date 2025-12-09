# ZeroTrace Platform Documentation

## Overview

**ZeroTrace** is an end-to-end encrypted messaging DApp built on **Psy Protocol**, leveraging zero-knowledge proofs for privacy, scalability, and programmable identities. The platform ensures absolute privacy and security through cryptographic primitives and ZK proof verification.

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     ZeroTrace Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │───▶│  Rust API    │───▶│  Message     │  │
│  │  (Browser)   │    │  (Actix-web) │    │  Store       │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Identity    │    │  Encryption  │    │  ZK Proofs   │  │
│  │  Manager     │    │  Engine      │    │  Generator   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure & Responsibilities

### Frontend Files (`static/`)

#### `index.html`

**Purpose:** Main HTML structure and UI layout

**Key Components:**

- Sidebar with conversations list
- Main chat area with message display
- Modals for new chat, profile, and identity management
- Technical info overlay in chat background

**Features:**

- Responsive design (mobile & desktop)
- Real-time message display
- Identity management UI
- QR code generation for identity sharing

---

#### `style.css`

**Purpose:** Complete styling and visual design

**Key Sections:**

- **Color Scheme:** Light theme with purple gradients
- **Layout:** Flexbox-based responsive design
- **Components:**
  - Sidebar navigation
  - Chat bubbles (sent/received)
  - Modals and overlays
  - Technical info background display
  - Mobile responsive breakpoints

**Design Principles:**

- Clean, professional appearance
- Lightweight and fast
- Premium theme with subtle animations
- Accessibility considerations

---

#### `app.js`

**Purpose:** Frontend JavaScript logic and API communication

**Core Functions:**

1. **Identity Management:**

   - `createIdentity()` - Generate new ED25519 keypair
   - `updateIdentityDisplay()` - Update UI with identity info
   - `exportIdentity()` - Download identity backup
   - `confirmCreateNewIdentity()` - Replace current identity

2. **Conversation Management:**

   - `loadConversations()` - Load from localStorage
   - `refreshConversationsFromServer()` - Sync with server
   - `renderConversations()` - Display conversation list
   - `openChat()` - Open conversation view

3. **Messaging:**

   - `sendMessage()` - Send encrypted message with ZK proof
   - `loadMessages()` - Fetch and decrypt messages
   - `displayMessages()` - Render messages in UI
   - `startPolling()` - Real-time message updates (3s interval)

4. **Connection:**

   - `connectToUser()` - Connect to another identity
   - `generateQRCode()` - Create QR code for identity sharing

5. **UI Updates:**
   - `displayProofStatus()` - Show ZK proof verification
   - `updateTechOverlay()` - Update technical info display
   - `showToast()` - Notification system

**State Management:**

- `currentIdentity` - Current user's identity
- `currentThreadId` - Active conversation thread
- `recipientIdentity` - Other participant's identity
- `conversations` - Map of all conversations
- `pollInterval` - Polling timer reference

---

### Backend Files (`src/`)

#### `lib.rs`

**Purpose:** Core library with encryption, message storage, and data structures

**Key Components:**

1. **Message Structure:**

   ```rust
   pub struct Message {
       pub thread_id: String,
       pub sender_id: String,
       pub ciphertext: String,
       pub iv: String,
       pub timestamp: u64,
       pub message_commitment: String,
       pub endcap: Option<EndCap>,
   }
   ```

2. **MessageStore:**

   - Stores encrypted messages by thread_id
   - Manages encryption keys per thread
   - Tracks CSTATE roots per identity
   - Maintains thread roots for Merkle tree
   - VAA nonce tracking for replay protection

3. **Encryption Functions:**
   - `encrypt_message()` - XChaCha20-Poly1305 encryption
   - `decrypt_message()` - Decryption with authentication

**Dependencies:**

- `chacha20poly1305` - Authenticated encryption
- `serde` - Serialization
- `base64` - Encoding

---

#### `identity.rs`

**Purpose:** Programmable identity system using ED25519

**Key Components:**

1. **IdentityManager:**

   ```rust
   pub struct IdentityManager {
       keypair: Keypair,
       identity_hash: String,
       contacts: HashMap<String, PublicKey>,
   }
   ```

2. **Functions:**
   - `new()` - Generate random identity
   - `from_seed()` - Deterministic identity from seed
   - `sign()` - Sign messages with private key
   - `verify()` - Verify signatures with public key
   - `get_identity_hash()` - Compute hash from public key

**Features:**

- SDKey-style deterministic identity generation
- ED25519 signature scheme
- Contact management
- Attestation support (framework)

**Dependencies:**

- `ed25519-dalek` - ED25519 cryptography
- `sha2` - Hashing for identity derivation

---

#### `commitments.rs`

**Purpose:** Message and state commitments using Poseidon-style hashing

**Key Components:**

1. **StateCommitment:**

   ```rust
   pub struct StateCommitment {
       pub cstate_root: String,
       pub thread_id: String,
       pub message_commitment: String,
   }
   ```

2. **Functions:**
   - `hash_plaintext()` - Hash message content
   - `compute_message_commitment()` - Create message commitment
   - `StateCommitment::new()` - Build CSTATE root from thread roots

**Algorithm:**

- Uses SHA-256/Keccak256 (Poseidon2 simulation)
- Merkle tree construction for state
- Commitment-based privacy (only hashes on-chain)

---

#### `proofs.rs`

**Purpose:** Zero-knowledge proof generation and verification (simulated)

**Key Components:**

1. **CFCProof:**

   ```rust
   pub struct CFCProof {
       pub fingerprint: String,
       pub public_inputs: Vec<String>,
       pub proof_data: String,
   }
   ```

2. **EndCap:**

   ```rust
   pub struct EndCap {
       pub proof: CFCProof,
       pub encrypted_blob_address: String,
       pub vaa_nonce: u64,
       pub signature: String,
   }
   ```

3. **Functions:**
   - `CFCProof::for_send_message()` - Generate proof for message send
   - `verify_cfc_proof()` - Verify proof validity
   - `create_endcap()` - Create Psy Protocol EndCap format

**Note:** Currently simulated for MVP. Production would use `plonky2-hwa` for actual ZK proofs.

---

#### `bin/server.rs`

**Purpose:** Actix-web HTTP server and API endpoints

**API Endpoints:**

1. **POST `/identity/create`**

   - Creates new ED25519 identity
   - Returns: `{identity_hash, public_key}`
   - Stores identity in server state (demo only)

2. **POST `/send`**

   - Accepts: `SendRequest` with thread_id, recipient_id, plaintext
   - Encrypts message with XChaCha20-Poly1305
   - Computes message commitment
   - Generates ZK proof (simulated)
   - Creates EndCap
   - Updates CSTATE root
   - Returns: `{status, thread_id, cstate_root, proof_verified}`

3. **GET `/read/{thread_id}`**

   - Decrypts all messages in thread
   - Returns: `[{sender, text, timestamp, commitment, proof_present}]`

4. **GET `/cstate/{identity_hash}`**

   - Returns: `{cstate_root, thread_count, thread_roots}`

5. **GET `/threads/{identity_hash}`**
   - Returns all threads for an identity
   - Format: `[{thread_id, other_identity_hash, last_message_time, message_count}]`

**Server Features:**

- CORS enabled for frontend
- Static file serving
- Request logging
- Thread-safe state management (Mutex)

**Dependencies:**

- `actix-web` - Web framework
- `actix-files` - Static file serving
- `actix-cors` - CORS middleware

---

## Data Flow

### Message Sending Flow

```
1. User types message in frontend
   ↓
2. Frontend calls POST /send
   ↓
3. Server encrypts with XChaCha20-Poly1305
   ↓
4. Server computes message commitment (Poseidon2)
   ↓
5. Server generates ZK proof (CFC)
   ↓
6. Server creates EndCap with proof + signature
   ↓
7. Server updates CSTATE root (Merkle tree)
   ↓
8. Server stores encrypted message
   ↓
9. Server returns success + CSTATE root
   ↓
10. Frontend displays proof status
```

### Message Receiving Flow

```
1. Frontend polls GET /read/{thread_id} (every 3s)
   ↓
2. Server retrieves encrypted messages
   ↓
3. Server decrypts with thread key
   ↓
4. Server returns decrypted messages
   ↓
5. Frontend displays in chat UI
   ↓
6. Frontend updates conversation preview
```

### Identity Creation Flow

```
1. User clicks "Create Identity"
   ↓
2. Frontend calls POST /identity/create
   ↓
3. Server generates ED25519 keypair
   ↓
4. Server computes identity hash
   ↓
5. Server returns {identity_hash, public_key}
   ↓
6. Frontend stores in localStorage
   ↓
7. Frontend generates QR code
   ↓
8. Frontend displays identity in sidebar
```

---

## Security Features

### 1. End-to-End Encryption

- **Algorithm:** XChaCha20-Poly1305
- **Key Management:** Per-thread symmetric keys
- **Nonce:** XNonce (192-bit) for each message
- **Authentication:** Poly1305 MAC

### 2. Zero-Knowledge Proofs

- **Type:** CFC (Commitment Function Circuit)
- **Protocol:** Psy Protocol
- **Purpose:** Verify state transitions without revealing content
- **Status:** Simulated in MVP, ready for plonky2-hwa integration

### 3. Programmable Identities

- **Algorithm:** ED25519
- **Generation:** Deterministic from seed (SDKey-style)
- **Signatures:** ED25519-SHA512
- **Privacy:** Identity hash derived from public key

### 4. State Management

- **Structure:** Merkle tree (CSTATE)
- **Hashing:** Poseidon2 (simulated with SHA-256/Keccak256)
- **Root:** CSTATE root represents entire state
- **Updates:** Incremental with thread roots

### 5. Replay Protection

- **Mechanism:** VAA nonce per identity
- **Increment:** Sequential nonce for each message
- **Verification:** Server checks nonce validity

---

## Technical Stack

### Frontend

- **HTML5** - Structure
- **CSS3** - Styling (custom, no frameworks)
- **Vanilla JavaScript** - Logic (no frameworks)
- **QRCode.js** - QR code generation

### Backend

- **Rust** - Core language
- **Actix-web** - HTTP server
- **Tokio** - Async runtime
- **Serde** - Serialization

### Cryptography

- **chacha20poly1305** - Encryption
- **ed25519-dalek** - Signatures
- **sha2/sha3** - Hashing
- **base64** - Encoding

### Storage

- **In-memory** - Server-side (demo)
- **localStorage** - Client-side persistence
- **Future:** Database integration ready

---

## Key Concepts

### Thread ID

- Format: `{identity_hash_1}:{identity_hash_2}` (sorted)
- Purpose: Unique identifier for conversation
- Consistency: Both users generate same ID

### CSTATE Root

- Purpose: Merkle tree root of user's state
- Updates: On every message send
- Privacy: Only root stored, not individual messages

### Message Commitment

- Purpose: Hash of message content
- Algorithm: Poseidon2 (simulated)
- Usage: ZK proof public input

### EndCap

- Purpose: Psy Protocol message submission format
- Contains: ZK proof, encrypted blob address, VAA nonce, signature
- Usage: On-chain submission (framework ready)

---

## Current Status

### ✅ Implemented

- Identity creation and management
- End-to-end encryption
- Message sending/receiving
- ZK proof generation (simulated)
- CSTATE management
- Conversation list
- Real-time polling
- QR code sharing
- Profile/settings modal
- Technical info display
- Bidirectional messaging
- Auto-refresh conversations

### 🚧 Ready for Production

- Database persistence
- Real ZK proofs (plonky2-hwa)
- On-chain EndCap submission
- WebSocket for real-time (instead of polling)
- Message persistence across server restarts

### 📋 Future Enhancements

- Group messaging
- File attachments
- Message reactions
- Read receipts
- Push notifications
- Multi-device sync

---

## Running the Platform

### Prerequisites

- Rust 1.70+ (or compatible)
- Cargo package manager

### Start Server

```bash
cargo run --bin server
```

### Access Frontend

- Open browser: `http://127.0.0.1:8080`

### Development

```bash
# Check compilation
cargo check

# Run tests
cargo test

# Build release
cargo build --release
```

---

## API Documentation

### Base URL

```
http://127.0.0.1:8080
```

### Endpoints Summary

| Method | Endpoint                   | Description             |
| ------ | -------------------------- | ----------------------- |
| POST   | `/identity/create`         | Create new identity     |
| POST   | `/send`                    | Send encrypted message  |
| GET    | `/read/{thread_id}`        | Read decrypted messages |
| GET    | `/cstate/{identity_hash}`  | Get CSTATE root         |
| GET    | `/threads/{identity_hash}` | Get all threads         |

---

## Configuration

### Server Port

Default: `8080` (hardcoded in `server.rs`)

### Polling Interval

Default: `3000ms` (3 seconds) in `app.js`

### Encryption

- Algorithm: XChaCha20-Poly1305
- Key size: 256 bits
- Nonce size: 192 bits

---

## Troubleshooting

### Common Issues

1. **Messages not appearing:**

   - Check server is running
   - Verify thread_id format
   - Check browser console for errors

2. **Identity not loading:**

   - Check localStorage
   - Verify identity hash format
   - Try creating new identity

3. **Connection issues:**
   - Verify API_BASE URL in app.js
   - Check CORS settings
   - Ensure server is accessible

---

## License & Credits

**ZeroTrace** - Built on Psy Protocol

- End-to-end encryption
- Zero-knowledge proofs
- Programmable identities
- Privacy-first messaging

---

_Last Updated: 2024_
_Version: MVP 1.0_
