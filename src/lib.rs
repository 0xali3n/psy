pub mod identity;
pub mod commitments;
pub mod proofs;

use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    XChaCha20Poly1305, XNonce,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use proofs::EndCap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub thread_id: String,
    pub sender_id: String,          // Identity hash (privacy-preserving)
    pub ciphertext: String,          // base64 encoded
    pub iv: String,                  // base64 encoded nonce
    pub timestamp: u64,
    pub message_commitment: String,  // Poseidon commitment
    pub endcap: Option<EndCap>,      // ZK proof + submission data
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendRequest {
    pub thread_id: String,
    pub recipient_id: String,        // Identity hash of recipient
    pub plaintext: String,
    pub sender_identity_hash: String, // Sender's identity hash
    pub sender_signature: String,     // Signature proving ownership
}

pub struct MessageStore {
    messages: HashMap<String, Vec<Message>>,
    keys: HashMap<String, [u8; 32]>,           // thread_id -> encryption key
    cstate_roots: HashMap<String, String>,     // identity_hash -> current CSTATE root
    thread_roots: HashMap<String, Vec<String>>, // identity_hash -> list of thread roots
    vaa_nonces: HashMap<String, u64>,          // identity_hash -> last VAA nonce (replay protection)
}

impl MessageStore {
    pub fn new() -> Self {
        Self {
            messages: HashMap::new(),
            keys: HashMap::new(),
            cstate_roots: HashMap::new(),
            thread_roots: HashMap::new(),
            vaa_nonces: HashMap::new(),
        }
    }

    pub fn get_or_create_key(&mut self, thread_id: &str) -> [u8; 32] {
        *self.keys.entry(thread_id.to_string()).or_insert_with(|| {
            let mut key = [0u8; 32];
            rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut key);
            key
        })
    }

    pub fn get_cstate_root(&self, identity_hash: &str) -> String {
        self.cstate_roots.get(identity_hash)
            .cloned()
            .unwrap_or_else(|| "0".repeat(64))
    }

    pub fn update_cstate_root(&mut self, identity_hash: &str, new_root: String) {
        self.cstate_roots.insert(identity_hash.to_string(), new_root);
    }

    pub fn add_thread_root(&mut self, identity_hash: &str, thread_root: String) {
        self.thread_roots
            .entry(identity_hash.to_string())
            .or_insert_with(Vec::new)
            .push(thread_root);
    }

    pub fn get_thread_roots(&self, identity_hash: &str) -> Vec<String> {
        self.thread_roots.get(identity_hash)
            .cloned()
            .unwrap_or_default()
    }

    pub fn get_next_vaa_nonce(&mut self, identity_hash: &str) -> u64 {
        let nonce = self.vaa_nonces.get(identity_hash).copied().unwrap_or(0) + 1;
        self.vaa_nonces.insert(identity_hash.to_string(), nonce);
        nonce
    }

    pub fn add_message(&mut self, message: Message) {
        self.messages
            .entry(message.thread_id.clone())
            .or_insert_with(Vec::new)
            .push(message);
    }

    pub fn get_messages(&self, thread_id: &str) -> Option<&Vec<Message>> {
        self.messages.get(thread_id)
    }
    
    pub fn get_all_thread_ids(&self) -> Vec<String> {
        self.messages.keys().cloned().collect()
    }
}

pub fn encrypt_message(key: &[u8; 32], plaintext: &str) -> anyhow::Result<(Vec<u8>, XNonce)> {
    let cipher = XChaCha20Poly1305::new(key.into());
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;
    Ok((ciphertext, nonce))
}

pub fn decrypt_message(key: &[u8; 32], ciphertext: &[u8], nonce: &XNonce) -> anyhow::Result<String> {
    let cipher = XChaCha20Poly1305::new(key.into());
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;
    String::from_utf8(plaintext).map_err(|e| anyhow::anyhow!("Invalid UTF-8: {}", e))
}

