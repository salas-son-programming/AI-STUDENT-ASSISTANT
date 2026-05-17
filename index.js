/* =============================================================
   StudyMind — AI Student Assistant
   index.js
   
   SETUP: Replace YOUR_API_KEY_HERE with your OpenAI API key.
   WARNING: For production, never expose API keys in client-side
   code. Use a backend proxy or environment variable system.
   ============================================================= */

const API_KEY = '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';
const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL   = 'gpt-4o-mini'; // cost-effective, fast

// ── STATE ────────────────────────────────────────────────────
let currentSession = null; // { id, name, inputText, action, result, chatHistory[] }
let pdfText = '';
let activeTab = 'text';

// ── STORAGE HELPERS ──────────────────────────────────────────
const storage = {
  getSessions: () => JSON.parse(localStorage.getItem('studymind_sessions') || '[]'),
  saveSession: (session) => {
    const sessions = storage.getSessions().filter(s => s.id !== session.id);
    sessions.unshift(session); // newest first
    if (sessions.length > 50) sessions.splice(50); // cap at 50
    localStorage.setItem('studymind_sessions', JSON.stringify(sessions));
  },
  clearAll: () => localStorage.removeItem('studymind_sessions'),
};

// ── DOM REFS ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const els = {
  viewHome:          $('view-home'),
  viewResult:        $('view-result'),
  userInput:         $('user-input'),
  sessionNameInput:  $('session-name-input'),
  charNum:           $('char-num'),
  sessionsList:      $('sessions-list'),
  recentCards:       $('recent-cards'),
  noSessionsMsg:     $('no-sessions-msg'),
  resultSessionName: $('result-session-name'),
  resultActionBadge: $('result-action-badge'),
  resultSourceText:  $('result-source-text'),
  resultOutput:      $('result-output-content'),
  chatThread:        $('chat-thread'),
  chatInput:         $('chat-input'),
  chatSendBtn:       $('chat-send-btn'),
  loadingOverlay:    $('loading-overlay'),
  loadingText:       $('loading-text'),
  toast:             $('toast'),
  pdfDropZone:       $('pdf-drop-zone'),
  pdfInput:          $('pdf-input'),
  pdfInfo:           $('pdf-info'),
  pdfName:           $('pdf-name'),
  pdfRemove:         $('pdf-remove'),
  sidebar:           $('sidebar'),
  sidebarOverlay:    $('sidebar-overlay'),
};

// ── VIEWS ────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(`view-${name}`).classList.add('active');
  window.scrollTo(0, 0);
}

// ── LOADING ──────────────────────────────────────────────────
function setLoading(visible, message = 'Analyzing your text…') {
  els.loadingText.textContent = message;
  els.loadingOverlay.classList.toggle('visible', visible);
}

// ── TOAST ────────────────────────────────────────────────────
let toastTimeout;
function showToast(message, type = '') {
  clearTimeout(toastTimeout);
  els.toast.textContent = message;
  els.toast.className = `visible ${type}`;
  toastTimeout = setTimeout(() => els.toast.className = '', 3000);
}

// ── TAB SWITCHING ─────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    $(`tab-${activeTab}`).classList.add('active');
  });
});

// ── CHAR COUNT ───────────────────────────────────────────────
els.userInput.addEventListener('input', () => {
  els.charNum.textContent = els.userInput.value.length.toLocaleString();
});

// ── PDF HANDLING ─────────────────────────────────────────────
function setupPDF() {
  els.pdfDropZone.addEventListener('dragover', e => {
    e.preventDefault();
    els.pdfDropZone.classList.add('dragover');
  });
  els.pdfDropZone.addEventListener('dragleave', () => {
    els.pdfDropZone.classList.remove('dragover');
  });
  els.pdfDropZone.addEventListener('drop', e => {
    e.preventDefault();
    els.pdfDropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') loadPDF(file);
  });
  els.pdfDropZone.addEventListener('click', () => els.pdfInput.click());
  els.pdfDropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') els.pdfInput.click();
  });
  els.pdfInput.addEventListener('change', () => {
    if (els.pdfInput.files[0]) loadPDF(els.pdfInput.files[0]);
  });
  els.pdfRemove.addEventListener('click', () => {
    pdfText = '';
    els.pdfInfo.style.display = 'none';
    els.pdfDropZone.style.display = '';
    els.pdfInput.value = '';
  });
}

async function loadPDF(file) {
  setLoading(true, 'Extracting PDF text…');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    pdfText = text.trim();
    if (!pdfText) throw new Error('No text found in PDF.');

    els.pdfName.textContent = file.name;
    els.pdfInfo.style.display = 'flex';
    els.pdfDropZone.style.display = 'none';
    showToast(`PDF loaded: ${pdf.numPages} page(s)`, 'success');
  } catch (err) {
    showToast('Could not read PDF: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ── API CALL ─────────────────────────────────────────────────
async function callOpenAI(messages) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 1500,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ── SYSTEM PROMPTS ────────────────────────────────────────────
function getSystemPrompt(action) {
  const base = `You are StudyMind, an AI tutor helping students understand academic content.
Respond in clear, well-formatted markdown. Use headings, bullet points, and bold where helpful.
Keep explanations precise, accurate, and student-friendly.`;

  const actions = {
    explain: `${base}
Your task: Explain the concept or passage clearly and simply.
- Start with a one-sentence summary
- Break down the key ideas step by step
- Use an analogy or real-world example if helpful
- Define any technical terms`,
    summarize: `${base}
Your task: Summarize the passage concisely.
- Capture the main idea in one sentence at the top
- List the key points as bullet points
- Note any important facts, dates, or figures
- Keep it shorter than the original`,
    keyconcepts: `${base}
Your task: Extract and define the key concepts.
- List each key concept as a bold term
- Give a 1–2 sentence definition for each
- Note relationships between concepts where relevant
- Order from most fundamental to most complex`,
  };
  return actions[action];
}

// ── MAIN ANALYZE ─────────────────────────────────────────────
async function analyze(action) {
  const inputText = activeTab === 'pdf' ? pdfText : els.userInput.value.trim();

  if (!inputText) {
    showToast(activeTab === 'pdf' ? 'Please upload a PDF first.' : 'Please paste some text first.', 'error');
    return;
  }
  if (inputText.length < 20) {
    showToast('Text is too short. Add more content.', 'error');
    return;
  }
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    showToast('Add your OpenAI API key in index.js', 'error');
    return;
  }

  const sessionName = els.sessionNameInput.value.trim() ||
    inputText.slice(0, 45).replace(/\s+/g, ' ') + (inputText.length > 45 ? '…' : '');

  const loadingMessages = {
    explain: 'Building your explanation…',
    summarize: 'Summarizing key points…',
    keyconcepts: 'Extracting key concepts…',
  };
  setLoading(true, loadingMessages[action]);

  try {
    const messages = [
      { role: 'system', content: getSystemPrompt(action) },
      { role: 'user', content: inputText },
    ];

    const result = await callOpenAI(messages);

    currentSession = {
      id: Date.now().toString(),
      name: sessionName,
      action,
      inputText,
      result,
      chatHistory: [
        { role: 'system', content: getSystemPrompt(action) },
        { role: 'user', content: inputText },
        { role: 'assistant', content: result },
      ],
      timestamp: new Date().toISOString(),
    };

    storage.saveSession(currentSession);
    renderSidebar();
    renderRecentCards();
    renderResultView(currentSession);
    showView('result');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    console.error(err);
  } finally {
    setLoading(false);
  }
}

// ── RESULT VIEW ───────────────────────────────────────────────
function renderResultView(session) {
  els.resultSessionName.textContent = session.name;
  els.resultActionBadge.textContent = session.action === 'keyconcepts' ? 'Key Concepts' :
    session.action.charAt(0).toUpperCase() + session.action.slice(1);
  els.resultActionBadge.className = session.action;

  els.resultSourceText.textContent = session.inputText.slice(0, 800) +
    (session.inputText.length > 800 ? '…' : '');

  els.resultOutput.innerHTML = marked.parse(session.result);

  // Reset chat
  els.chatThread.innerHTML = '';
  els.chatInput.value = '';

  // Re-render existing chat if loading old session
  if (session.chatHistory.length > 3) {
    const chatMsgs = session.chatHistory.slice(3); // skip system + first Q/A
    chatMsgs.forEach(msg => {
      if (msg.role !== 'system') appendChatBubble(msg.role, msg.content, false);
    });
    els.chatThread.scrollTop = els.chatThread.scrollHeight;
  }
}

// ── FOLLOW-UP CHAT ───────────────────────────────────────────
function appendChatBubble(role, content, animate = true) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  if (!animate) bubble.style.animation = 'none';

  const initials = role === 'user' ? 'You' : 'AI';
  bubble.innerHTML = `
    <div class="bubble-avatar">${initials}</div>
    <div class="bubble-content">${role === 'assistant' ? marked.parse(content) : escapeHtml(content)}</div>
  `;
  els.chatThread.appendChild(bubble);
  els.chatThread.scrollTop = els.chatThread.scrollHeight;
}

function appendTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'chat-bubble assistant';
  el.id = 'typing-indicator';
  el.innerHTML = `
    <div class="bubble-avatar">AI</div>
    <div class="bubble-content typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  els.chatThread.appendChild(el);
  els.chatThread.scrollTop = els.chatThread.scrollHeight;
}

async function sendFollowUp() {
  const question = els.chatInput.value.trim();
  if (!question || !currentSession) return;

  els.chatInput.value = '';
  els.chatSendBtn.disabled = true;

  appendChatBubble('user', question);
  appendTypingIndicator();

  currentSession.chatHistory.push({ role: 'user', content: question });

  try {
    const answer = await callOpenAI(currentSession.chatHistory);

    document.getElementById('typing-indicator')?.remove();
    appendChatBubble('assistant', answer);

    currentSession.chatHistory.push({ role: 'assistant', content: answer });
    storage.saveSession(currentSession);
  } catch (err) {
    document.getElementById('typing-indicator')?.remove();
    appendChatBubble('assistant', `Sorry, I hit an error: ${err.message}`);
  } finally {
    els.chatSendBtn.disabled = false;
    els.chatInput.focus();
  }
}

// ── SIDEBAR RENDER ────────────────────────────────────────────
const ACTION_ICONS = {
  explain: '💡',
  summarize: '📋',
  keyconcepts: '🔑',
};

function renderSidebar() {
  const sessions = storage.getSessions();
  els.sessionsList.innerHTML = '';

  if (sessions.length === 0) {
    els.sessionsList.innerHTML = '<li style="padding: 8px 10px; font-size:12px; color: var(--text-muted);">No sessions yet</li>';
    return;
  }

  sessions.forEach(s => {
    const li = document.createElement('li');
    li.dataset.id = s.id;
    if (currentSession?.id === s.id) li.classList.add('active');

    const date = new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    li.innerHTML = `
      <div class="session-item-icon">${ACTION_ICONS[s.action] || '📄'}</div>
      <div class="session-item-info">
        <div class="session-item-name">${escapeHtml(s.name)}</div>
        <div class="session-item-meta">${s.action} · ${date}</div>
      </div>
    `;
    li.addEventListener('click', () => loadSession(s.id));
    els.sessionsList.appendChild(li);
  });
}

function renderRecentCards() {
  const sessions = storage.getSessions().slice(0, 6);
  els.recentCards.innerHTML = '';

  if (sessions.length === 0) {
    els.noSessionsMsg.style.display = 'block';
    return;
  }
  els.noSessionsMsg.style.display = 'none';

  sessions.forEach(s => {
    const card = document.createElement('div');
    card.className = 'recent-card';
    const date = new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const actionLabel = s.action === 'keyconcepts' ? 'Key Concepts' :
      s.action.charAt(0).toUpperCase() + s.action.slice(1);

    card.innerHTML = `
      <span class="recent-card-action ${s.action}">${actionLabel}</span>
      <div class="recent-card-name">${escapeHtml(s.name)}</div>
      <div class="recent-card-preview">${escapeHtml(s.inputText.slice(0, 100))}</div>
      <div class="recent-card-date">${date}</div>
    `;
    card.addEventListener('click', () => loadSession(s.id));
    els.recentCards.appendChild(card);
  });
}

function loadSession(id) {
  const session = storage.getSessions().find(s => s.id === id);
  if (!session) return;
  currentSession = session;
  renderResultView(session);
  showView('result');
  closeMobileSidebar();
  renderSidebar(); // update active state
}

// ── BACK / NEW SESSION ────────────────────────────────────────
function goHome() {
  currentSession = null;
  renderSidebar();
  showView('home');
}

function newSession() {
  currentSession = null;
  els.userInput.value = '';
  els.sessionNameInput.value = '';
  els.charNum.textContent = '0';
  pdfText = '';
  els.pdfInfo.style.display = 'none';
  els.pdfDropZone.style.display = '';
  els.pdfInput.value = '';
  renderSidebar();
  showView('home');
  closeMobileSidebar();
}

// ── MOBILE SIDEBAR ────────────────────────────────────────────
function openMobileSidebar() {
  els.sidebar.classList.add('open');
  els.sidebarOverlay.classList.add('visible');
}
function closeMobileSidebar() {
  els.sidebar.classList.remove('open');
  els.sidebarOverlay.classList.remove('visible');
}

// ── COPY ──────────────────────────────────────────────────────
function copyResult() {
  if (!currentSession) return;
  navigator.clipboard.writeText(currentSession.result).then(() => {
    showToast('Copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Could not copy.', 'error');
  });
}

// ── CLEAR HISTORY ─────────────────────────────────────────────
function clearHistory() {
  if (!confirm('Delete all study sessions? This cannot be undone.')) return;
  storage.clearAll();
  currentSession = null;
  renderSidebar();
  renderRecentCards();
  showView('home');
  showToast('All sessions cleared.', '');
}

// ── UTILS ─────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── EVENT WIRING ──────────────────────────────────────────────
function init() {
  // Action buttons
  document.getElementById('btn-explain').addEventListener('click', () => analyze('explain'));
  document.getElementById('btn-summarize').addEventListener('click', () => analyze('summarize'));
  document.getElementById('btn-keyconcepts').addEventListener('click', () => analyze('keyconcepts'));

  // New session buttons
  document.getElementById('new-session-btn').addEventListener('click', newSession);
  document.getElementById('mobile-new-btn').addEventListener('click', newSession);

  // Back
  document.getElementById('back-btn').addEventListener('click', goHome);

  // Copy
  document.getElementById('copy-btn').addEventListener('click', copyResult);

  // Clear history
  document.getElementById('clear-history-btn').addEventListener('click', clearHistory);

  // Chat
  els.chatSendBtn.addEventListener('click', sendFollowUp);
  els.chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFollowUp();
    }
  });

  // Mobile
  document.getElementById('mobile-menu-btn').addEventListener('click', openMobileSidebar);
  els.sidebarOverlay.addEventListener('click', closeMobileSidebar);

  // PDF
  setupPDF();

  // Initial render
  renderSidebar();
  renderRecentCards();
  showView('home');
}

document.addEventListener('DOMContentLoaded', init);
