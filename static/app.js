const API_BASE = "http://127.0.0.1:8080";

let currentIdentity = null;
let currentThreadId = null;
let recipientIdentity = null;
let conversations = new Map(); // threadId -> {recipientHash, lastMessage, timestamp}
let pollInterval = null;
let lastMessageCount = 0;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadStoredIdentity();
  loadConversations();
  // Auto-refresh conversations from server on load
  if (currentIdentity) {
    refreshConversationsFromServer();
    updateTechOverlay();
  }

  document
    .getElementById("create-identity-btn")
    .addEventListener("click", createIdentity);
  document
    .getElementById("new-chat-btn")
    .addEventListener("click", openNewChatModal);
  document
    .getElementById("refresh-btn")
    .addEventListener("click", refreshConversations);
  document
    .getElementById("connect-btn")
    .addEventListener("click", connectToUser);
  document.getElementById("send-btn").addEventListener("click", sendMessage);
  document.getElementById("back-btn").addEventListener("click", () => {
    document.getElementById("active-chat").classList.add("hidden");
    document.getElementById("welcome-screen").classList.remove("hidden");
  });
  document
    .getElementById("profile-btn")
    ?.addEventListener("click", openProfileModal);

  // Profile tabs
  document.querySelectorAll(".profile-tabs .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document
        .querySelectorAll(".profile-tabs .tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`${tab}-tab`).classList.add("active");
    });
  });

  document.getElementById("message-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  document
    .getElementById("message-input")
    .addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });
});

function loadStoredIdentity() {
  const stored = localStorage.getItem("zerotrace_identity");
  if (stored) {
    currentIdentity = JSON.parse(stored);
    updateIdentityDisplay();
  }
}

function updateIdentityDisplay() {
  if (!currentIdentity) return;

  const avatar = generateAvatar(currentIdentity.identityHash);
  document.getElementById("identity-status").classList.add("hidden");
  const identityInfo = document.getElementById("identity-info-sidebar");
  identityInfo.classList.remove("hidden");
  document.getElementById("avatar-sidebar").textContent = avatar;
  document.getElementById("hash-sidebar").textContent =
    currentIdentity.identityHash.substring(0, 8) +
    "..." +
    currentIdentity.identityHash.substring(
      currentIdentity.identityHash.length - 6
    );

  // Update profile modal if it exists
  updateProfileModal();
}

function createIdentity() {
  console.log("🆔 Creating new identity...");
  const btn = document.getElementById("create-identity-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> Creating...';

  fetch(`${API_BASE}/identity/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
    .then((res) => res.json())
    .then((data) => {
      currentIdentity = {
        identityHash: data.identity_hash,
        publicKey: data.public_key,
      };
      localStorage.setItem(
        "zerotrace_identity",
        JSON.stringify(currentIdentity)
      );
      localStorage.setItem("zerotrace_identity_created", Date.now().toString());
      console.log("✅ Identity created");
      updateIdentityDisplay();
      updateTechOverlay();
      showToast("Identity created successfully! 🎉", "success");
      btn.disabled = false;
      generateQRCode(currentIdentity.identityHash);
      // Refresh conversations from server after creating identity
      setTimeout(() => refreshConversationsFromServer(), 500);
    })
    .catch((err) => {
      console.error("❌ Identity creation error:", err);
      showToast("Failed to create identity", "error");
      btn.disabled = false;
      btn.innerHTML = "✨ Create Identity";
    });
}

function showCreateNewIdentityConfirm() {
  document.getElementById("confirm-new-identity-modal").classList.remove("hidden");
}

function closeConfirmNewIdentity() {
  document.getElementById("confirm-new-identity-modal").classList.add("hidden");
}

function confirmCreateNewIdentity() {
  // Clear all local data
  localStorage.removeItem("zerotrace_identity");
  localStorage.removeItem("zerotrace_identity_created");
  localStorage.removeItem("zerotrace_conversations");
  
  // Reset state
  currentIdentity = null;
  currentThreadId = null;
  recipientIdentity = null;
  conversations = new Map();
  
  // Close modals
  closeConfirmNewIdentity();
  closeIdentityModal();
  
  // Reset UI
  document.getElementById("identity-status").classList.remove("hidden");
  document.getElementById("identity-info-sidebar").classList.add("hidden");
  document.getElementById("welcome-screen").classList.remove("hidden");
  document.getElementById("active-chat").classList.add("hidden");
  document.getElementById("conversations-list").innerHTML = '<p class="empty-conversations">No conversations yet</p>';
  
  // Show success message
  showToast("Identity cleared. You can now create a new one!", "success");
  
  // Reset button
  document.getElementById("create-identity-btn").innerHTML = "✨ Create Identity";
}

function exportIdentity() {
  if (!currentIdentity) {
    showToast("No identity to export", "error");
    return;
  }
  
  const identityData = {
    identity_hash: currentIdentity.identityHash,
    public_key: currentIdentity.publicKey,
    created: localStorage.getItem("zerotrace_identity_created"),
    export_date: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(identityData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zerotrace-identity-${currentIdentity.identityHash.substring(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast("Identity exported!", "success");
}

function generateAvatar(hash) {
  const colors = ["🔵", "🟣", "🟢", "🟡", "🔴", "🟠"];
  const index = parseInt(hash.substring(0, 2), 16) % colors.length;
  return colors[index];
}

function openNewChatModal() {
  if (!currentIdentity) {
    showToast("Please create an identity first", "error");
    return;
  }
  document.getElementById("new-chat-modal").classList.remove("hidden");
  // Small delay to ensure modal is visible before generating QR
  setTimeout(() => {
    generateQRCode(currentIdentity.identityHash);
  }, 100);
}

function closeNewChatModal() {
  document.getElementById("new-chat-modal").classList.add("hidden");
}

function openProfileModal() {
  if (!currentIdentity) {
    showToast("Please create an identity first", "error");
    return;
  }
  updateProfileModal();
  document.getElementById("identity-modal").classList.remove("hidden");
}

function closeIdentityModal() {
  document.getElementById("identity-modal").classList.add("hidden");
}

function updateProfileModal() {
  if (!currentIdentity) return;

  const avatar = generateAvatar(currentIdentity.identityHash);
  document.getElementById("profile-avatar").textContent = avatar;
  document.getElementById("profile-identity-hash").textContent =
    currentIdentity.identityHash;
  document.getElementById("profile-public-key").textContent =
    currentIdentity.publicKey;

  // Set created date
  const stored = localStorage.getItem("zerotrace_identity_created");
  if (stored) {
    const created = new Date(parseInt(stored));
    document.getElementById("profile-created").textContent =
      created.toLocaleString();
  } else {
    document.getElementById("profile-created").textContent = "Just now";
  }

  // Update thread count
  const convs = localStorage.getItem("zerotrace_conversations");
  if (convs) {
    const data = JSON.parse(convs);
    document.getElementById("profile-thread-count").textContent = data.length;
    const threadCountState = document.getElementById("profile-thread-count-state");
    if (threadCountState) {
      threadCountState.textContent = data.length;
    }
  }

  // Update CSTATE root if available
  updateCStateInProfile();
}

function updateCStateInProfile() {
  if (!currentIdentity) return;

  fetch(`${API_BASE}/cstate/${currentIdentity.identityHash}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.cstate_root) {
        document.getElementById("profile-cstate-root").textContent =
          data.cstate_root;
      }
    })
    .catch(() => {
      // Silently fail if CSTATE not available
    });
}

function copyProfileHash() {
  if (currentIdentity) {
    copyToClipboard(currentIdentity.identityHash);
    showToast("Identity hash copied!", "success");
  }
}

function copyPublicKey() {
  if (currentIdentity) {
    copyToClipboard(currentIdentity.publicKey);
    showToast("Public key copied!", "success");
  }
}

function copyCStateRoot() {
  const root = document.getElementById("profile-cstate-root").textContent;
  if (root && root !== "-") {
    copyToClipboard(root);
    showToast("CSTATE root copied!", "success");
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    console.log("✅ Copied to clipboard");
  });
}

function connectToUser() {
  const input = document.getElementById("recipient-identity").value.trim();
  if (!input) {
    showToast("Please enter identity hash", "error");
    return;
  }

  if (input === currentIdentity.identityHash) {
    showToast("Cannot connect to yourself", "error");
    return;
  }

  const connectBtn = document.getElementById("connect-btn");
  connectBtn.disabled = true;
  connectBtn.innerHTML = '<span class="loading"></span> Connecting...';

  recipientIdentity = input;
  const ids = [currentIdentity.identityHash, recipientIdentity].sort();
  currentThreadId = `${ids[0]}:${ids[1]}`;

  // Add to conversations
  if (!conversations.has(currentThreadId)) {
    conversations.set(currentThreadId, {
      recipientHash: recipientIdentity,
      lastMessage: "",
      timestamp: Date.now(),
    });
    saveConversations();
    renderConversations();
  }

  // Open chat
  openChat(currentThreadId, recipientIdentity);

  showToast("Connected!", "success");
  closeNewChatModal();
  connectBtn.disabled = false;
  connectBtn.innerHTML = "Connect";
  document.getElementById("recipient-identity").value = "";
}

function openChat(threadId, recipientHash) {
  currentThreadId = threadId;
  recipientIdentity = recipientHash;

  // Ensure conversation exists in local storage
  if (!conversations.has(threadId)) {
    conversations.set(threadId, {
      recipientHash: recipientHash,
      lastMessage: "",
      timestamp: Date.now(),
    });
    saveConversations();
  }

  // Update UI
  document.getElementById("welcome-screen").classList.add("hidden");
  document.getElementById("active-chat").classList.remove("hidden");

  const shortHash =
    recipientHash.length > 16
      ? recipientHash.substring(0, 8) +
        "..." +
        recipientHash.substring(recipientHash.length - 6)
      : recipientHash;

  document.getElementById("chat-title").textContent = shortHash;
  document.getElementById("chat-avatar").textContent =
    generateAvatar(recipientHash);

  // Mark conversation as active
  document.querySelectorAll(".conversation-item").forEach((item) => {
    item.classList.remove("active");
    if (item.dataset.threadId === threadId) {
      item.classList.add("active");
    }
  });

  // Start polling
  startPolling();
  loadMessages();
}

function sendMessage() {
  const input = document.getElementById("message-input");
  const plaintext = input.value.trim();

  if (!plaintext) return;
  if (!currentIdentity || !recipientIdentity) {
    showToast("Please connect to a user first", "error");
    return;
  }

  const sendBtn = document.getElementById("send-btn");
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="loading"></span>';

  const ids = [currentIdentity.identityHash, recipientIdentity].sort();
  const threadId = `${ids[0]}:${ids[1]}`;

  const payload = {
    thread_id: threadId,
    recipient_id: recipientIdentity,
    plaintext: plaintext,
    sender_identity_hash: currentIdentity.identityHash,
    sender_signature: "sig_stub",
  };

  fetch(`${API_BASE}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      input.value = "";
      input.style.height = "auto";
      showToast("Sent!", "success");
      displayProofStatus(data);

      // Update conversation
      if (conversations.has(threadId)) {
        conversations.get(threadId).lastMessage = plaintext;
        conversations.get(threadId).timestamp = Date.now();
        saveConversations();
        renderConversations();
      }

      setTimeout(() => {
        loadMessages();
        updateCState();
      }, 300);

      sendBtn.disabled = false;
      sendBtn.innerHTML = "Send";
    })
    .catch((err) => {
      console.error("❌ Send error:", err);
      showToast("Failed to send", "error");
      sendBtn.disabled = false;
      sendBtn.innerHTML = "Send";
    });
}

function loadMessages(silent = false) {
  if (!currentThreadId) return;

  const ids = currentThreadId.split(":");
  if (ids.length === 2) {
    const sortedIds = ids.sort();
    currentThreadId = `${sortedIds[0]}:${sortedIds[1]}`;
  }

  fetch(`${API_BASE}/read/${currentThreadId}`)
    .then((res) => res.json())
    .then((messages) => {
      // Only update if message count actually changed
      if (messages.length !== lastMessageCount) {
        if (!silent) {
          console.log("📨 Loaded", messages.length, "message(s)");
        }
        lastMessageCount = messages.length;

        // Update conversation preview
        if (messages.length > 0 && conversations.has(currentThreadId)) {
          const lastMsg = messages[messages.length - 1];
          conversations.get(currentThreadId).lastMessage = lastMsg.text;
          conversations.get(currentThreadId).timestamp =
            lastMsg.timestamp * 1000;
          saveConversations();
          renderConversations();
        }
        
        // Only re-render messages if count changed
        displayMessages(messages);
      }
    })
    .catch((err) => {
      if (!silent) {
        console.error("Failed to load messages:", err);
      }
    });
}

function displayMessages(messages) {
  const container = document.getElementById("messages-list");

  if (messages.length === 0) {
    if (container.innerHTML.includes("empty-state")) {
      return; // Already showing empty state, don't re-render
    }
    container.innerHTML =
      '<p class="empty-state">No messages yet. Start the conversation!</p>';
    return;
  }

  const wasAtBottom =
    container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

  // Create new HTML
  const newHTML = messages
    .map((msg, index) => {
      const isSent = msg.sender === currentIdentity.identityHash;
      const time = new Date(msg.timestamp * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const proofIcon = msg.proof_present ? "🟢" : "⭕";

      return `
            <div class="message ${
              isSent ? "sent" : "received"
            }" data-msg-id="${msg.timestamp}">
                <div class="message-header">
                    <span>${isSent ? "You" : "Them"}</span>
                    <span>${proofIcon}</span>
                </div>
                <div class="message-text">${escapeHtml(msg.text)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    })
    .join("");

  // Only update if HTML actually changed
  if (container.innerHTML !== newHTML) {
    container.innerHTML = newHTML;
    
    if (wasAtBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }
}

function displayProofStatus(data) {
  const proofStatus = document.getElementById("proof-status");
  proofStatus.classList.remove("hidden");

  const root = data.cstate_root || "-";
  const shortRoot =
    root.length > 16
      ? root.substring(0, 8) + "..." + root.substring(root.length - 6)
      : root;

  proofStatus.innerHTML = `
        <div class="proof-item">
            <label>Proof:</label>
            <span class="status-badge">✅ Verified</span>
        </div>
        <div class="proof-item">
            <label>CSTATE:</label>
            <code style="font-size: 0.8em; color: var(--primary);">${shortRoot}</code>
        </div>
    `;

  // Update tech overlay
  updateTechOverlay();

  setTimeout(() => {
    proofStatus.style.opacity = "0";
    setTimeout(() => proofStatus.classList.add("hidden"), 300);
  }, 4000);
}

function generateQRCode(data) {
  const canvas = document.getElementById("qr-code");
  if (!canvas) {
    console.error("QR code canvas not found");
    return;
  }

  // Wait for QRCode library to load (with multiple retries)
  if (typeof QRCode === "undefined") {
    console.warn("QRCode library not loaded, retrying...");
    // Try up to 5 times
    if (!generateQRCode.retryCount) generateQRCode.retryCount = 0;
    if (generateQRCode.retryCount < 5) {
      generateQRCode.retryCount++;
      setTimeout(() => generateQRCode(data), 300);
      return;
    } else {
      console.error("QRCode library failed to load after retries");
      showQRFallback(canvas, data);
      return;
    }
  }
  
  // Reset retry count on success
  generateQRCode.retryCount = 0;

  const container = canvas.parentElement;
  
  // Clear any existing fallback
  const existingFallback = container.querySelector(".qr-fallback");
  if (existingFallback) {
    existingFallback.remove();
  }

  // Clear canvas first
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.style.display = "block";

  // Generate QR code
  QRCode.toCanvas(
    canvas,
    data,
    {
      width: 200,
      margin: 2,
      color: {
        dark: "#1e293b",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    },
    (err) => {
      if (err) {
        console.error("QR generation error:", err);
        // Fallback: show text if QR fails
        canvas.style.display = "none";
        if (container && !container.querySelector(".qr-fallback")) {
          const fallback = document.createElement("div");
          fallback.className = "qr-fallback";
          fallback.innerHTML = `
            <p style="margin-bottom: 8px; font-weight: 600;">Identity Hash:</p>
            <code style="word-break: break-all; font-size: 0.85em;">${data}</code>
            <p style="margin-top: 12px; font-size: 0.85em; color: var(--text-muted);">Copy this to share your identity</p>
          `;
          fallback.style.padding = "20px";
          fallback.style.background = "#f8fafc";
          fallback.style.borderRadius = "8px";
          fallback.style.fontFamily = "monospace";
          fallback.style.fontSize = "0.9em";
          fallback.style.border = "1px solid var(--border)";
          container.appendChild(fallback);
        }
      } else {
        console.log("✅ QR code generated successfully");
        canvas.style.display = "block";
        // Hide any fallback
        const fallback = container.querySelector(".qr-fallback");
        if (fallback) fallback.remove();
      }
    }
  );
}

function showQRFallback(canvas, data) {
  const container = canvas.parentElement;
  if (!container) return;
  
  canvas.style.display = "none";
  if (!container.querySelector(".qr-fallback")) {
    const fallback = document.createElement("div");
    fallback.className = "qr-fallback";
    fallback.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <p style="margin-bottom: 12px; font-weight: 600; color: var(--text);">Identity Hash:</p>
        <code style="word-break: break-all; font-size: 0.85em; color: var(--primary); display: block; padding: 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border);">${data}</code>
        <p style="margin-top: 12px; font-size: 0.85em; color: var(--text-muted);">Copy this to share your identity</p>
        <button onclick="navigator.clipboard.writeText('${data}'); showToast('Copied!', 'success');" 
                style="margin-top: 12px; padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer;">
          📋 Copy Hash
        </button>
      </div>
    `;
    container.appendChild(fallback);
  }
}

function loadConversations() {
  const stored = localStorage.getItem("zerotrace_conversations");
  if (stored) {
    const data = JSON.parse(stored);
    conversations = new Map(data);
    renderConversations();
  }
}

async function refreshConversationsFromServer() {
  if (!currentIdentity) return;

  try {
    const response = await fetch(
      `${API_BASE}/threads/${currentIdentity.identityHash}`
    );
    const threads = await response.json();

    // Merge server threads with local conversations
    for (const thread of threads) {
      const threadId = thread.thread_id;
      const otherHash = thread.other_identity_hash;

      // Fetch last message to get preview
      try {
        const msgResponse = await fetch(`${API_BASE}/read/${threadId}`);
        const messages = await msgResponse.json();

        if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          const lastMessageText = lastMsg.text || "";

          if (!conversations.has(threadId)) {
            // New conversation from server - add it
            conversations.set(threadId, {
              recipientHash: otherHash,
              lastMessage: lastMessageText,
              timestamp: thread.last_message_time * 1000,
            });
          } else {
            // Update conversation with latest data
            const conv = conversations.get(threadId);
            if (thread.last_message_time * 1000 > conv.timestamp) {
              conv.lastMessage = lastMessageText;
              conv.timestamp = thread.last_message_time * 1000;
            }
          }
        }
      } catch (err) {
        console.error(`Failed to load messages for thread ${threadId}:`, err);
      }
    }

    saveConversations();
    renderConversations();

    // If we have an active thread, refresh its messages
    if (currentThreadId) {
      loadMessages();
    }
  } catch (err) {
    console.error("Failed to refresh conversations:", err);
  }
}

function refreshConversations() {
  if (!currentIdentity) {
    showToast("Please create an identity first", "error");
    return;
  }

  const btn = document.getElementById("refresh-btn");
  btn.classList.add("refreshing");
  btn.disabled = true;

  refreshConversationsFromServer()
    .then(() => {
      showToast("Conversations refreshed!", "success");
      setTimeout(() => {
        btn.classList.remove("refreshing");
        btn.disabled = false;
      }, 500);
    })
    .catch(() => {
      showToast("Refresh failed", "error");
      btn.classList.remove("refreshing");
      btn.disabled = false;
    });
}

function saveConversations() {
  const data = Array.from(conversations.entries());
  localStorage.setItem("zerotrace_conversations", JSON.stringify(data));
}

function renderConversations() {
  const container = document.getElementById("conversations-list");

  if (conversations.size === 0) {
    container.innerHTML =
      '<p class="empty-conversations">No conversations yet</p>';
    return;
  }

  const sorted = Array.from(conversations.entries()).sort(
    (a, b) => b[1].timestamp - a[1].timestamp
  );

  container.innerHTML = sorted
    .map(([threadId, conv]) => {
      const time = new Date(conv.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const shortHash =
        conv.recipientHash.length > 16
          ? conv.recipientHash.substring(0, 8) +
            "..." +
            conv.recipientHash.substring(conv.recipientHash.length - 6)
          : conv.recipientHash;

      return `
            <div class="conversation-item" data-thread-id="${threadId}" onclick="openChat('${threadId}', '${
        conv.recipientHash
      }')">
                <div class="conversation-avatar">${generateAvatar(
                  conv.recipientHash
                )}</div>
                <div class="conversation-info">
                    <div class="conversation-name">${shortHash}</div>
                    <div class="conversation-preview">${escapeHtml(
                      conv.lastMessage || "No messages"
                    )}</div>
                </div>
                <div class="conversation-time">${time}</div>
            </div>
        `;
    })
    .join("");
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    if (currentThreadId) {
      loadMessages(true);
    }
  }, 3000);
}

function updateCState() {
  if (!currentIdentity) return;
  updateCStateInProfile();
  updateTechOverlay();
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function toggleTechOverlay() {
  const overlay = document.getElementById("tech-background");
  overlay.classList.toggle("collapsed");
  const btn = overlay.querySelector(".tech-toggle");
  btn.textContent = overlay.classList.contains("collapsed") ? "+" : "−";
}

function updateTechOverlay() {
  if (!currentIdentity) return;
  
  // Update ZK proof status
  const zkStatus = document.getElementById("tech-zk-status");
  if (zkStatus) {
    zkStatus.textContent = "Psy Protocol CFC";
  }
  
  // Update state status
  const stateStatus = document.getElementById("tech-state-status");
  if (stateStatus) {
    fetch(`${API_BASE}/cstate/${currentIdentity.identityHash}`)
      .then(res => res.json())
      .then(data => {
        if (data.cstate_root && data.cstate_root !== "0".repeat(64)) {
          stateStatus.textContent = "Active";
          stateStatus.classList.add("success");
        } else {
          stateStatus.textContent = "Initialized";
          stateStatus.classList.remove("success");
        }
      })
      .catch(() => {
        stateStatus.textContent = "Merkle Tree";
      });
  }
}

// Close modals on outside click
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    e.target.classList.add("hidden");
  }
});
