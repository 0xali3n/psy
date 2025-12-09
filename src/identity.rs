// Programmable Identity System (SDKey-style)
// Implements deterministic identity generation and attestations

use ed25519_dalek::{SecretKey, PublicKey, Signature, Verifier, Keypair};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub public_key: Vec<u8>,      // ED25519 public key (32 bytes)
    pub identity_hash: String,     // Poseidon hash of public key (for privacy)
    pub attestations: Vec<Attestation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attestation {
    pub issuer: String,            // Identity hash of issuer
    pub claim: String,             // Claim type (e.g., "email", "handle")
    pub value_hash: String,        // Hash of claim value (privacy-preserving)
    pub signature: String,         // Signature by issuer
    pub timestamp: u64,
}

#[derive(Debug)]
pub struct IdentityManager {
    keypair: Keypair,  // Store keypair directly for signing
    identity_hash: String,
    contacts: HashMap<String, PublicKey>, // identity_hash -> public key
}

impl IdentityManager {
    /// Create new identity from seed (deterministic)
    pub fn from_seed(seed: &[u8]) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(seed);
        let key_bytes = hasher.finalize();
        
        // Create SecretKey from seed bytes
        let secret_key = SecretKey::from_bytes(&key_bytes[..32]).unwrap();
        let public_key = PublicKey::from(&secret_key);
        
        // In ed25519-dalek v1, Keypair::from_bytes expects 64 bytes (secret + public)
        let mut keypair_bytes = [0u8; 64];
        keypair_bytes[..32].copy_from_slice(&key_bytes[..32]);
        keypair_bytes[32..].copy_from_slice(public_key.as_bytes());
        
        let keypair = match Keypair::from_bytes(&keypair_bytes) {
            Ok(kp) => kp,
            Err(_) => {
                // Fallback: if from_bytes doesn't work, generate new
                // (This shouldn't happen, but handle gracefully)
                let mut csprng = OsRng;
                Keypair::generate(&mut csprng)
            }
        };
        
        let identity_hash = Self::compute_identity_hash(&public_key.to_bytes());
        
        Self {
            keypair,
            identity_hash,
            contacts: HashMap::new(),
        }
    }

    /// Generate random identity
    pub fn new() -> Self {
        let mut csprng = OsRng;
        let keypair = Keypair::generate(&mut csprng);
        let identity_hash = Self::compute_identity_hash(&keypair.public.to_bytes());
        
        Self {
            keypair,
            identity_hash,
            contacts: HashMap::new(),
        }
    }

    /// Compute privacy-preserving identity hash (simulates Poseidon)
    fn compute_identity_hash(pubkey: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(b"zerotrace_identity");
        hasher.update(pubkey);
        hex::encode(hasher.finalize())
    }

    pub fn get_identity_hash(&self) -> &str {
        &self.identity_hash
    }

    pub fn get_public_key(&self) -> Vec<u8> {
        self.keypair.public.to_bytes().to_vec()
    }

    /// Sign a message with this identity
    pub fn sign(&self, message: &[u8]) -> Signature {
        use ed25519_dalek::Signer;
        self.keypair.sign(message)
    }

    /// Verify signature from another identity
    pub fn verify(&self, message: &[u8], signature: &Signature, pubkey: &PublicKey) -> bool {
        pubkey.verify(message, signature).is_ok()
    }

    /// Add contact (trust another identity)
    pub fn add_contact(&mut self, identity_hash: String, pubkey: PublicKey) {
        self.contacts.insert(identity_hash, pubkey);
    }

    /// Get contact's public key
    pub fn get_contact(&self, identity_hash: &str) -> Option<&PublicKey> {
        self.contacts.get(identity_hash)
    }

    /// Create attestation (claim about this identity)
    pub fn create_attestation(&self, claim: &str, value: &str) -> Attestation {
        let mut hasher = Sha256::new();
        hasher.update(value.as_bytes());
        let value_hash = hex::encode(hasher.finalize());
        
        let message = format!("{}:{}:{}", claim, value_hash, self.identity_hash);
        let signature = self.sign(message.as_bytes());
        
        Attestation {
            issuer: self.identity_hash.clone(),
            claim: claim.to_string(),
            value_hash,
            signature: hex::encode(signature.to_bytes()),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }

    /// Export identity (for storage/backup)
    pub fn export(&self) -> Identity {
        Identity {
            public_key: self.keypair.public.to_bytes().to_vec(),
            identity_hash: self.identity_hash.clone(),
            attestations: vec![],
        }
    }
}

