/**
 * ui.js
 * Modernized UI Rendering and Dynamic DOM Generators for CCAF Prep Portal.
 * Leverages premium dark/light variable transitions, circular selectors, and custom SVGs.
 */

// Select DOM views
const views = {
  dashboard: document.getElementById('view-dashboard'),
  studySetup: document.getElementById('view-study-setup'),
  session: document.getElementById('view-session'),
  results: document.getElementById('view-results')
};

// Select elements
const el = {
  homeBtn: document.getElementById('btn-home'),
  themeToggleBtn: document.getElementById('btn-theme-toggle'),
  masteryGrid: document.getElementById('dashboard-mastery-grid'),
  domainSelectorGrid: document.getElementById('study-domain-selector-grid'),
  sessionTitle: document.getElementById('session-title-text'),
  sessionTimerBadge: document.getElementById('session-timer-badge'),
  sessionTimerText: document.getElementById('session-timer-text'),
  sessionProgressFill: document.getElementById('session-progress-fill'),
  sessionProgressText: document.getElementById('session-progress-text'),
  questionContainer: document.getElementById('active-question-container'),
  prevBtn: document.getElementById('btn-prev-question'),
  nextBtn: document.getElementById('btn-next-question'),
  submitBtn: document.getElementById('btn-submit-exam'),
  resultsStatusCard: document.getElementById('results-status-card'),
  resultsScoreText: document.getElementById('results-score-text'),
  resultsPercentageText: document.getElementById('results-percentage-text'),
  resultsBreakdownTbody: document.getElementById('results-breakdown-tbody'),
  resultsDashboardBtn: document.getElementById('btn-results-dashboard'),
  launchStudyBtn: document.getElementById('launch-study'),
  launchSprintBtn: document.getElementById('launch-sprint'),
  launchExamBtn: document.getElementById('launch-exam')
};

// Global names for CCAF Domains
const DOMAIN_NAMES = {
  1: "Domain 1: Agentic Architecture & Orchestration",
  2: "Domain 2: Tool Design & MCP Integration",
  3: "Domain 3: Claude Code Configuration & Workflows",
  4: "Domain 4: Prompt Engineering & Structured Output",
  5: "Domain 5: Context Management & Reliability"
};

const DOMAIN_DESCRIPTIONS = {
  1: "Agentic loops, state orchestration, task decomposition, and SDK hooks.",
  2: "MCP client-server integration, tool schemas, error propagation, and scopes.",
  3: "CLAUDE.md hierarchies, custom slash commands, and CI/CD review loops.",
  4: "JSON schema enforcement, few-shot examples, XML tags, and prompt caching.",
  5: "Context windows, summarization fallbacks, and human-in-the-loop (HITL) gates."
};

// Custom SVGs for the 5 Competency Domains
const DOMAIN_SVGS = {
  1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="card-icon"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
  2: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="card-icon"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>`,
  3: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="card-icon"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
  4: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="card-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
  5: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="card-icon"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`
};

/**
 * Transition to a specific view panel.
 */
function switchView(activeViewKey) {
  Object.keys(views).forEach(key => {
    if (views[key]) {
      if (key === activeViewKey) {
        views[key].classList.add('active');
      } else {
        views[key].classList.remove('active');
      }
    }
  });
}

/**
 * Update Dashboard Resume Card state
 */
function updateDashboardResumeState(currentState) {
  const existingResumeCard = document.getElementById('resume-session-card');
  if (currentState && currentState.sessionType) {
    if (!existingResumeCard) {
      const container = document.querySelector('.launcher-grid');
      if (container) {
        const resumeCard = document.createElement('div');
        resumeCard.id = 'resume-session-card';
        resumeCard.className = 'launcher-card card-full';
        resumeCard.style.borderColor = 'var(--primary)';
        resumeCard.innerHTML = `
          <h3>Active Session in Progress</h3>
          <p>You have an ongoing ${currentState.sessionType.toUpperCase()} session. Click below to return immediately.</p>
          <button id="resume-active-session" class="btn btn-success">Resume Active Session</button>
        `;
        resumeCard.querySelector('button').addEventListener('click', () => {
          if (typeof window !== 'undefined' && window.resumeSession) {
            window.resumeSession();
          } else {
            switchView('session');
          }
        });
        container.prepend(resumeCard);
      }
    }
  } else if (existingResumeCard) {
    existingResumeCard.remove();
  }
}

/**
 * Render the Mastery Progress Grid on the Home Dashboard
 */
function renderMasteryGrid(masteryLog) {
  if (!el.masteryGrid) return;
  el.masteryGrid.innerHTML = '';
  // Modern ES2020 optional chaining and nullish coalescing convention
  const seenRecords = masteryLog?.seen ?? {};

  for (let d = 1; d <= 5; d++) {
    const domainPool = window.CCAF_DATABASE_INDEX.byDomain[d] || [];
    const totalInDomain = domainPool.length;
    
    let masteredCount = 0;
    domainPool.forEach(q => {
      const rec = seenRecords[q.id];
      if (rec && (rec.correctCount > 0 || rec.incorrectCount > 0)) {
        const accuracy = rec.correctCount / (rec.correctCount + rec.incorrectCount);
        if (accuracy >= 0.75) {
          masteredCount++;
        }
      }
    });

    const percentage = totalInDomain > 0 ? Math.floor((masteredCount * 100) / totalInDomain) : 0;

    const card = document.createElement('div');
    card.className = 'mastery-card';
    card.innerHTML = `
      <div class="mastery-info">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div class="card-icon-wrapper" style="width: 28px; height: 28px; margin-bottom: 0; border-radius: 6px; color: var(--primary); flex-shrink: 0;">
            ${DOMAIN_SVGS[d]}
          </div>
          <h4 style="margin-bottom: 0;">${DOMAIN_NAMES[d].split(': ')[1]}</h4>
        </div>
        <div class="mastery-text">
          <span>${masteredCount} / ${totalInDomain} mastered</span>
        </div>
      </div>
      <div class="mastery-dial-container">
        <div class="mastery-dial" style="--progress: ${percentage}%;">
          <span class="mastery-dial-text">${percentage}%</span>
        </div>
      </div>
    `;
    el.masteryGrid.appendChild(card);
  }
}

/**
 * Render Domain Drill Selectors
 */
function renderDomainSelectors(onSelectCallback) {
  if (!el.domainSelectorGrid) return;
  el.domainSelectorGrid.innerHTML = '';
  
  for (let d = 1; d <= 5; d++) {
    const domainPool = window.CCAF_DATABASE_INDEX.byDomain[d] || [];
    const card = document.createElement('div');
    card.className = 'launcher-card';
    card.innerHTML = `
      <div class="card-icon-wrapper">
        ${DOMAIN_SVGS[d]}
      </div>
      <h3>Domain ${d}</h3>
      <h4 style="font-size: 0.95rem; color: var(--text-dark); margin-bottom: 10px; font-weight: 700;">${DOMAIN_NAMES[d].split(': ')[1]}</h4>
      <p>${DOMAIN_DESCRIPTIONS[d]}</p>
      <button class="btn btn-success" data-domain="${d}">Drill ${domainPool.length} Scenarios</button>
    `;
    
    card.querySelector('button').addEventListener('click', () => {
      onSelectCallback(d);
    });
    
    el.domainSelectorGrid.appendChild(card);
  }
}

/**
 * Reusable DRY helper function to construct the feedback box element
 */
function createFeedbackBox(isCorrect, selectedOption, referenceUrl, questionObj) {
  const feedbackBox = document.createElement('div');
  feedbackBox.className = `feedback-box ${isCorrect ? 'correct' : 'incorrect'}`;

  let explanationText = (selectedOption && selectedOption.explanation) || '';
  if (!explanationText && questionObj && Array.isArray(questionObj.options)) {
    const correctOpt = questionObj.options.find(o => o && o.isCorrect);
    if (correctOpt && correctOpt.explanation) {
      explanationText = correctOpt.explanation;
    }
  }

  feedbackBox.innerHTML = `
    <div class="feedback-title">
      ${isCorrect 
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: var(--success);"><polyline points="20 6 9 17 4 12"></polyline></svg> Correct Choice!`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: var(--error);"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Trap Selection!`
      }
    </div>
    <p style="margin-top: 8px; line-height: 1.5;">${explanationText}</p>
    <div class="ref-link-container">
      <a href="${referenceUrl}" target="_blank" class="ref-link">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
        Study official documentation reference
      </a>
    </div>
  `;
  return feedbackBox;
}

/**
 * Render a single Scenario Question Card with in-place progressive updates and DRY markup
 */
function renderQuestion(questionPointer, userSelectionOptId, isEvaluatedMode, onOptionSelectCallback) {
  if (!el.questionContainer) return;
  el.questionContainer.innerHTML = '';
  const questionObj = window.CCAF_DATABASE_INDEX.byId.get(questionPointer.id);
  if (!questionObj) return;

  const card = document.createElement('div');
  card.className = 'question-card';
  
  // Metadata header
  const meta = document.createElement('div');
  meta.className = 'question-meta';
  meta.textContent = `${questionObj.id} • Domain ${questionObj.domain} - ${DOMAIN_NAMES[questionObj.domain].split(': ')[1]}`;
  card.appendChild(meta);

  // Scenario block
  const scenario = document.createElement('div');
  scenario.className = 'scenario-text';
  scenario.textContent = questionObj.scenario;
  card.appendChild(scenario);

  // Question text
  const qText = document.createElement('div');
  qText.className = 'question-text';
  qText.textContent = questionObj.question;
  card.appendChild(qText);

  // Options list
  const optionsList = document.createElement('ul');
  optionsList.className = 'options-list';

  questionPointer.optionOrder.forEach((optId, index) => {
    const displayChar = String.fromCharCode(65 + index); // A, B, C, D for visual rendering only
    const opt = questionObj.options.find(o => o.id === optId);
    
    const item = document.createElement('li');
    item.className = 'option-item';
    item.innerHTML = `<div class="option-circle">${displayChar}</div><span class="option-text">${opt.text}</span>`;

    if (userSelectionOptId === optId) {
      item.classList.add('selected');
    }

    if (isEvaluatedMode && userSelectionOptId !== undefined) {
      if (opt.isCorrect) item.classList.add('correct');
      else if (userSelectionOptId === optId) item.classList.add('incorrect');
    }

    item.addEventListener('click', () => {
      if (isEvaluatedMode && card.querySelector('.feedback-box')) return; // Guard if already evaluated

      optionsList.querySelectorAll('.option-item').forEach(li => li.classList.remove('selected'));
      item.classList.add('selected');
      onOptionSelectCallback(optId);

      // In-place progressive enhancement for Evaluated modes without wiping DOM
      if (isEvaluatedMode && !card.querySelector('.feedback-box')) {
        optionsList.querySelectorAll('.option-item').forEach((li, idx) => {
          const currentOptId = questionPointer.optionOrder[idx];
          const currentOpt = questionObj.options.find(o => o.id === currentOptId);
          if (currentOpt.isCorrect) li.classList.add('correct');
          else if (currentOptId === optId) li.classList.add('incorrect');
        });

        const feedbackBox = createFeedbackBox(opt.isCorrect, opt, questionObj.reference, questionObj);
        card.appendChild(feedbackBox);
      }
    });

    optionsList.appendChild(item);
  });
  card.appendChild(optionsList);

  // Initial render of feedback box if already answered previously
  if (isEvaluatedMode && userSelectionOptId !== undefined) {
    const selectedOption = questionObj.options.find(o => o.id === userSelectionOptId);
    if (selectedOption) {
      const feedbackBox = createFeedbackBox(selectedOption.isCorrect, selectedOption, questionObj.reference, questionObj);
      card.appendChild(feedbackBox);
    }
  }

  el.questionContainer.appendChild(card);
}

/**
 * Update progress bars and headers
 */
function updateProgressBar(currentIndex, totalQuestions) {
  if (!el.sessionProgressFill || !el.sessionProgressText) return;
  const percentage = Math.floor(((currentIndex) * 100) / totalQuestions);
  el.sessionProgressFill.style.width = `${percentage}%`;
  el.sessionProgressText.textContent = `Question ${currentIndex + 1} of ${totalQuestions}`;
}

/**
 * Render Results Sheet
 */
function renderResults(evalResults) {
  if (!el.resultsStatusCard) return;
  // Render Pass/Fail Status Banner
  el.resultsStatusCard.className = `result-status-card ${evalResults.isPass ? 'pass' : 'fail'}`;
  
  el.resultsStatusCard.innerHTML = evalResults.isPass 
    ? `<div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
         <span><strong>PASSING PERFORMANCE!</strong> You have achieved the CCAF passing standard (>= 72%). Excellent work!</span>
       </div>`
    : `<div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
         <span><strong>PRACTICE REQUIRED.</strong> You are below the CCAF passing standard (72%). Focus on weak domains and re-drill!</span>
       </div>`;

  el.resultsScoreText.textContent = `${evalResults.score} / ${evalResults.totalQuestions}`;
  el.resultsPercentageText.textContent = `${evalResults.percentage}%`;

  // Render Domain Breakdowns Table
  el.resultsBreakdownTbody.innerHTML = '';
  
  for (let d = 1; d <= 5; d++) {
    const record = evalResults.domainBreakdowns[d];
    const total = record ? record.total : 0;
    const correct = record ? record.correct : 0;
    const accuracy = total > 0 ? Math.floor((correct * 100) / total) : 0;

    const tr = document.createElement('tr');
    if (total === 0) {
      tr.innerHTML = `
        <td><strong>Domain ${d}:</strong> ${DOMAIN_NAMES[d].split(': ')[1]}</td>
        <td><strong style="color: var(--text-muted, #888);">N/A</strong></td>
        <td>0/0</td>
        <td>
          <div class="progress-bar-container mini">
            <div class="progress-fill" style="width: 0%; background-color: var(--text-muted, #888);"></div>
          </div>
        </td>
      `;
    } else {
      const isPassingDomain = (correct * 100) >= (total * 72);
      tr.innerHTML = `
        <td><strong>Domain ${d}:</strong> ${DOMAIN_NAMES[d].split(': ')[1]}</td>
        <td><strong style="color: ${isPassingDomain ? 'var(--success)' : 'var(--error)'};">${accuracy}%</strong></td>
        <td>${correct}/${total}</td>
        <td>
          <div class="progress-bar-container mini">
            <div class="progress-fill" style="width: ${accuracy}%; background-color: ${isPassingDomain ? 'var(--success)' : 'var(--error)'};"></div>
          </div>
        </td>
      `;
    }
    el.resultsBreakdownTbody.appendChild(tr);
  }
}

window.CCAF_UI = {
  switchView,
  updateDashboardResumeState,
  renderMasteryGrid,
  renderDomainSelectors,
  renderQuestion,
  updateProgressBar,
  renderResults,
  DOMAIN_NAMES,
  el
};
