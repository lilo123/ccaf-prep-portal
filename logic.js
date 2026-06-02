/**
 * logic.js
 * Pure, decoupled business logic for CCAF Study & Mock Exam Website.
 * Contains zero DOM/window dependencies. 100% testable.
 */

// Fisher-Yates Shuffle for pure random sampling
function shuffleArray(array) {
  if (!Array.isArray(array)) return [];
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Helper: Partial Fisher-Yates sample to select k elements efficiently
 * without shuffling the entire pool. O(k) time after cloning/slicing.
 */
function sampleRandom(array, k) {
  if (!Array.isArray(array)) return [];
  if (typeof k !== 'number' || isNaN(k) || k <= 0) return [];
  k = Math.floor(k);
  if (k >= array.length) return shuffleArray(array);
  const arr = [...array];
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, k);
}

/**
 * 1. Proportional Mock Exam Draw Engine
 * Draws exactly 60 questions matching official syllabus weights:
 * Domain 1: 16, Domain 2: 11, Domain 3: 12, Domain 4: 12, Domain 5: 9
 */
function drawMockExamQuestions(database) {
  if (!Array.isArray(database)) throw new Error('Database Error: Invalid database provided');

  const domainDrawLimits = { 1: 16, 2: 11, 3: 12, 4: 12, 5: 9 };
  
  // Single-pass grouping (O(N)) using precomputed index if available
  let domainPools;
  if (database.INDEX && database.INDEX.byDomain) {
    domainPools = database.INDEX.byDomain;
  } else {
    domainPools = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (let i = 0; i < database.length; i++) {
      const q = database[i];
      if (!q || typeof q !== 'object') continue;
      if (domainPools[q.domain]) {
        domainPools[q.domain].push(q);
      }
    }
  }

  const drawn = [];
  for (let d = 1; d <= 5; d++) {
    const pool = domainPools[d] || [];
    const limit = domainDrawLimits[d];
    
    if (pool.length < limit) {
      throw new Error(`Database Error: Insufficient questions in Domain ${d} (Found ${pool.length}, required ${limit})`);
    }
    
    drawn.push(...sampleRandom(pool, limit));
  }

  return shuffleArray(drawn); // Final shuffle to mix domains
}

/**
 * 2. Adaptive Sprint Sampling Engine
 * Draws 10 questions prioritizing unseen, then missed, then mastered items.
 * historyLog format: { seen: { "CCAF-1-001": { correctCount: 0, incorrectCount: 1 } } }
 */
function drawSprintQuestions(database, historyLog = {}) {
  if (!Array.isArray(database)) return [];
  const seenHistory = (historyLog && historyLog.seen) || {};

  // Categorize database into tiered priority sets in a single pass
  const unseen = [];
  const missed = [];
  const mastered = [];

  for (let i = 0; i < database.length; i++) {
    const q = database[i];
    if (!q || typeof q !== 'object' || !q.id) continue;
    const record = seenHistory[q.id];
    
    if (!record) {
      unseen.push(q);
    } else {
      // Numerical type safety guard against corrupted stringified history storage
      const correct = Number(record.correctCount) || 0;
      const incorrect = Number(record.incorrectCount) || 0;
      const totalAttempts = correct + incorrect;
      
      if (totalAttempts === 0) {
        unseen.push(q);
      } else {
        const accuracy = correct / totalAttempts;
        if (accuracy < 0.75) {
          missed.push(q);
        } else {
          mastered.push(q);
        }
      }
    }
  }

  let drawn = [];
  
  // Tier 1: Draw up to 10 from unseen
  if (unseen.length >= 10) {
    drawn = sampleRandom(unseen, 10);
  } else {
    drawn = [...unseen]; // Slicing directly without intermediate redundant shuffling
    const neededFromMissed = 10 - drawn.length;
    
    // Tier 2: Backfill from missed
    if (missed.length >= neededFromMissed) {
      drawn = drawn.concat(sampleRandom(missed, neededFromMissed));
    } else {
      drawn = drawn.concat(missed);
      const neededFromMastered = 10 - drawn.length;
      
      // Tier 3: Backfill from mastered
      drawn = drawn.concat(sampleRandom(mastered, neededFromMastered));
    }
  }

  return shuffleArray(drawn); // Single final shuffle to randomize presentation order
}

/**
 * 3. Countdown Time Recalculation Logic
 * Evaluates epoch end timestamp against active epoch current time.
 * Returns remaining seconds, capped at 0.
 */
function calculateRemainingTime(endTimestampMs, currentTimestampMs) {
  if (typeof endTimestampMs !== 'number' || isNaN(endTimestampMs) || endTimestampMs <= 0) return 0;
  if (typeof currentTimestampMs !== 'number' || isNaN(currentTimestampMs)) {
    currentTimestampMs = Date.now();
  }
  
  const diffMs = endTimestampMs - currentTimestampMs;
  if (diffMs <= 0) return 0;
  // Use Math.ceil to prevent sub-second remaining times (e.g. 800ms) from premature auto-submission
  return Math.ceil(diffMs / 1000);
}

/**
 * 4. Exam Evaluation & Scoring Diagnostics
 * Evaluates user answer selections against database.
 * selections format: { "CCAF-1-001": "A", "CCAF-1-002": "opt_3" }
 * Note: Returns historyUpdates for all drawn questions; consuming persistence orchestrators
 * must filter unattempted selections when appending to cumulative mastery records.
 */
function evaluateExam(drawnQuestions, selections) {
  if (!Array.isArray(drawnQuestions) || drawnQuestions.length === 0) {
    return {
      score: 0,
      totalQuestions: 0,
      percentage: 0,
      isPass: false,
      domainBreakdowns: { 1: { correct: 0, total: 0 }, 2: { correct: 0, total: 0 }, 3: { correct: 0, total: 0 }, 4: { correct: 0, total: 0 }, 5: { correct: 0, total: 0 } },
      historyUpdates: []
    };
  }

  const safeSelections = selections || {};
  let correctCount = 0;
  let validQuestionCount = 0;
  const domainBreakdowns = {
    1: { correct: 0, total: 0 },
    2: { correct: 0, total: 0 },
    3: { correct: 0, total: 0 },
    4: { correct: 0, total: 0 },
    5: { correct: 0, total: 0 }
  };
  const historyUpdates = [];

  // Antipattern fix: Cache module index lookups outside the evaluation loop
  let cachedNodeIndex = null;
  if (typeof module !== 'undefined' && module.exports) {
    try {
      const db = require('./questions.js');
      if (db && db.INDEX && db.INDEX.byId) {
        cachedNodeIndex = db.INDEX.byId;
      }
    } catch (err) {}
  }

  for (let i = 0; i < drawnQuestions.length; i++) {
    const q = drawnQuestions[i];
    if (!q || typeof q !== 'object' || !q.id) continue;
    
    // Support both full question objects and lightweight reference pointers
    let qObj = q;
    if (!Array.isArray(q.options)) {
      if (typeof window !== 'undefined' && window.CCAF_DATABASE_INDEX && window.CCAF_DATABASE_INDEX.byId && window.CCAF_DATABASE_INDEX.byId.has(q.id)) {
        qObj = window.CCAF_DATABASE_INDEX.byId.get(q.id);
      } else if (cachedNodeIndex && cachedNodeIndex.has(q.id)) {
        qObj = cachedNodeIndex.get(q.id);
      }
    }

    // Defensive guard: skip unresolved pointers without polluting diagnostics
    if (!qObj || !Array.isArray(qObj.options) || qObj.options.length === 0) continue;

    validQuestionCount++;
    const rawAns = safeSelections[qObj.id];
    let isUserCorrect = false;

    const correctOptIndex = qObj.options.findIndex(opt => opt.isCorrect);
    if (correctOptIndex !== -1) {
      const correctOpt = qObj.options[correctOptIndex];
      const correctOptLetter = String.fromCharCode(65 + correctOptIndex); // A, B, C, D

      if (typeof rawAns === 'string' && rawAns.trim().length > 0) {
        const normAns = rawAns.trim().toUpperCase();
        
        if (normAns.startsWith('OPT_')) {
          if (correctOpt.id) {
            isUserCorrect = (normAns.toLowerCase() === correctOpt.id.toLowerCase());
          } else {
            // Fallback for custom objects lacking opt.id: deduce index from opt_# string
            const deducedIndex = parseInt(normAns.replace('OPT_', ''), 10) - 1;
            isUserCorrect = (deducedIndex === correctOptIndex);
          }
        } else {
          // Dynamic letter evaluation bounds
          const firstChar = normAns.charAt(0);
          const maxLetter = String.fromCharCode(65 + qObj.options.length - 1);
          
          if (firstChar >= 'A' && firstChar <= maxLetter) {
            if (Array.isArray(q.optionOrder) && q.optionOrder.length === qObj.options.length) {
              const letterIndex = firstChar.charCodeAt(0) - 65;
              const selectedOptId = q.optionOrder[letterIndex];
              if (selectedOptId && correctOpt.id) {
                isUserCorrect = (selectedOptId.toLowerCase() === correctOpt.id.toLowerCase());
              } else {
                isUserCorrect = (firstChar === correctOptLetter);
              }
            } else {
              isUserCorrect = (firstChar === correctOptLetter);
            }
          }
        }
      }
    }

    // Clean code accounting structure: initialize missing domains prior to modification
    if (!domainBreakdowns[qObj.domain]) {
      domainBreakdowns[qObj.domain] = { correct: 0, total: 0 };
    }
    
    if (isUserCorrect) {
      correctCount++;
      domainBreakdowns[qObj.domain].correct++;
    }
    domainBreakdowns[qObj.domain].total++;

    historyUpdates.push({
      id: qObj.id,
      isCorrect: isUserCorrect
    });
  }

  if (validQuestionCount === 0) {
    return {
      score: 0,
      totalQuestions: 0,
      percentage: 0,
      isPass: false,
      domainBreakdowns,
      historyUpdates
    };
  }

  const totalQuestions = validQuestionCount;
  // Prevent floating-point imprecision in floored percentage calculation (e.g. 29/100 * 100)
  const percentage = Math.floor((correctCount * 100) / totalQuestions);
  const isPass = (correctCount * 100) >= (totalQuestions * 72);

  return {
    score: correctCount,
    totalQuestions,
    percentage,
    isPass,
    domainBreakdowns,
    historyUpdates
  };
}

// Universal Module Export for cross-platform compatibility
const CCAF_LOGIC = {
  shuffleArray,
  drawMockExamQuestions,
  drawSprintQuestions,
  calculateRemainingTime,
  evaluateExam
};

if (typeof window !== 'undefined') {
  window.CCAF_LOGIC = CCAF_LOGIC;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CCAF_LOGIC;
}
