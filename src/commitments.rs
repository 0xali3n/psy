// Poseidon-style commitment hashing for message privacy
// Simulates Poseidon2 hash function for Psy Protocol compatibility

use sha2::{Sha256, Digest};
use sha3::Keccak256;
use serde::{Deserialize, Serialize};

/// Compute message commitment (simulates Poseidon hash)
/// In production, this would use actual Poseidon2 from Psy repos
pub fn compute_message_commitment(
    sender_hash: &str,
    thread_id: &str,
    nonce: &[u8],
    plaintext_hash: &str,
) -> String {
    // Simulate Poseidon2: use double-hash for commitment
    let mut hasher = Sha256::new();
    hasher.update(b"zerotrace_commitment_v1");
    hasher.update(sender_hash.as_bytes());
    hasher.update(thread_id.as_bytes());
    hasher.update(nonce);
    hasher.update(plaintext_hash.as_bytes());
    let first = hasher.finalize();
    
    // Second round (simulates Poseidon permutation)
    let mut hasher2 = Keccak256::new();
    hasher2.update(&first);
    hasher2.update(b"poseidon2_simulation");
    hex::encode(hasher2.finalize())
}

/// Compute CSTATE root (Merkle root of user's contract state)
/// In production, this would be a real Merkle tree with Poseidon
pub fn compute_cstate_root(thread_roots: &[String]) -> String {
    if thread_roots.is_empty() {
        return "0".repeat(64);
    }
    
    // Simple Merkle root simulation (binary tree)
    let mut current = thread_roots.to_vec();
    
    while current.len() > 1 {
        let mut next = Vec::new();
        for chunk in current.chunks(2) {
            if chunk.len() == 2 {
                let mut hasher = Sha256::new();
                hasher.update(chunk[0].as_bytes());
                hasher.update(chunk[1].as_bytes());
                next.push(hex::encode(hasher.finalize()));
            } else {
                next.push(chunk[0].clone());
            }
        }
        current = next;
    }
    
    current[0].clone()
}

/// Compute plaintext hash (for commitment without revealing content)
pub fn hash_plaintext(plaintext: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(plaintext.as_bytes());
    hex::encode(hasher.finalize())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateCommitment {
    pub cstate_root: String,       // Merkle root of contract state
    pub thread_id: String,
    pub message_commitment: String, // Commitment to this message
    pub timestamp: u64,
}

impl StateCommitment {
    pub fn new(thread_id: String, message_commitment: String, existing_roots: &[String]) -> Self {
        let mut all_roots = existing_roots.to_vec();
        all_roots.push(message_commitment.clone());
        let cstate_root = compute_cstate_root(&all_roots);
        
        Self {
            cstate_root,
            thread_id,
            message_commitment,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }
}

