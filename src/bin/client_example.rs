// Example client demonstrating ZeroTrace usage
// Shows identity creation, message sending with ZK proofs

use zerotrace::identity::IdentityManager;
use serde_json::json;
use std::io;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔐 ZeroTrace Client Example\n");
    
    // Create identity
    println!("1. Creating identity...");
    let alice = IdentityManager::new();
    let alice_hash = alice.get_identity_hash();
    println!("   Alice's identity hash: {}", alice_hash);
    
    let bob = IdentityManager::new();
    let bob_hash = bob.get_identity_hash();
    println!("   Bob's identity hash: {}\n", bob_hash);
    
    // Create thread ID
    let thread_id = format!("{}:{}", alice_hash, bob_hash);
    println!("2. Thread ID: {}\n", thread_id);
    
    // Send message
    println!("3. Sending message...");
    let plaintext = "Hello from ZeroTrace! This message is end-to-end encrypted with ZK proofs.";
    
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:8080/send")
        .json(&json!({
            "thread_id": thread_id,
            "recipient_id": bob_hash,
            "plaintext": plaintext,
            "sender_identity_hash": alice_hash,
            "sender_signature": "sig_stub" // In production, sign with alice's key
        }))
        .send()
        .await?;
    
    if response.status().is_success() {
        let result: serde_json::Value = response.json().await?;
        println!("   ✅ Message sent!");
        println!("   Response: {}\n", json::to_string_pretty(&result)?);
    } else {
        println!("   ❌ Error: {}", response.status());
        return Ok(());
    }
    
    // Read messages
    println!("4. Reading messages...");
    let response = client
        .get(&format!("http://127.0.0.1:8080/read/{}", thread_id))
        .send()
        .await?;
    
    if response.status().is_success() {
        let messages: serde_json::Value = response.json().await?;
        println!("   Messages:\n{}", json::to_string_pretty(&messages)?);
    }
    
    // Check CSTATE
    println!("\n5. Checking CSTATE root...");
    let response = client
        .get(&format!("http://127.0.0.1:8080/cstate/{}", alice_hash))
        .send()
        .await?;
    
    if response.status().is_success() {
        let cstate: serde_json::Value = response.json().await?;
        println!("   CSTATE: {}", json::to_string_pretty(&cstate)?);
    }
    
    Ok(())
}

