# ZeroTrace: End-to-End Encrypted Messaging DApp

**Leveraging Psy Protocol's zero-knowledge proofs for decentralized messaging with absolute privacy.**

## 🚀 Quick Start

### Prerequisites

- **Rust installed** (if not, see `INSTALL_RUST.md`)
- Modern web browser

### Run Server

```bash
cargo run --bin server
```

Open browser: **http://127.0.0.1:8080**

### Demo with 2 Browsers

1. **Browser 1:**

   - Open http://127.0.0.1:8080
   - Click "Create New Identity"
   - Copy identity hash or show QR code

2. **Browser 2:**

   - Open http://127.0.0.1:8080
   - Click "Create New Identity"
   - Paste Browser 1's identity hash → Click "Connect"

3. **Both:** Send messages and watch ZK proofs in real-time!

## ✅ Features

- End-to-end encryption (XChaCha20-Poly1305)
- Zero-knowledge proofs (Psy Protocol CFC)
- Programmable identities (SDKey-style)
- Privacy-preserving commitments
- Real-time messaging UI

## 📁 Project Structure

```
src/
  ├── lib.rs          # Core encryption & messages
  ├── identity.rs     # Identity system
  ├── commitments.rs  # Poseidon commitments
  ├── proofs.rs       # ZK proof generation
  └── bin/
      ├── server.rs   # API server
      └── client_example.rs

static/
  ├── index.html      # Web UI
  ├── style.css
  └── app.js
```

## 🔧 Check Code

```bash
# Check compilation
cargo check

# Run tests
cargo test

# Build
cargo build --release
```

## 📡 API Endpoints

- `POST /identity/create` - Create identity
- `POST /send` - Send encrypted message with ZK proof
- `GET /read/{thread_id}` - Read decrypted messages
- `GET /cstate/{identity_hash}` - Get CSTATE root

## 🎯 Hackathon Submission

**Project ID:** #1556718

Built on Psy Protocol with ZK proofs, programmable identities, and privacy-preserving architecture.
