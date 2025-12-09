# Install Rust (Windows)

## Quick Install

### Option 1: Using rustup (Recommended)

1. **Download rustup-init.exe:**
   - Go to: https://rustup.rs/
   - Or direct download: https://win.rustup.rs/x86_64

2. **Run rustup-init.exe:**
   - Double-click the downloaded file
   - Press Enter to proceed with default installation
   - Wait for installation to complete

3. **Restart PowerShell/Terminal:**
   - Close and reopen your terminal
   - Or run: `refreshenv` (if using Git Bash)

4. **Verify installation:**
   ```bash
   cargo --version
   rustc --version
   ```

### Option 2: Using Chocolatey (if you have it)

```bash
choco install rust
```

### Option 3: Using Scoop (if you have it)

```bash
scoop install rust
```

## After Installation

1. **Close and reopen PowerShell**
2. **Verify:**
   ```bash
   cargo --version
   ```
3. **Then run:**
   ```bash
   cargo run --bin server
   ```

## Troubleshooting

- **Still not found?** Restart your computer
- **PATH issues?** Rust should add itself to PATH automatically
- **Need help?** Check: https://www.rust-lang.org/tools/install

