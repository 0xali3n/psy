use actix_web::{web, App, HttpResponse, HttpServer, Result, middleware::Logger};
use actix_files::Files;
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;
use zerotrace::{
    decrypt_message, encrypt_message, Message, MessageStore, SendRequest,
    identity::IdentityManager,
    commitments::{compute_message_commitment, hash_plaintext, StateCommitment},
    proofs::{CFCProof, create_endcap, verify_cfc_proof},
};
use chacha20poly1305::XNonce;
use base64::{Engine as _, engine::general_purpose};
use hex;

type AppState = web::Data<Mutex<MessageStore>>;
type IdentityState = web::Data<Mutex<std::collections::HashMap<String, IdentityManager>>>;

async fn send_message(
    req: web::Json<SendRequest>,
    state: AppState,
    identity_state: IdentityState,
) -> Result<HttpResponse> {
    println!("📨 [SEND] Received message from {}", &req.sender_identity_hash[..16]);
    println!("   Thread: {}", &req.thread_id[..40.min(req.thread_id.len())]);
    println!("   Plaintext length: {} bytes", req.plaintext.len());
    
    let mut store = state.lock().unwrap();
    let mut identities = identity_state.lock().unwrap();
    
    // Get or create sender identity (for demo, create if not exists)
    let sender = identities.entry(req.sender_identity_hash.clone())
        .or_insert_with(|| {
            println!("   🔑 Creating identity from seed");
            IdentityManager::from_seed(req.sender_identity_hash.as_bytes())
        });
    
    // Encrypt message
    println!("   🔐 Encrypting message...");
    let key = store.get_or_create_key(&req.thread_id);
    let (ciphertext, nonce) = encrypt_message(&key, &req.plaintext)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    println!("   ✅ Encryption complete ({} bytes)", ciphertext.len());
    
    // Compute commitments
    println!("   📝 Computing message commitment...");
    let plaintext_hash = hash_plaintext(&req.plaintext);
    let nonce_bytes = nonce.as_slice();
    let message_commitment = compute_message_commitment(
        &req.sender_identity_hash,
        &req.thread_id,
        nonce_bytes,
        &plaintext_hash,
    );
    
    // Get current CSTATE root
    let start_root = store.get_cstate_root(&req.sender_identity_hash);
    
    // Create state commitment
    let thread_roots = store.get_thread_roots(&req.sender_identity_hash);
    let state_commitment = StateCommitment::new(
        req.thread_id.clone(),
        message_commitment.clone(),
        &thread_roots,
    );
    
    // Generate ZK proof (simulated)
    println!("   🔍 Generating ZK proof...");
    let proof = CFCProof::for_send_message(
        &start_root,
        &state_commitment.cstate_root,
        &message_commitment,
    );
    
    // Verify proof (should always pass for stub)
    if !verify_cfc_proof(&proof) {
        println!("   ❌ Proof verification failed!");
        return Err(actix_web::error::ErrorInternalServerError("Proof verification failed"));
    }
    println!("   ✅ ZK proof verified");
    
    // Create EndCap
    let vaa_nonce = store.get_next_vaa_nonce(&req.sender_identity_hash);
    let signature = hex::encode(sender.sign(format!("{}:{}", message_commitment, vaa_nonce).as_bytes()).to_bytes());
    
    let encrypted_blob_address = format!("da://encrypted/{}", uuid::Uuid::new_v4());
    let endcap = create_endcap(proof, encrypted_blob_address, vaa_nonce, signature);
    
    // Update state
    store.update_cstate_root(&req.sender_identity_hash, state_commitment.cstate_root.clone());
    store.add_thread_root(&req.sender_identity_hash, message_commitment.clone());
    println!("   📊 CSTATE root updated: {}", &state_commitment.cstate_root[..16]);
    
    // Create message
    let message = Message {
        thread_id: req.thread_id.clone(),
        sender_id: req.sender_identity_hash.clone(),
        ciphertext: general_purpose::STANDARD.encode(&ciphertext),
        iv: general_purpose::STANDARD.encode(nonce_bytes),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        message_commitment,
        endcap: Some(endcap),
    };
    
    store.add_message(message.clone());
    println!("   ✅ Message stored successfully");
    println!("   📬 Total messages in thread: {}", store.get_messages(&req.thread_id).map(|m| m.len()).unwrap_or(0));
    
    Ok(HttpResponse::Ok().json(json!({
        "status": "sent",
        "thread_id": message.thread_id,
        "message_id": message.timestamp,
        "cstate_root": state_commitment.cstate_root,
        "proof_verified": true
    })))
}

async fn get_messages(
    path: web::Path<String>,
    state: AppState,
) -> Result<HttpResponse> {
    let store = state.lock().unwrap();
    let thread_id = path.into_inner();
    
    match store.get_messages(&thread_id) {
        Some(messages) => Ok(HttpResponse::Ok().json(messages)),
        None => Ok(HttpResponse::Ok().json(json!([]))),
    }
}

async fn decrypt_and_read(
    path: web::Path<String>,
    state: AppState,
) -> Result<HttpResponse> {
    let mut store = state.lock().unwrap();
    let thread_id = path.into_inner();
    
    // Reduced logging - only log first read or when messages change
    let key = store.get_or_create_key(&thread_id);
    let empty_vec = Vec::new();
    let messages = store.get_messages(&thread_id).unwrap_or(&empty_vec);
    
    let mut decrypted = Vec::new();
    for msg in messages {
        let ciphertext = general_purpose::STANDARD
            .decode(&msg.ciphertext)
            .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
        let nonce_bytes = general_purpose::STANDARD
            .decode(&msg.iv)
            .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
        let nonce = XNonce::from_slice(&nonce_bytes);
        
        match decrypt_message(&key, &ciphertext, nonce) {
            Ok(plaintext) => {
                decrypted.push(json!({
                    "sender": msg.sender_id,
                    "text": plaintext,
                    "timestamp": msg.timestamp,
                    "commitment": msg.message_commitment,
                    "proof_present": msg.endcap.is_some()
                }));
            }
            Err(e) => {
                eprintln!("Decrypt error: {}", e);
            }
        }
    }
    
    Ok(HttpResponse::Ok().json(decrypted))
}

async fn create_identity(
    identity_state: IdentityState,
) -> Result<HttpResponse> {
    println!("🆔 [IDENTITY] Creating new identity...");
    let identity = IdentityManager::new();
    let identity_hash = identity.get_identity_hash().to_string();
    let public_key = identity.get_public_key();
    
    println!("   ✅ Identity created: {}", &identity_hash[..16]);
    println!("   🔑 Public key: {} bytes", public_key.len());
    
    // Store identity (in production, this would be client-side only)
    identity_state.lock().unwrap().insert(identity_hash.clone(), identity);
    
    Ok(HttpResponse::Ok().json(json!({
        "identity_hash": identity_hash,
        "public_key": hex::encode(public_key),
        "message": "Save your identity hash and private key securely!"
    })))
}

async fn get_cstate(identity_hash: web::Path<String>, state: AppState) -> Result<HttpResponse> {
    let store = state.lock().unwrap();
    let hash = identity_hash.into_inner();
    let root = store.get_cstate_root(&hash);
    let thread_roots = store.get_thread_roots(&hash);
    
    Ok(HttpResponse::Ok().json(json!({
        "cstate_root": root,
        "thread_count": thread_roots.len(),
        "thread_roots": thread_roots
    })))
}

async fn get_threads_for_identity(
    path: web::Path<String>,
    state: AppState,
) -> Result<HttpResponse> {
    let store = state.lock().unwrap();
    let identity_hash = path.into_inner();
    
    // Get all threads that contain messages from or to this identity
    let mut threads = Vec::new();
    let thread_ids = store.get_all_thread_ids();
    
    for thread_id in thread_ids {
        // Thread ID format is "hash1:hash2" (sorted)
        let parts: Vec<&str> = thread_id.split(':').collect();
        if parts.len() == 2 {
            if parts[0] == identity_hash || parts[1] == identity_hash {
                if let Some(messages) = store.get_messages(&thread_id) {
                    if !messages.is_empty() {
                        // Get the other participant's hash
                        let other_hash = if parts[0] == identity_hash {
                            parts[1].to_string()
                        } else {
                            parts[0].to_string()
                        };
                        
                        // Get last message
                        let last_msg = messages.last().unwrap();
                        threads.push(json!({
                            "thread_id": thread_id,
                            "other_identity_hash": other_hash,
                            "last_message_time": last_msg.timestamp,
                            "message_count": messages.len()
                        }));
                    }
                }
            }
        }
    }
    
    Ok(HttpResponse::Ok().json(threads))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let store = web::Data::new(Mutex::new(MessageStore::new()));
    let identities = web::Data::new(Mutex::new(std::collections::HashMap::<String, IdentityManager>::new()));
    
    println!("🚀 ZeroTrace - End-to-End Encrypted Messaging DApp");
    println!("   Built on Psy Protocol with ZK Proofs");
    println!("   Server starting on http://127.0.0.1:8080");
    println!("\n🌐 Frontend: http://127.0.0.1:8080");
    println!("\nAPI Endpoints:");
    println!("  POST /identity/create - Create new identity");
    println!("  POST /send - Send encrypted message with ZK proof");
    println!("  GET  /messages/{{thread_id}} - Get encrypted messages");
    println!("  GET  /read/{{thread_id}} - Read decrypted messages");
    println!("  GET  /cstate/{{identity_hash}} - Get CSTATE root");
    println!("  GET  /threads/{{identity_hash}} - Get all threads for identity");
    
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();
        
        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .app_data(store.clone())
            .app_data(identities.clone())
            .route("/identity/create", web::post().to(create_identity))
            .route("/send", web::post().to(send_message))
            .route("/messages/{thread_id}", web::get().to(get_messages))
            .route("/read/{thread_id}", web::get().to(decrypt_and_read))
            .route("/cstate/{identity_hash}", web::get().to(get_cstate))
            .route("/threads/{identity_hash}", web::get().to(get_threads_for_identity))
            .service(Files::new("/", "./static").index_file("index.html"))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
