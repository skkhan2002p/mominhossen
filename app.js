document.addEventListener("DOMContentLoaded", () => {
  let currentUser = localStorage.getItem("maya_code_user") || "";
  let currentChannel = "general";
  let messagesList = document.getElementById("messagesList");
  let chatForm = document.getElementById("chatForm");
  let messageInput = document.getElementById("messageInput");
  let userModal = document.getElementById("userModal");
  let userForm = document.getElementById("userForm");
  let usernameInput = document.getElementById("usernameInput");
  let userProfileBtn = document.getElementById("userProfileBtn");
  let offlineNotice = document.getElementById("offlineNotice");
  let loadingSpinner = document.getElementById("loadingSpinner");
  let channelTabs = document.querySelectorAll(".channel-tab");

  // Check if MayaDB is available
  const isDbAvailable = () => typeof window.MayaDB !== "undefined";

  if (!isDbAvailable()) {
    if (offlineNotice) {
      offlineNotice.style.display = "block";
      offlineNotice.textContent = "Local Preview Mode — Messages saved locally until deployed online with MayaDB.";
    }
  }

  // Handle user modal
  if (!currentUser) {
    userModal.classList.add("active");
  }

  userProfileBtn.addEventListener("click", () => {
    usernameInput.value = currentUser;
    userModal.classList.add("active");
  });

  userForm.addEventListener("submit", (e) => {
    e.preventDefault();
    let name = usernameInput.value.trim();
    if (name) {
      currentUser = name;
      localStorage.setItem("maya_code_user", currentUser);
      userModal.classList.remove("active");
      loadMessages();
    }
  });

  // Channel switching
  channelTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      channelTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentChannel = tab.getAttribute("data-channel");
      loadMessages();
    });
  });

  // Local storage helper for offline fallback
  function getLocalMessages() {
    try {
      return JSON.parse(localStorage.getItem("maya_code_local_msgs") || "[]");
    } catch {
      return [];
    }
  }

  function saveLocalMessage(msgObj) {
    let msgs = getLocalMessages();
    msgs.push({ id: "local_" + Date.now(), created: Date.now(), data: msgObj });
    localStorage.setItem("maya_code_local_msgs", JSON.stringify(msgs));
  }

  // Load messages from MayaDB or local fallback
  async function loadMessages() {
    let items = [];

    if (isDbAvailable()) {
      try {
        if (loadingSpinner) loadingSpinner.style.display = "block";
        let res = await MayaDB.list("messages", { limit: 50 });
        items = res || [];
        if (loadingSpinner) loadingSpinner.style.display = "none";
      } catch (err) {
        console.error("MayaDB list error:", err);
        items = getLocalMessages();
      }
    } else {
      items = getLocalMessages();
      if (loadingSpinner) loadingSpinner.style.display = "none";
    }

    renderMessages(items);
  }

  function renderMessages(items) {
    let filtered = items.filter(item => {
      let data = item.data || item;
      return (data.channel || "general") === currentChannel;
    });

    filtered.sort((a, b) => {
      let timeA = a.created || a.data?.time || 0;
      let timeB = b.created || b.data?.time || 0;
      return timeA - timeB;
    });

    let welcomeHTML = `
      <div class="welcome-card">
        <h3>Welcome to <span class="accent-text">Maya Code</span> (#${currentChannel})! 🚀</h3>
        <p>Share code snippets, ask questions, and collaborate in real time.</p>
      </div>
    `;

    if (filtered.length === 0) {
      messagesList.innerHTML = welcomeHTML + `<div class="loading-spinner">No messages in #${currentChannel} yet. Be the first to start!</div>`;
      return;
    }

    let html = welcomeHTML;
    filtered.forEach(item => {
      let d = item.data || item;
      let sender = escapeHtml(d.user || "Anonymous");
      let text = d.text || "";
      let formattedText = formatCodeAndText(text);
      let timeStr = formatTime(item.created || d.time);
      let isMine = d.user === currentUser;

      html += `
        <div class="message-bubble ${isMine ? 'my-message' : ''}">
          <div class="message-header">
            <span class="message-user">@${sender}</span>
            <span class="message-time">${timeStr}</span>
          </div>
          <div class="message-text">${formattedText}</div>
        </div>
      `;
    });

    messagesList.innerHTML = html;
    scrollToBottom();
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }

  function formatCodeAndText(text) {
    if (!text) return "";
    
    // Check for code blocks using triple backticks ```code```
    let parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map(part => {
      if (part.startsWith("```") && part.endsWith("```")) {
        let codeContent = part.slice(3, -3).trim();
        // Extract language if specified in first line
        let firstLineEnd = codeContent.indexOf("\n");
        if (firstLineEnd !== -1) {
          let lang = codeContent.substring(0, firstLineEnd).trim();
          if (/^[a-zA-Z0-9_-]+$/.test(lang)) {
            codeContent = codeContent.substring(firstLineEnd + 1);
          }
        }
        return `<pre class="code-block"><code>${escapeHtml(codeContent)}</code></pre>`;
      } else {
        // Inline backticks `code`
        let escaped = escapeHtml(part);
        escaped = escaped.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        return escaped.replace(/\n/g, '<br>');
      }
    }).join("");
  }

  function formatTime(timestamp) {
    if (!timestamp) return "";
    let date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    let main = document.getElementById("chatMain");
    if (main) {
      main.scrollTop = main.scrollHeight;
    }
  }

  // Send Message
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      userModal.classList.add("active");
      return;
    }

    let text = messageInput.value.trim();
    if (!text) return;

    messageInput.value = "";

    let msgPayload = {
      channel: currentChannel,
      user: currentUser,
      text: text,
      time: Date.now()
    };

    if (isDbAvailable()) {
      try {
        await MayaDB.add("messages", msgPayload);
      } catch (err) {
        console.error("MayaDB add error, saving locally:", err);
        saveLocalMessage(msgPayload);
      }
    } else {
      saveLocalMessage(msgPayload);
    }

    loadMessages();
  });

  // Initial load & Polling for live sync
  loadMessages();
  setInterval(() => {
    loadMessages();
  }, 3000);
});
