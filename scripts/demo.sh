#!/bin/bash
# ZeroTrace Demo Script
# Shows end-to-end flow: identity creation, message sending, reading

echo "🔐 ZeroTrace Demo"
echo "=================="
echo ""

# Start server in background
echo "1. Starting server..."
cargo run --bin server > /dev/null 2>&1 &
SERVER_PID=$!
sleep 3

# Create identities
echo "2. Creating identities..."
ALICE_RESPONSE=$(curl -s -X POST http://127.0.0.1:8080/identity/create)
ALICE_HASH=$(echo $ALICE_RESPONSE | jq -r '.identity_hash')
echo "   Alice: $ALICE_HASH"

BOB_RESPONSE=$(curl -s -X POST http://127.0.0.1:8080/identity/create)
BOB_HASH=$(echo $BOB_RESPONSE | jq -r '.identity_hash')
echo "   Bob: $BOB_HASH"
echo ""

# Create thread
THREAD_ID="${ALICE_HASH}:${BOB_HASH}"
echo "3. Thread ID: $THREAD_ID"
echo ""

# Send message
echo "4. Sending message with ZK proof..."
SEND_RESPONSE=$(curl -s -X POST http://127.0.0.1:8080/send \
  -H "Content-Type: application/json" \
  -d "{
    \"thread_id\": \"$THREAD_ID\",
    \"recipient_id\": \"$BOB_HASH\",
    \"plaintext\": \"Hello from ZeroTrace! This is end-to-end encrypted with ZK proofs.\",
    \"sender_identity_hash\": \"$ALICE_HASH\",
    \"sender_signature\": \"sig_stub\"
  }")
echo "$SEND_RESPONSE" | jq '.'
echo ""

# Read messages
echo "5. Reading decrypted messages..."
READ_RESPONSE=$(curl -s "http://127.0.0.1:8080/read/$THREAD_ID")
echo "$READ_RESPONSE" | jq '.'
echo ""

# Check CSTATE
echo "6. Checking CSTATE root..."
CSTATE_RESPONSE=$(curl -s "http://127.0.0.1:8080/cstate/$ALICE_HASH")
echo "$CSTATE_RESPONSE" | jq '.'
echo ""

# Cleanup
echo "7. Stopping server..."
kill $SERVER_PID 2>/dev/null
echo "✅ Demo complete!"

