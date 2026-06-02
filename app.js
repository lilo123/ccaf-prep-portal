/**
 * app.js
 * State Orchestrator and Event Handlers for CCAF Prep Website.
 * Integrates tab-resilient recovery, lightweight persistence, and cheat-proof timers.
 */

// Active state manager
let state = {
  sessionType: null,     // 'study', 'sprint', 'exam'
  questions: [],         // Storing lightweight reference pointers
  currentIndex: 0,
  selections: {},        // { "CCAF-1-001": "opt_3", ... }
  endTimestamp: null,
  timerInterval: null,
  selectedDomain: null
};

// LocalStorage Key constants
const STORAGE_MASTERY = 'CCAF_MASTERY_LOG';
const STORAGE_SESSION = 'CCAF_ACTIVE_SESSION';
const APP_VERSION = '1.5.1';

/**
 * Initialize Application and Event Listeners
 */
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  bindEvents();
});

/**
 * Initial load state: restores mastery stats and audits/resumes active session backups
 */
function initApp() {
  // Initialize Premium Light/Dark Theme preference with defensive matchMedia guard
  const isDarkModePreferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('CCAF_APP_THEME') || (isDarkModePreferred ? 'dark' : 'light');
  setAppTheme(savedTheme);

  // Force state recovery migration on upgraded app versions
  if (localStorage.getItem('CCAF_APP_VERSION') !== APP_VERSION) {
    console.warn('New version detected. Force-clearing old storage sessions.');
    localStorage.removeItem(STORAGE_SESSION);
    localStorage.setItem('CCAF_APP_VERSION', APP_VERSION);
  }

  const masteryLog = loadMasteryLog();
  window.CCAF_UI.renderMasteryGrid(masteryLog);

  // tab-resilient recovery audit: check if an active session is stored in localStorage
  const savedSession = localStorage.getItem(STORAGE_SESSION);
  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      const now = Date.now();

      // Enforce zeroed runtime execution parameters on restoration
      parsed.timerInterval = null;

      // If timer was configured and has already expired during tab-close/refresh, auto-submit immediately!
      if (parsed.endTimestamp && window.CCAF_LOGIC.calculateRemainingTime(parsed.endTimestamp, now) <= 0) {
        console.warn('Saved session detected but timer expired offline. Auto-submitting results.');
        state = parsed;
        submitSession(true); // Auto-submit expired exam
      } else {
        // Resume active session safely
        state = parsed;
        console.log('Successfully resumed active session from storage:', state.sessionType);
        resumeSession();
      }
    } catch (e) {
      console.error('Failed to parse saved session backup:', e);
      clearActiveSession();
      window.CCAF_UI.switchView('dashboard'); // Explicitly transition on corrupted state recovery
    }
  } else {
    window.CCAF_UI.switchView('dashboard');
  }
}

/**
 * Bind UI Click Events
 */
function bindEvents() {
  const ui = window.CCAF_UI;

  // Persistent Theme Toggle click
  ui.el.themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setAppTheme(newTheme);
  });

  // Home Nav clicks - Consistent guard and background timer persistence
  ui.el.homeBtn.addEventListener('click', () => {
    if (state.sessionType && (state.sessionType === 'exam' || state.sessionType === 'sprint')) {
      if (!confirm('Warning: Leaving this active session will not freeze the timer. Return to Dashboard?')) {
        return;
      }
    }
    // Switch view but maintain active session background monitoring
    window.CCAF_UI.switchView('dashboard');
    window.CCAF_UI.updateDashboardResumeState(state);
  });

  // Launch study Setup Panel with defensive active session guard
  ui.el.launchStudyBtn.addEventListener('click', () => {
    if (state.sessionType && !confirm('Start new session and discard active progress?')) return;
    ui.renderDomainSelectors(startStudyDrill);
    ui.switchView('studySetup');
  });

  // Launch 10-Minute Sprint Session with defensive active session guard
  ui.el.launchSprintBtn.addEventListener('click', () => {
    if (state.sessionType && !confirm('Start new session and discard active progress?')) return;
    startSprintSession();
  });

  // Launch Mock Exam Session with defensive active session guard
  ui.el.launchExamBtn.addEventListener('click', () => {
    if (state.sessionType && !confirm('Start new session and discard active progress?')) return;
    startMockExamSession();
  });

  // Navigation controls inside active sessions
  ui.el.prevBtn.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      saveSessionBackup();
      renderCurrentQuestion();
    }
  });

  ui.el.nextBtn.addEventListener('click', () => {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex++;
      saveSessionBackup();
      renderCurrentQuestion();
    } else if (state.sessionType === 'study' || state.sessionType === 'sprint') {
      // For study drills and sprints, reaching the end triggers immediate completion
      submitSession();
    }
  });

  // Manual submit trigger for mock exams
  ui.el.submitBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to submit your Mock Exam now?')) {
      submitSession();
    }
  });

  // Results Return Nav
  ui.el.resultsDashboardBtn.addEventListener('click', () => {
    const masteryLog = loadMasteryLog();
    window.CCAF_UI.renderMasteryGrid(masteryLog);
    window.CCAF_UI.switchView('dashboard');
    window.CCAF_UI.updateDashboardResumeState(state);
  });

  // Visibility change handling for background tab timer un-throttling reconciliation
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.endTimestamp && state.sessionType) {
      const now = Date.now();
      const remainingSec = window.CCAF_LOGIC.calculateRemainingTime(state.endTimestamp, now);
      if (remainingSec <= 0) {
        console.warn('Timer expired while tab was inactive. Auto-submitting.');
        submitSession(true);
      }
    }
  });
}

// ==========================================
// DATA PERSISTENCE MANAGEMENT
// ==========================================

function loadMasteryLog() {
  const raw = localStorage.getItem(STORAGE_MASTERY);
  return raw ? JSON.parse(raw) : { seen: {} };
}

function saveMasteryLog(log) {
  localStorage.setItem(STORAGE_MASTERY, JSON.stringify(log));
}

function saveSessionBackup() {
  // Exclude transient interval IDs from disk persistence to avoid zombie timer collisions
  const { timerInterval, ...serializableState } = state;
  localStorage.setItem(STORAGE_SESSION, JSON.stringify(serializableState));
}

function clearActiveSession() {
  stopTimerInterval(); // Ensure runtime intervals are securely terminated first
  localStorage.removeItem(STORAGE_SESSION);
  state = {
    sessionType: null,
    questions: [],
    currentIndex: 0,
    selections: {},
    endTimestamp: null,
    timerInterval: null,
    selectedDomain: null
  };
  if (window.CCAF_UI && window.CCAF_UI.updateDashboardResumeState) {
    window.CCAF_UI.updateDashboardResumeState(state);
  }
}

// ==========================================
// SESSION EXECUTION ENGINES
// ==========================================

/**
 * Prepares lightweight reference pointers of session questions, dynamically randomizing
 * stable option ID positions to minimize persistent storage overhead.
 */
function prepareSessionQuestions(questions) {
  return questions.map(q => ({
    id: q.id,
    domain: q.domain,
    optionOrder: window.CCAF_LOGIC.shuffleArray(q.options.map(o => o.id))
  }));
}

/**
 * Initiates a local Domain Study Drill
 */
function startStudyDrill(domainId) {
  // Validate domain pool prior to clearing active session state
  const domainPool = window.CCAF_DATABASE_INDEX.byDomain[domainId] || [];
  if (domainPool.length === 0) {
    alert('Database Error: No questions found for the selected domain.');
    return;
  }

  stopTimerInterval();
  clearActiveSession();

  state.sessionType = 'study';
  state.selectedDomain = domainId;
  state.questions = prepareSessionQuestions(window.CCAF_LOGIC.shuffleArray(domainPool));
  state.currentIndex = 0;
  state.selections = {};

  saveSessionBackup();
  resumeSession();
}

/**
 * Initiates an Adaptive 10-Minute Study Sprint
 */
function startSprintSession() {
  stopTimerInterval();
  clearActiveSession();

  const masteryLog = loadMasteryLog();
  const sprintQuestions = window.CCAF_LOGIC.drawSprintQuestions(window.CCAF_DATABASE, masteryLog);

  state.sessionType = 'sprint';
  state.questions = prepareSessionQuestions(sprintQuestions);
  state.currentIndex = 0;
  state.selections = {};
  
  // Configure absolute end epoch: 10 minutes (600,000 ms)
  state.endTimestamp = Date.now() + 600000;

  saveSessionBackup();
  resumeSession();
}

/**
 * Initiates a proportional Mock Exam (60 MCQs, 120 mins)
 */
function startMockExamSession() {
  stopTimerInterval();
  clearActiveSession();

  const examQuestions = window.CCAF_LOGIC.drawMockExamQuestions(window.CCAF_DATABASE);

  state.sessionType = 'exam';
  state.questions = prepareSessionQuestions(examQuestions);
  state.currentIndex = 0;
  state.selections = {};
  
  // Configure absolute end epoch: 120 minutes (7,200,000 ms)
  state.endTimestamp = Date.now() + 7200000;

  saveSessionBackup();
  resumeSession();
}

/**
 * Resumes the session states, header labels, and timer ticks
 */
function resumeSession() {
  const ui = window.CCAF_UI;
  
  if (state.sessionType === 'study') {
    ui.el.sessionTitle.textContent = `Study Drill: Domain ${state.selectedDomain}`;
    ui.el.sessionTimerBadge.style.display = 'none';
    ui.el.submitBtn.style.display = 'none';
  } else if (state.sessionType === 'sprint') {
    ui.el.sessionTitle.textContent = '10-Minute Study Sprint';
    ui.el.sessionTimerBadge.style.display = 'flex';
    ui.el.submitBtn.style.display = 'none';
    startTimerInterval();
    if (!state.sessionType) return; // Halt view transition if timer immediately auto-submitted
  } else if (state.sessionType === 'exam') {
    ui.el.sessionTitle.textContent = 'CCAF Simulated Mock Exam';
    ui.el.sessionTimerBadge.style.display = 'flex';
    ui.el.submitBtn.style.display = 'inline-block';
    startTimerInterval();
    if (!state.sessionType) return; // Halt view transition if timer immediately auto-submitted
  }

  ui.switchView('session');
  renderCurrentQuestion();
}

/**
 * Starts the active interval tick, auditing expired countdowns on every tick
 */
function startTimerInterval() {
  stopTimerInterval();
  let warningActive = false; // Cache DOM warning state locally

  const tick = () => {
    const now = Date.now();
    const remainingSec = window.CCAF_LOGIC.calculateRemainingTime(state.endTimestamp, now);

    if (remainingSec <= 0) {
      stopTimerInterval();
      console.warn('Session timer expired during active run. Auto-submitting.');
      if (state.sessionType) {
        submitSession(true); // Auto-submit expired session
      }
    } else {
      // Render countdown string MM:SS
      const minutes = Math.floor(remainingSec / 60);
      const seconds = remainingSec % 60;
      const displayStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      window.CCAF_UI.el.sessionTimerText.textContent = displayStr;

      // Visual alarm highlight if less than 60 seconds remain
      if (remainingSec < 60 && !warningActive) {
        window.CCAF_UI.el.sessionTimerBadge.classList.add('warning');
        warningActive = true;
      } else if (remainingSec >= 60 && warningActive) {
        window.CCAF_UI.el.sessionTimerBadge.classList.remove('warning');
        warningActive = false;
      }
    }
  };

  const initialRemaining = window.CCAF_LOGIC.calculateRemainingTime(state.endTimestamp, Date.now());
  if (initialRemaining <= 0) {
    console.warn('Session timer already expired prior to interval start. Auto-submitting.');
    if (state.sessionType) {
      submitSession(true);
    }
  } else {
    tick(); // Initial tick execution
    if (state.sessionType) { // Guarantee state was not wiped during tick()
      state.timerInterval = setInterval(tick, 1000);
    }
  }
}

function stopTimerInterval() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

/**
 * Renders the active question card based on session view mode rules
 */
function renderCurrentQuestion() {
  const ui = window.CCAF_UI;
  const currentQ = state.questions[state.currentIndex];
  if (!currentQ) return;
  const userSelection = state.selections[currentQ.id];

  // Rule: Mock Exam does NOT reveal correctness, only selection highlights.
  // Study and Sprint Modes reveal immediate traps/feedback upon choice.
  const isEvaluatedMode = (state.sessionType !== 'exam');

  ui.renderQuestion(currentQ, userSelection, isEvaluatedMode, (selectedOptId) => {
    // Handle choice selection
    state.selections[currentQ.id] = selectedOptId;
    saveSessionBackup();
  });

  ui.updateProgressBar(state.currentIndex, state.questions.length);

  // Toggle navigation buttons states
  ui.el.prevBtn.style.visibility = state.currentIndex === 0 ? 'hidden' : 'visible';
  
  if (state.currentIndex === state.questions.length - 1) {
    if (state.sessionType === 'exam') {
      ui.el.nextBtn.style.display = 'none'; // Conceal dead Next button on final exam question
    } else {
      ui.el.nextBtn.style.display = 'inline-block';
      ui.el.nextBtn.textContent = 'Finish Drill';
    }
  } else {
    ui.el.nextBtn.style.display = 'inline-block';
    ui.el.nextBtn.textContent = 'Next';
  }
}

/**
 * Evaluates, serializes statistics to localStorage, and opens the score results panel
 */
function submitSession(isAutoSubmitted = false) {
  stopTimerInterval();

  const results = window.CCAF_LOGIC.evaluateExam(state.questions, state.selections);
  
  // Persist correctness statistics to localStorage
  const masteryLog = loadMasteryLog();
  results.historyUpdates.forEach(item => {
    // Only register a mastery update if the user actively attempted a selection
    if (state.selections[item.id] !== undefined) {
      if (!masteryLog.seen[item.id]) {
        masteryLog.seen[item.id] = { correctCount: 0, incorrectCount: 0 };
      }
      
      if (item.isCorrect) {
        masteryLog.seen[item.id].correctCount++;
      } else {
        masteryLog.seen[item.id].incorrectCount++;
      }
    }
  });
  saveMasteryLog(masteryLog);

  // Render result scores sheets
  window.CCAF_UI.renderResults(results);
  window.CCAF_UI.switchView('results');

  // Clean active backups
  clearActiveSession();

  if (isAutoSubmitted) {
    // Non-blocking invocation allows UI view to paint fully before alerting user
    setTimeout(() => {
      alert('Time Limit Expired! Your answers have been automatically evaluated.');
    }, 100);
  }
}

/**
 * Theme Preference Manager
 */
function setAppTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('CCAF_APP_THEME', theme);

  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');

  if (sunIcon && moonIcon) {
    if (theme === 'dark') {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    } else {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    }
  }
}
