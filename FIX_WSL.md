# Fix for WSL Rust Version Issue

## Problem
Cargo 1.84.1 doesn't support `edition2024` required by `ed25519-dalek` v2.

## Solution

### Option 1: Update Rust (Recommended)
```bash
rustup update stable
```

If that doesn't work, install latest:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup default stable
```

### Option 2: Use Compatible Dependencies (Already Fixed)
I've pinned `ed25519-dalek` to v1.0 which is compatible with older Rust versions.

Now try:
```bash
cargo clean
cargo run --bin server
```

## Verify Rust Version
```bash
rustc --version
cargo --version
```

You need Rust 1.70+ for this project.

