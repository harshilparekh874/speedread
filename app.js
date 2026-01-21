// SpeedRead - Main Application Logic

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// State Management
const state = {
    words: [],
    sentences: [], // Array of { words: [], startIndex: number, endIndex: number }
    currentSentenceIndex: -1,
    currentIndex: 0,
    isPlaying: false,
    wpm: 300,
    timer: null,
    totalWords: 0,
    startTime: null,
    sessionSeconds: 0,
    statsInterval: null,
    history: [],
    currentTitle: "Untitled Read",
};

// DOM Elements
const elements = {
    landingPage: document.getElementById('landing-page'),
    appPage: document.getElementById('app-page'),
    startBtn: document.getElementById('start-btn'),
    backBtn: document.getElementById('back-to-landing'),
    readerDisplay: document.getElementById('reader-display'),
    wordTarget: document.getElementById('word-target'),
    playPauseBtn: document.getElementById('play-pause-btn'),
    restartBtn: document.getElementById('restart-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    wpmSlider: document.getElementById('wpm-slider'),
    wpmValue: document.getElementById('wpm-value'),
    progressBar: document.getElementById('progress-bar'),
    textInput: document.getElementById('text-input'),
    loadTextBtn: document.getElementById('load-text-btn'),
    fileInput: document.getElementById('file-input'),
    dropZone: document.getElementById('drop-zone'),
    loader: document.getElementById('loader'),
    statWpm: document.getElementById('stat-wpm'),
    statProgress: document.getElementById('stat-progress'),
    statWords: document.getElementById('stat-words'),
    statRemaining: document.getElementById('stat-remaining'),
    statSession: document.getElementById('stat-session'),
    contextToggle: document.getElementById('context-toggle'),
    contextView: document.getElementById('context-view'),
    contextContent: document.getElementById('context-content'),
    historyList: document.getElementById('history-list'),
    tabs: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    presets: document.querySelectorAll('.preset-btn'),
    sampleBtns: document.querySelectorAll('.sample-btn'),
};

// Samples
const samples = {
    finance: "Money’s greatest intrinsic value—and this can’t be overstated—is its ability to give you control over your time. To do what you want, when you want, with whom you want, for as long as you want, is incredible. It is the highest dividend money pays. When you don't have control over your time, you're forced to accept whatever luck comes your way. But when you do, you have the freedom to follow your interests and the flexibility to wait for the right opportunities. This is the real psychology of money.",
    tech: "Artificial Intelligence is no longer a futuristic concept; it is an integral part of our daily lives. From the algorithms that curate our social media feeds to the autonomous systems driving our cars, AI is reshaping industries and society at large. The rapid advancement of large language models has opened new frontiers in human-computer interaction, allowing machines to understand and generate text with startling proficiency. However, with this power comes great responsibility, as we navigate the ethical implications of automation and the future of work.",
    literature: "In my younger and more vulnerable years my father gave me some advice that I’ve been turning over in my mind ever since. 'Whenever you feel like criticizing any one,' he told me, 'just remember that all the people in this world haven’t had the advantages that you’ve had.' He didn’t say any more, but we’ve always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I’m inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores."
};

// Initialize
function init() {
    setupEventListeners();
    loadFromLocalStorage();
}

function setupEventListeners() {
    // Navigation
    elements.startBtn.addEventListener('click', () => switchView('app'));
    elements.backBtn.addEventListener('click', () => switchView('landing'));

    // Controls
    elements.playPauseBtn.addEventListener('click', togglePlay);
    elements.restartBtn.addEventListener('click', restartReading);
    elements.prevBtn.addEventListener('click', () => skipWords(-10));
    elements.nextBtn.addEventListener('click', () => skipWords(10));

    // Context Toggle
    elements.contextToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            elements.contextView.classList.remove('hidden');
            scrollToActiveSentence();
        } else {
            elements.contextView.classList.add('hidden');
        }
    });

    // Speed Control
    elements.wpmSlider.addEventListener('input', (e) => {
        updateWPM(parseInt(e.target.value));
    });

    elements.presets.forEach(btn => {
        btn.addEventListener('click', () => {
            const wpm = parseInt(btn.dataset.wpm);
            updateWPM(wpm);
        });
    });

    // Content Input
    elements.loadTextBtn.addEventListener('click', () => {
        processText(elements.textInput.value);
    });

    elements.fileInput.addEventListener('change', handleFileUpload);

    elements.dropZone.addEventListener('click', () => elements.fileInput.click());
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('dragover');
    });
    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('dragover');
    });
    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // Tabs
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            elements.tabs.forEach(t => t.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(target).classList.remove('hidden');
        });
    });

    // Samples
    elements.sampleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const sampleKey = btn.dataset.sample;
            processText(samples[sampleKey]);
        });
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (elements.appPage.classList.contains('hidden')) return;
        if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;

        if (e.code === 'Space') {
            e.preventDefault();
            togglePlay();
        } else if (e.code === 'ArrowLeft') {
            skipWords(-10);
        } else if (e.code === 'ArrowRight') {
            skipWords(10);
        } else if (e.code === 'ArrowUp') {
            updateWPM(state.wpm + 10);
        } else if (e.code === 'ArrowDown') {
            updateWPM(state.wpm - 10);
        }
    });
}

// View Management
function switchView(view) {
    if (view === 'landing') {
        elements.landingPage.classList.remove('hidden');
        elements.appPage.classList.add('hidden');
    } else {
        elements.landingPage.classList.add('hidden');
        elements.appPage.classList.remove('hidden');
    }
}

// Text Processing
function processText(text) {
    if (!text || text.trim() === '') return;

    // Save previous session if it had progress before loading new one
    saveSession();

    // Show loader
    elements.loader.classList.remove('hidden');

    setTimeout(() => {
        // Detect paragraph breaks and replace with a special token
        // Also split by any whitespace but preserve single newlines vs double newlines
        const cleanedText = text.trim().replace(/\r\n/g, '\n');
        const paragraphs = cleanedText.split(/\n\s*\n/);

        let tokens = [];
        paragraphs.forEach((para, i) => {
            const words = para.split(/\s+/).filter(w => w.length > 0);
            tokens = tokens.concat(words);
            if (i < paragraphs.length - 1) {
                // Add a paragraph break marker
                tokens.push('---PARA---');
            }
        });
        // Create sentences for context view
        const sentences = [];
        let currentSentenceWords = [];
        let startIdx = 0;

        tokens.forEach((token, i) => {
            if (token === '---PARA---') {
                if (currentSentenceWords.length > 0) {
                    sentences.push({
                        words: currentSentenceWords,
                        startIndex: startIdx,
                        endIndex: i - 1
                    });
                    currentSentenceWords = [];
                }
                startIdx = i + 1;
                return;
            }

            currentSentenceWords.push(token);
            // End sentence on . ! ?
            if (token.endsWith('.') || token.endsWith('!') || token.endsWith('?')) {
                sentences.push({
                    words: currentSentenceWords,
                    startIndex: startIdx,
                    endIndex: i
                });
                currentSentenceWords = [];
                startIdx = i + 1;
            }
        });

        // Add last sentence if any
        if (currentSentenceWords.length > 0) {
            sentences.push({
                words: currentSentenceWords,
                startIndex: startIdx,
                endIndex: tokens.length - 1
            });
        }

        state.sentences = sentences;
        state.words = tokens;
        state.totalWords = tokens.filter(t => t !== '---PARA---').length;
        state.currentIndex = 0;
        state.currentSentenceIndex = -1;
        state.isPlaying = false;
        state.startTime = null;
        state.currentTitle = text.substring(0, 30).trim() + (text.length > 30 ? "..." : "");
        elements.statSession.textContent = '0:00';

        renderContextView();
        updateDisplay();
        updateStats();

        // Hide loader
        elements.loader.classList.add('hidden');

        // Scroll to reader
        elements.readerContainer = document.querySelector('.reader-container');
        elements.readerContainer.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

// File Handling
function handleFileUpload(e) {
    handleFiles(e.target.files);
}

function handleFiles(files) {
    const file = files[0];
    if (!file) return;

    elements.loader.classList.remove('hidden');

    if (file.type === 'application/pdf') {
        parsePDF(file);
    } else if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => processText(e.target.result);
        reader.readAsText(file);
    } else {
        alert('Unsupported file type. Please use .pdf or .txt');
        elements.loader.classList.add('hidden');
    }
}

async function parsePDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            fullText += strings.join(' ') + '\n';
        }

        processText(fullText);
    } catch (error) {
        console.error('Error parsing PDF:', error);
        alert('Failed to parse PDF file.');
        elements.loader.classList.add('hidden');
    }
}

// Reading Engine
function togglePlay() {
    if (state.words.length === 0) return;

    state.isPlaying = !state.isPlaying;
    elements.playPauseBtn.textContent = state.isPlaying ? '⏸' : '▶';

    if (state.isPlaying) {
        if (!state.startTime) state.startTime = Date.now();
        startStatsInterval();
        runLoop();
    } else {
        stopStatsInterval();
        clearTimeout(state.timer);
    }
}

function runLoop() {
    if (!state.isPlaying || state.currentIndex >= state.words.length) {
        if (state.currentIndex >= state.words.length) {
            state.isPlaying = false;
            elements.playPauseBtn.textContent = '▶';
            stopStatsInterval();
            saveSession(); // Auto-save when finished
        }
        return;
    }

    const word = state.words[state.currentIndex];

    // Handle Paragraph Breaks
    if (word === '---PARA---') {
        state.currentIndex++;
        const baseDelay = 60000 / state.wpm;
        state.timer = setTimeout(runLoop, baseDelay * 2.0);
        return;
    }

    displayWord(word);

    // Calculate delay
    const baseDelay = 60000 / state.wpm;
    let multiplier = 1.0;

    // Smart Timing Rules
    if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) {
        multiplier = 1.6;
    } else if (word.endsWith(',') || word.endsWith(';') || word.endsWith(':')) {
        multiplier = 1.3;
    }

    if (word.length > 8) {
        multiplier *= 1.2;
    }

    // Paragraph breaks (simulated by checking if word was followed by newline in original text or just long enough gaps)
    // For now we keep it simple since we flattened whitespace, but could be improved.

    state.currentIndex++;
    updateStats();
    updateContextHighlight();

    state.timer = setTimeout(runLoop, baseDelay * multiplier);
}

function updateContextHighlight() {
    if (elements.contextView.classList.contains('hidden')) return;

    const newSentenceIndex = state.sentences.findIndex(s =>
        state.currentIndex >= s.startIndex && state.currentIndex <= s.endIndex
    );

    if (newSentenceIndex !== state.currentSentenceIndex && newSentenceIndex !== -1) {
        state.currentSentenceIndex = newSentenceIndex;

        const sentenceElements = elements.contextContent.querySelectorAll('.context-sentence');
        sentenceElements.forEach((el, idx) => {
            el.classList.remove('active', 'read');
            if (idx === state.currentSentenceIndex) {
                el.classList.add('active');
            } else if (idx < state.currentSentenceIndex) {
                el.classList.add('read');
            }
        });

        scrollToActiveSentence();
    }
}

function scrollToActiveSentence() {
    const activeEl = elements.contextContent.querySelector('.context-sentence.active');
    if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function renderContextView() {
    elements.contextContent.innerHTML = '';
    state.sentences.forEach((s, i) => {
        const span = document.createElement('span');
        span.className = 'context-sentence';
        span.textContent = s.words.join(' ') + ' ';
        span.dataset.index = i;
        span.addEventListener('click', () => {
            state.currentIndex = s.startIndex;
            updateDisplay();
            updateStats();
            updateContextHighlight();
        });
        elements.contextContent.appendChild(span);
    });
}

function displayWord(word) {
    const orpIndex = getORPIndex(word);
    const before = word.substring(0, orpIndex);
    const orp = word.substring(orpIndex, orpIndex + 1);
    const after = word.substring(orpIndex + 1);

    elements.wordTarget.innerHTML = `
        <span class="before">${before}</span><span class="orp-red">${orp}</span><span class="after">${after}</span>
    `;
}

function getORPIndex(word) {
    const len = word.length;
    if (len <= 1) return 0;
    if (len <= 5) return 1;
    if (len <= 9) return 2;
    if (len <= 13) return 3;
    return 4;
}

function restartReading() {
    state.currentIndex = 0;
    state.startTime = Date.now();
    updateDisplay();
    updateStats();
    updateContextHighlight();
    if (state.isPlaying) {
        clearTimeout(state.timer);
        runLoop();
    }
}

function skipWords(n) {
    state.currentIndex = Math.max(0, Math.min(state.words.length - 1, state.currentIndex + n));
    updateDisplay();
    updateStats();
    updateContextHighlight();

    if (state.isPlaying) {
        clearTimeout(state.timer);
        runLoop();
    }
}

function updateWPM(wpm) {
    state.wpm = Math.max(100, Math.min(800, wpm));
    elements.wpmSlider.value = state.wpm;
    elements.wpmValue.textContent = state.wpm;
    elements.statWpm.textContent = state.wpm;

    // Update preset active state
    elements.presets.forEach(btn => {
        if (parseInt(btn.dataset.wpm) === state.wpm) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    saveToLocalStorage();
}

function updateDisplay() {
    if (state.words.length > 0 && state.currentIndex < state.words.length) {
        displayWord(state.words[state.currentIndex]);
    } else if (state.words.length > 0 && state.currentIndex >= state.words.length) {
        elements.wordTarget.textContent = "Finished!";
    } else {
        elements.wordTarget.innerHTML = '<span class="initial-message">Upload a file or paste text to start</span>';
    }
}

function updateStats() {
    // Count real words up to current index
    const realWordsRead = state.words.slice(0, state.currentIndex).filter(t => t !== '---PARA---').length;

    // Progress %
    const progress = state.totalWords > 0 ? (realWordsRead / state.totalWords) * 100 : 0;
    elements.progressBar.style.width = `${progress}%`;
    elements.statProgress.textContent = `${Math.round(progress)}%`;

    // Words
    elements.statWords.textContent = `${realWordsRead}/${state.totalWords}`;

    // Remaining Time
    if (state.totalWords > 0) {
        const remainingWords = state.totalWords - realWordsRead;
        const minutes = remainingWords / state.wpm;
        const sec = Math.floor(minutes * 60);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        elements.statRemaining.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }
}

function startStatsInterval() {
    if (state.statsInterval) clearInterval(state.statsInterval);
    state.statsInterval = setInterval(() => {
        if (state.isPlaying && state.startTime) {
            const now = Date.now();
            const diff = Math.floor((now - state.startTime) / 1000);
            const m = Math.floor(diff / 60);
            const s = diff % 60;
            elements.statSession.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function stopStatsInterval() {
    if (state.statsInterval) clearInterval(state.statsInterval);
}

// History Management
function saveSession() {
    const realWordsRead = state.words.slice(0, state.currentIndex).filter(t => t !== '---PARA---').length;
    if (realWordsRead < 5) return; // Don't save tiny or empty sessions

    const session = {
        id: Date.now(),
        title: state.currentTitle,
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        wpm: state.wpm,
        wordsRead: realWordsRead,
        totalWords: state.totalWords,
        progress: Math.round((realWordsRead / state.totalWords) * 100),
        time: elements.statSession.textContent
    };

    state.history.unshift(session);
    if (state.history.length > 20) state.history.pop(); // Keep last 20

    saveToLocalStorage();
    renderHistory();
}

function renderHistory() {
    if (state.history.length === 0) {
        elements.historyList.innerHTML = '<p class="empty-history">No reading sessions saved yet.</p>';
        return;
    }

    elements.historyList.innerHTML = '';
    state.history.forEach(session => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
            <div class="history-info">
                <div class="history-title">${session.title}</div>
                <div class="history-date">${session.date}</div>
            </div>
            <div class="history-stat">
                <span class="history-stat-label">WPM</span>
                <span class="history-stat-value">${session.wpm}</span>
            </div>
            <div class="history-stat">
                <span class="history-stat-label">Progress</span>
                <span class="history-stat-value">${session.progress}%</span>
            </div>
            <div class="history-stat">
                <span class="history-stat-label">Time</span>
                <span class="history-stat-value">${session.time}</span>
            </div>
        `;
        elements.historyList.appendChild(card);
    });
}

// Local Storage
function saveToLocalStorage() {
    localStorage.setItem('speedread_wpm', state.wpm);
    localStorage.setItem('speedread_history', JSON.stringify(state.history));
}

function loadFromLocalStorage() {
    const savedWPM = localStorage.getItem('speedread_wpm');
    if (savedWPM) {
        updateWPM(parseInt(savedWPM));
    }

    const savedHistory = localStorage.getItem('speedread_history');
    if (savedHistory) {
        state.history = JSON.parse(savedHistory);
        renderHistory();
    }
}

// Start the app
init();
