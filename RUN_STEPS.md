# Quick Run Steps

## 0. Install Rust (if not installed)

See `INSTALL_RUST.md` for installation instructions.

## 1. Start Server

```bash
cargo run --bin server
```

## 2. Open Browser

Go to: **http://127.0.0.1:8080**

## 3. Test with 2 Browsers

**Browser 1:**

- Click "Create New Identity"
- Copy the identity hash

**Browser 2:**

- Click "Create New Identity"
- Paste Browser 1's identity hash
- Click "Connect"

**Both:**

- Type message → Click "Send (with ZK Proof)"
- See ZK proof status update
- Messages appear in real-time

## 4. Check Everything Works

✅ Identity created  
✅ QR code generated  
✅ Connection established  
✅ Messages sent/received  
✅ ZK proof status shows  
✅ CSTATE root updates  
✅ All Psy Protocol features active

## Troubleshooting

- **Cargo not found?** Install Rust (see `INSTALL_RUST.md`)
- **Edition2024 error?** Run `cargo clean` then try again (dependencies fixed)
- **Server won't start?** Check port 8080 is free
- **Frontend not loading?** Make sure `static/` folder exists
- **Messages not appearing?** Check both browsers connected to same thread
