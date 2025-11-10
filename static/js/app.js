/* ====== Elements */
const typingArea = document.getElementById('typingArea');
const textEl = document.getElementById('text');
const caretEl = document.getElementById('caret');
const wpmEl = document.getElementById('wpm');
const accuracyEl = document.getElementById('accuracy');
const errorsEl = document.getElementById('errors');
const timeEl = document.getElementById('time');
const themeBtn = document.getElementById('btn-theme');
// Result elements
const modal = document.getElementById('resultModal');
const resWpmEl = document.getElementById('resWpm');
const resAccEl = document.getElementById('resAcc');
const resErrEl = document.getElementById('resErr');
const resTimeEl = document.getElementById('resTime');
const btnRestart = document.getElementById('btnRestart');
const btnClose = document.getElementById('btnClose');

/* ====== State */
let chars = [];
let currentIndex = 0;
let started = false;
let startTime = 0;
let timer = null;
let timeLimit = 30;
let correctChars = 0;
let incorrectChars = 0;
let totalTyped = 0;
let mode = 'time'; // 'time' | 'words'
let useNumbers = false;
let usePunctuation = false;
let wordsCount = 50;
let customText = '';

/* ====== Initialize */
function init() {
  loadText();
  setupEventListeners();
}

async function fetchSnippet() {
  // Custom mode: use user's text
  if (mode === 'custom' && customText.trim().length > 0) {
    return customText.trim();
  }

  // Quote mode: pick a random quote
  if (mode === 'quote') {
    const quotes = [
      "If a person can't answer directly to your question, it's either the answer is too painful for you to know or too hard for them to admit.",
      "Simplicity is the soul of efficiency.",
      "Talk is cheap. Show me the code.",
      "Programs must be written for people to read, and only incidentally for machines to execute.",
      "Premature optimization is the root of all evil."
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  const query = new URLSearchParams();
  // time and words both use word lists by default
  query.set('mode', 'words');
  const defaultCount = mode === 'words' ? wordsCount : 80;
  query.set('count', String(defaultCount));

  // If number/punctuation toggles are on, use chars mode
  const wantsCharset = useNumbers || usePunctuation;
  if (wantsCharset) {
    query.set('mode', 'chars');
    query.set('count', mode === 'words' ? '200' : '300');
    let charset = 'letters';
    if (useNumbers && usePunctuation) charset = 'punct';
    else if (useNumbers) charset = 'alnum';
    else if (usePunctuation) charset = 'punct';
    query.set('charset', charset);
  }
  const res = await fetch(`/api/snippet?${query.toString()}`);
  const data = await res.json();
  return data.text;
}

async function loadText() {
  const text = await fetchSnippet();
  textEl.innerHTML = '';
  chars = [];
  
  for (const char of text) {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = char;
    textEl.appendChild(span);
    chars.push(span);
  }
  
  currentIndex = 0;
  if (chars.length > 0) {
    chars[0].classList.add('active');
  }
  updateCaret();
}

function setupEventListeners() {
  // Typing
  typingArea.addEventListener('keydown', handleKeydown);
  
  // Options: mode
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.mode;
      // toggle visibility of time/words options depending on mode
      document.getElementById('time-options').style.display = mode === 'time' ? 'flex' : 'none';
      document.getElementById('words-options').style.display = mode === 'words' ? 'flex' : 'none';
      if (mode === 'custom') {
        showInputModal();
        return;
      }
      await reset(true);
    });
  });

  // Options: time
  document.querySelectorAll('[data-time]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('[data-time]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timeLimit = parseInt(btn.dataset.time);
      timeEl.textContent = timeLimit;
      await reset(true);
    });
  });

  // Options: words count
  document.querySelectorAll('[data-words]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('[data-words]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      wordsCount = parseInt(btn.dataset.words);
      await reset(true);
    });
  });

  // Options: toggles
  document.querySelectorAll('[data-opt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.classList.toggle('active');
      useNumbers = document.querySelector('[data-opt="numbers"]').classList.contains('active');
      usePunctuation = document.querySelector('[data-opt="punctuation"]').classList.contains('active');
      await reset(true);
    });
  });

  // Theme toggle (simple)
  themeBtn?.addEventListener('click', () => {
    const isLight = document.body.dataset.theme === 'light';
    document.body.dataset.theme = isLight ? 'dark' : 'light';
    themeBtn.textContent = isLight ? '☀' : '🌙';
    applyTheme();
  });
  applyTheme();

  // Focus
  typingArea.addEventListener('click', () => typingArea.focus());
  
  // Keyboard shortcuts
  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (modal.classList.contains('show')) hideResults();
      await reset(true);
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      await reset(true);
    } else if (e.key === 'Escape') {
      hideResults();
    }
  });

  // Window events
  window.addEventListener('resize', updateCaret);
  window.addEventListener('scroll', updateCaret);

  // Modal actions
  btnRestart?.addEventListener('click', async () => {
    hideResults();
    await reset(true);
  });
  btnClose?.addEventListener('click', () => hideResults());

  // Custom modal
  document.getElementById('btnCustomOk')?.addEventListener('click', async () => {
    const ta = document.getElementById('customText');
    customText = (ta?.value || '').trim();
    hideInputModal();
    await reset(true);
  });
  document.getElementById('btnCustomClose')?.addEventListener('click', async () => {
    hideInputModal();
    // revert to words if no custom text provided
    if (!customText) {
      mode = 'words';
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-mode="words"]')?.classList.add('active');
      document.getElementById('time-options').style.display = 'none';
      document.getElementById('words-options').style.display = 'flex';
      await reset(true);
    }
  });
}

function handleKeydown(e) {
  if (chars.length === 0) return;
  
  // Start timer on first keypress
  if (!started && e.key.length === 1) {
    started = true;
    startTime = Date.now();
    if (mode === 'time') startTimer();
  }

  if (e.key === 'Backspace') {
    e.preventDefault();
    handleBackspace();
  } else if (e.key.length === 1) {
    e.preventDefault();
    handleCharacter(e.key);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    handleCharacter('\n'); // unlikely used, but keeps consistent
  } else if (e.key === ' ') {
    e.preventDefault();
    handleCharacter(' ');
  }
}

function handleCharacter(key) {
  if (currentIndex >= chars.length) return;
  
  const currentChar = chars[currentIndex];
  const expectedChar = currentChar.textContent;
  
  totalTyped++;
  currentChar.classList.remove('active');
  
  if (key === expectedChar) {
    currentChar.classList.add('correct');
    correctChars++;
  } else {
    currentChar.classList.add('incorrect');
    incorrectChars++;
  }
  
  currentIndex++;
  
  // When user reaches the end of the snippet in ANY mode, finish and show results
  if (currentIndex >= chars.length) {
    finish();
  } else if (currentIndex < chars.length) {
    chars[currentIndex].classList.add('active');
  }
  
  updateCaret();
  updateStats();
}

function handleBackspace() {
  if (currentIndex === 0) return;
  
  chars[currentIndex]?.classList.remove('active');
  currentIndex--;
  
  const currentChar = chars[currentIndex];
  if (currentChar.classList.contains('correct')) {
    correctChars--;
  } else if (currentChar.classList.contains('incorrect')) {
    incorrectChars--;
  }
  
  if (totalTyped > 0) totalTyped--;
  
  currentChar.classList.remove('correct', 'incorrect');
  currentChar.classList.add('active');
  
  updateCaret();
  updateStats();
}

function updateCaret() {
  const activeChar = chars[currentIndex] || chars[chars.length - 1];
  if (!activeChar) return;
  
  const rect = activeChar.getBoundingClientRect();
  const containerRect = typingArea.getBoundingClientRect();
  // Position caret relative to the typing area (accounts for padding/border)
  caretEl.style.left = (rect.left - containerRect.left) + 'px';
  caretEl.style.top = (rect.top - containerRect.top) + 'px';
  // Match caret height to the active character box for better alignment
  caretEl.style.height = rect.height + 'px';
}

function updateStats() {
  const elapsedMinutes = started ? (Date.now() - startTime) / 1000 / 60 : 0.0000001;
  const wpm = Math.round((correctChars / 5) / Math.max(elapsedMinutes, 0.01));
  const accuracy = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 100;
  
  wpmEl.textContent = wpm;
  accuracyEl.textContent = accuracy + '%';
  errorsEl.textContent = incorrectChars;
}

function startTimer() {
  let remaining = timeLimit;
  timeEl.textContent = remaining;
  
  clearInterval(timer);
  timer = setInterval(() => {
    remaining--;
    timeEl.textContent = remaining;
    
    if (remaining <= 0) {
      finish();
    }
  }, 1000);
}

function finish() {
  started = false;
  clearInterval(timer);
  chars.forEach(char => char.classList.remove('active'));
  updateCaret();
  updateStats();
  showResults();
  // Preload next content behind the results so it's ready
  setTimeout(() => { reset(true, false); }, 0);
}

async function reset(reload = false, focusAfter = true) {
  started = false;
  startTime = 0;
  currentIndex = 0;
  correctChars = 0;
  incorrectChars = 0;
  totalTyped = 0;
  
  clearInterval(timer);
  timer = null;
  
  wpmEl.textContent = '0';
  accuracyEl.textContent = '100%';
  errorsEl.textContent = '0';
  timeEl.textContent = timeLimit;
  
  if (reload) {
    await loadText();
  }
  if (focusAfter) typingArea.focus();
}

function applyTheme() {
  const theme = document.body.dataset.theme || 'dark';
  if (theme === 'light') {
    document.documentElement.style.setProperty('--bg', '#f5f5f5');
    document.documentElement.style.setProperty('--surface', '#ffffff');
    document.documentElement.style.setProperty('--text', '#222');
    document.documentElement.style.setProperty('--text-dim', '#666');
    document.documentElement.style.setProperty('--accent', '#e2b714');
    document.documentElement.style.setProperty('--error', '#d33');
  } else {
    document.documentElement.style.setProperty('--bg', '#323437');
    document.documentElement.style.setProperty('--surface', '#2c2e31');
    document.documentElement.style.setProperty('--text', '#d1d0c5');
    document.documentElement.style.setProperty('--text-dim', '#646669');
    document.documentElement.style.setProperty('--accent', '#e2b714');
    document.documentElement.style.setProperty('--error', '#ca4754');
  }
}

// Initialize on load
init();

/* ====== Results modal helpers */
function showResults() {
  // compute elapsed and final stats
  const elapsedSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const effectiveSeconds = mode === 'time' ? Math.max(timeLimit, 1) : Math.max(elapsedSeconds, 1);
  const minutes = Math.max(effectiveSeconds / 60, 0.00001);
  const wpm = Math.round((correctChars / 5) / minutes);
  const accuracy = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 100;
  const errors = incorrectChars;
  const timeDisplay = mode === 'time' ? `${timeLimit}s` : `${elapsedSeconds}s`;

  resWpmEl.textContent = String(wpm);
  resAccEl.textContent = `${accuracy}%`;
  resErrEl.textContent = String(errors);
  resTimeEl.textContent = timeDisplay;

  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}
function hideResults() {
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

/* ====== Custom input modal helpers */
function showInputModal() {
  const im = document.getElementById('inputModal');
  im.classList.add('show');
  im.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  document.getElementById('customText')?.focus();
}
function hideInputModal() {
  const im = document.getElementById('inputModal');
  im.classList.remove('show');
  im.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}


