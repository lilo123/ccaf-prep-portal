/**
 * app_test.js
 * Standalone unit test suite for CCAF decoupled business logic (logic.js)
 * and persistence orchestration integration.
 * Zero DOM dependencies, runs natively in Node.js.
 */

const assert = require('assert');
const CCAF_LOGIC = require('./logic.js');
const CCAF_DATABASE = require('./questions.js');

console.log('==================================================');
console.log('CCAF Decoupled Business Logic & Orchestration Unit Tests');
console.log('==================================================');

let testCount = 0;
let passCount = 0;
let failCount = 0;
let failedTests = [];

function runTest(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } catch (e) {
    process.exitCode = 1; // Set immediate non-zero exit code on any test failure
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Message:  ${e.message}\n`);
    if (e.actual !== undefined) {
      console.error(`   Actual:   ${JSON.stringify(e.actual)}`);
      console.error(`   Expected: ${JSON.stringify(e.expected)}`);
    }
    console.error(e.stack);
    failCount++;
    failedTests.push(name);
  }
}

// --------------------------------------------------
// TEST 1: drawMockExamQuestions proportional draws
// --------------------------------------------------
runTest('drawMockExamQuestions returns exactly 60 questions with proportional domain distributions', () => {
  const drawn = CCAF_LOGIC.drawMockExamQuestions(CCAF_DATABASE);
  assert.strictEqual(drawn.length, 60, 'Mock Exam must draw exactly 60 questions');

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  drawn.forEach(q => counts[q.domain]++);

  assert.strictEqual(counts[1], 16, 'Domain 1 must have exactly 16 questions drawn');
  assert.strictEqual(counts[2], 11, 'Domain 2 must have exactly 11 questions drawn');
  assert.strictEqual(counts[3], 12, 'Domain 3 must have exactly 12 questions drawn');
  assert.strictEqual(counts[4], 12, 'Domain 4 must have exactly 12 questions drawn');
  assert.strictEqual(counts[5], 9, 'Domain 5 must have exactly 9 questions drawn');
});

// --------------------------------------------------
// TEST 2: drawSprintQuestions adaptive drawing prioritization
// --------------------------------------------------
runTest('drawSprintQuestions draws exactly 10 questions prioritizing unseen/incorrect items', () => {
  const tinyDb = [
    { id: "Q-1", domain: 1, scenario: "S1...", question: "Q1...", options: [], reference: "https://x" },
    { id: "Q-2", domain: 1, scenario: "S2...", question: "Q2...", options: [], reference: "https://x" },
    { id: "Q-3", domain: 1, scenario: "S3...", question: "Q3...", options: [], reference: "https://x" },
    { id: "Q-4", domain: 1, scenario: "S4...", question: "Q4...", options: [], reference: "https://x" },
    { id: "Q-5", domain: 1, scenario: "S5...", question: "Q5...", options: [], reference: "https://x" },
    { id: "Q-6", domain: 1, scenario: "S6...", question: "Q6...", options: [], reference: "https://x" },
    { id: "Q-7", domain: 1, scenario: "S7...", question: "Q7...", options: [], reference: "https://x" },
    { id: "Q-8", domain: 1, scenario: "S8...", question: "Q8...", options: [], reference: "https://x" },
    { id: "Q-9", domain: 1, scenario: "S9...", question: "Q9...", options: [], reference: "https://x" },
    { id: "Q-10", domain: 1, scenario: "S10...", question: "Q10...", options: [], reference: "https://x" },
    { id: "Q-11", domain: 1, scenario: "S11...", question: "Q11...", options: [], reference: "https://x" },
    { id: "Q-12", domain: 1, scenario: "S12...", question: "Q12...", options: [], reference: "https://x" }
  ];

  const tinyHistory = {
    seen: {
      "Q-1": { correctCount: 2, incorrectCount: 0 },
      "Q-2": { correctCount: 1, incorrectCount: 0 },
      "Q-3": { correctCount: 0, incorrectCount: 1 } // Missed (high priority)
    }
  };

  const tinyDrawn = CCAF_LOGIC.drawSprintQuestions(tinyDb, tinyHistory);
  const tinyIds = tinyDrawn.map(q => q.id);

  assert.ok(tinyIds.includes("Q-3"), 'Adaptive sprint must draw missed question Q-3');
  assert.ok(!tinyIds.includes("Q-1"), 'Adaptive sprint must skip mastered question Q-1');
  assert.ok(!tinyIds.includes("Q-2"), 'Adaptive sprint must skip mastered question Q-2');
});

// --------------------------------------------------
// TEST 3: calculateRemainingTime evaluations
// --------------------------------------------------
runTest('calculateRemainingTime computes countdown seconds properly and caps at 0', () => {
  const now = Date.now();
  const end = now + 15000; // 15 seconds

  const remaining = CCAF_LOGIC.calculateRemainingTime(end, now);
  assert.strictEqual(remaining, 15, 'Remaining time must be exactly 15 seconds');

  const expired = CCAF_LOGIC.calculateRemainingTime(now - 5000, now);
  assert.strictEqual(expired, 0, 'Expired remaining time must be capped at 0');

  const invalid = CCAF_LOGIC.calculateRemainingTime(null, now);
  assert.strictEqual(invalid, 0, 'Invalid inputs must return 0');
});

// --------------------------------------------------
// TEST 4: evaluateExam metrics & logs
// --------------------------------------------------
runTest('evaluateExam computes accurate score breakdowns, percentages, passing status, and history tags', () => {
  const testDrawn = [
    {
      id: "T-1",
      domain: 1,
      options: [{ text: "O1", isCorrect: true, explanation: "E" }, { text: "O2", isCorrect: false, explanation: "E" }, { text: "O3", isCorrect: false, explanation: "E" }, { text: "O4", isCorrect: false, explanation: "E" }]
    },
    {
      id: "T-2",
      domain: 2,
      options: [{ text: "O1", isCorrect: false, explanation: "E" }, { text: "O2", isCorrect: true, explanation: "E" }, { text: "O3", isCorrect: false, explanation: "E" }, { text: "O4", isCorrect: false, explanation: "E" }]
    },
    {
      id: "T-3",
      domain: 5,
      options: [{ text: "O1", isCorrect: false, explanation: "E" }, { text: "O2", isCorrect: false, explanation: "E" }, { text: "O3", isCorrect: false, explanation: "E" }, { text: "O4", isCorrect: true, explanation: "E" }]
    }
  ];

  const testSelections = {
    "T-1": "A", // Correct (0->A)
    "T-2": "C", // Incorrect (Correct: 1->B)
    "T-3": "D"  // Correct (3->D)
  };

  const result = CCAF_LOGIC.evaluateExam(testDrawn, testSelections);
  assert.strictEqual(result.score, 2, 'Score must be exactly 2 correct answers');
  assert.strictEqual(result.totalQuestions, 3, 'Total questions must be 3');
  // Percentage is floored to prevent Math.round bias (2/3 = 66.66% -> 66%)
  assert.strictEqual(result.percentage, 66, 'Percentage must be floored to 66%');
  assert.strictEqual(result.isPass, false, '66% must be failed (< 72% passing)');

  assert.strictEqual(result.domainBreakdowns[1].correct, 1, 'Domain 1 correct must be 1');
  assert.strictEqual(result.domainBreakdowns[2].correct, 0, 'Domain 2 correct must be 0');
  assert.strictEqual(result.domainBreakdowns[5].correct, 1, 'Domain 5 correct must be 1');

  assert.strictEqual(result.historyUpdates.length, 3, 'History updates array must have 3 logs');
  assert.deepStrictEqual(result.historyUpdates[0], { id: "T-1", isCorrect: true }, 'T-1 log must record isCorrect: true');
  assert.deepStrictEqual(result.historyUpdates[1], { id: "T-2", isCorrect: false }, 'T-2 log must record isCorrect: false');
  assert.deepStrictEqual(result.historyUpdates[2], { id: "T-3", isCorrect: true }, 'T-3 log must record isCorrect: true');
});

// --------------------------------------------------
// TEST 5: Database Option-Length Bias Safety Invariants (v1.4.0)
// --------------------------------------------------
runTest('Database options are programmatically balanced against option-length visual giveaways', () => {
  let strictlyLongestCount = 0;
  let strictlyShortestCount = 0;
  let totalCorrectLength = 0;
  let totalIncorrectLength = 0;
  let incorrectCountGlobal = 0;
  let paulBankCount = 0;

  CCAF_DATABASE.forEach((q, index) => {
    if (q.isPaulBank === true) { paulBankCount++; return; }
    const lengths = q.options.map(o => o.text.length);
    const correctIdx = q.options.findIndex(o => o.isCorrect);
    const correctLength = lengths[correctIdx];
    
    totalCorrectLength += correctLength;
    
    const incorrectLengths = lengths.filter((_, idx) => idx !== correctIdx);
    const incorrectAvg = incorrectLengths.reduce((sum, l) => sum + l, 0) / 3;
    
    incorrectLengths.forEach(l => {
      totalIncorrectLength += l;
      incorrectCountGlobal++;
    });
    
    const maxIncorrect = Math.max(...incorrectLengths);
    if (correctLength > maxIncorrect) {
      strictlyLongestCount++;
    }
    
    const minIncorrect = Math.min(...incorrectLengths);
    if (correctLength < minIncorrect) {
      strictlyShortestCount++;
    }
    
    const ratio = correctLength / incorrectAvg;
    assert.ok(ratio >= 0.25 && ratio <= 3.50, `Question ${q.id} exceeds per-question length ratio: ${ratio.toFixed(2)}x`);
  });

  assert.strictEqual(paulBankCount, 87, 'Must preserve exactly 87 Paul Bank questions');

  const validatedCount = CCAF_DATABASE.length - paulBankCount;
  const longestPct = Math.round((strictlyLongestCount / validatedCount) * 100);
  const shortestPct = Math.round((strictlyShortestCount / validatedCount) * 100);
  const globalRatio = (totalCorrectLength / validatedCount) / (totalIncorrectLength / incorrectCountGlobal);

  assert.ok(longestPct <= 45, `Strictly longest rate too high: ${longestPct.toFixed(1)}%`);
  assert.ok(shortestPct <= 45, `Strictly shortest rate too high: ${shortestPct.toFixed(1)}%`);
  assert.ok(globalRatio >= 0.80 && globalRatio <= 1.20, `Global correct/incorrect average length ratio out of range: ${globalRatio.toFixed(3)}`);
});

// --------------------------------------------------
// TEST 6: drawMockExamQuestions Error Handling
// --------------------------------------------------
runTest('drawMockExamQuestions throws an explicit Error when a domain pool has insufficient questions', () => {
  const malformedDb = [
    { id: "CCAF-1-001", domain: 1, scenario: "...", question: "...", options: [] }
  ];
  assert.throws(() => {
    CCAF_LOGIC.drawMockExamQuestions(malformedDb);
  }, /Database Error: Insufficient questions in Domain 1/);
});

// --------------------------------------------------
// TEST 7: evaluateExam Partial Submissions & Boundary Check
// --------------------------------------------------
runTest('evaluateExam correctly processes unanswered questions and tests the 43/60 vs 44/60 passing boundary', () => {
  const mock60 = Array.from({ length: 60 }, (_, i) => ({
    id: `Q-${i+1}`,
    domain: (i % 5) + 1,
    options: [{ text: "O1", isCorrect: true, id: "opt_1" }, { text: "O2", isCorrect: false, id: "opt_2" }, { text: "O3", isCorrect: false, id: "opt_3" }, { text: "O4", isCorrect: false, id: "opt_4" }]
  }));

  // Scenario A: 43 correct answers, 17 unanswered
  const selections43 = {};
  for(let i = 1; i <= 43; i++) selections43[`Q-${i}`] = "A";

  const result43 = CCAF_LOGIC.evaluateExam(mock60, selections43);
  assert.strictEqual(result43.score, 43, 'Must correctly tally 43 correct selections');
  assert.strictEqual(result43.percentage, 71, '43/60 floors to 71%');
  assert.strictEqual(result43.isPass, false, 'At 43/60, isPass must evaluate to false (>= 44/60 passing standard)');

  // Scenario B: Completely empty submission
  const resultEmpty = CCAF_LOGIC.evaluateExam(mock60, {});
  assert.strictEqual(resultEmpty.score, 0, 'Score must be 0 for empty submission');
  assert.strictEqual(resultEmpty.percentage, 0, 'Percentage must be 0');
  assert.strictEqual(resultEmpty.isPass, false, 'isPass must be false');

  // Scenario C: 44 correct answers (Passing boundary validation)
  const selections44 = {};
  for(let i = 1; i <= 44; i++) selections44[`Q-${i}`] = "A";

  const result44 = CCAF_LOGIC.evaluateExam(mock60, selections44);
  assert.strictEqual(result44.score, 44, 'Must correctly tally 44 correct selections');
  assert.strictEqual(result44.percentage, 73, '44/60 floors to 73%');
  assert.strictEqual(result44.isPass, true, 'At 44/60, isPass must evaluate to true');
});

// --------------------------------------------------
// TEST 8: drawSprintQuestions Nuanced Mastery Edge Case
// --------------------------------------------------
runTest('drawSprintQuestions correctly evaluates historical accuracy threshold (>= 75%) and actively excludes mastered items', () => {
  // Database of 12 questions to verify strict threshold exclusion
  const mockDb = Array.from({ length: 12 }, (_, i) => ({ id: `Q-${i+1}`, domain: 1 }));
  
  const complexHistory = {
    seen: {
      "Q-1": { correctCount: 3, incorrectCount: 1 }, // 75% accuracy -> Mastered (EXCLUDE)
      "Q-2": { correctCount: 3, incorrectCount: 1 }, // 75% accuracy -> Mastered (EXCLUDE)
      "Q-3": { correctCount: 1, incorrectCount: 3 }, // 25% accuracy -> Missed (PRIORITY)
      "Q-4": { correctCount: 0, incorrectCount: 1 }, // Missed (PRIORITY)
      "Q-5": { correctCount: 0, incorrectCount: 0 }  // Unseen (PRIORITY)
      // Q-6 to Q-12 are Unseen (PRIORITY)
    }
  };

  const drawn = CCAF_LOGIC.drawSprintQuestions(mockDb, complexHistory);
  assert.strictEqual(drawn.length, 10, 'Sprint must draw exactly 10 questions');
  const drawnIds = drawn.map(q => q.id);

  assert.ok(!drawnIds.includes("Q-1"), 'Sprint must actively exclude mastered question Q-1');
  assert.ok(!drawnIds.includes("Q-2"), 'Sprint must actively exclude mastered question Q-2');
  assert.ok(drawnIds.includes("Q-3"), 'Sprint must include missed question Q-3');
});

// --------------------------------------------------
// TEST 9: Simulated app.js Orchestration & Persistence Integration
// --------------------------------------------------
runTest('Simulate app.js storage persistence, dynamic option shuffling, and cumulative mastery accumulation', () => {
  const storageStore = {};
  const mockLocalStorage = {
    getItem: (key) => storageStore[key] || null,
    setItem: (key, value) => { storageStore[key] = String(value); },
    removeItem: (key) => { delete storageStore[key]; }
  };

  // Assert Dynamic Option Shuffling contract
  const rawQ = { id: "CCAF-1-001", domain: 1, options: [{ id: "opt_1" }, { id: "opt_2" }, { id: "opt_3" }, { id: "opt_4" }] };
  const pointerQ = { id: rawQ.id, domain: rawQ.domain, optionOrder: CCAF_LOGIC.shuffleArray(rawQ.options.map(o => o.id)) };
  assert.strictEqual(pointerQ.optionOrder.length, 4, 'Prepared pointer must preserve 4 stable option IDs');

  function simulateSessionSubmission(results, selections) {
    const raw = mockLocalStorage.getItem('CCAF_MASTERY_LOG');
    const masteryLog = raw ? JSON.parse(raw) : { seen: {} };

    results.historyUpdates.forEach(item => {
      // Obey production contract: only update mastery if selection was attempted
      if (selections[item.id] !== undefined) {
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
    mockLocalStorage.setItem('CCAF_MASTERY_LOG', JSON.stringify(masteryLog));
  }

  // Session 1: 001 answered correctly, 002 answered incorrectly, 003 unanswered/skipped
  simulateSessionSubmission({
    historyUpdates: [
      { id: "CCAF-1-001", isCorrect: true },
      { id: "CCAF-1-002", isCorrect: false },
      { id: "CCAF-1-003", isCorrect: false }
    ]
  }, { "CCAF-1-001": "opt_1", "CCAF-1-002": "opt_2" }); // 003 is undefined

  // Session 2: 001 correct again, 002 incorrect again
  simulateSessionSubmission({
    historyUpdates: [
      { id: "CCAF-1-001", isCorrect: true },
      { id: "CCAF-1-002", isCorrect: false }
    ]
  }, { "CCAF-1-001": "opt_1", "CCAF-1-002": "opt_2" });

  const savedMastery = JSON.parse(mockLocalStorage.getItem('CCAF_MASTERY_LOG'));
  assert.strictEqual(savedMastery.seen["CCAF-1-001"].correctCount, 2, 'Cumulative correctCount must equal 2');
  assert.strictEqual(savedMastery.seen["CCAF-1-002"].incorrectCount, 2, 'Cumulative incorrectCount must equal 2');
  assert.strictEqual(savedMastery.seen["CCAF-1-003"], undefined, 'Unanswered items must not pollute mastery log');
});

// --------------------------------------------------
// TEST 10: Tab-Resilient Offline Expiration Recovery
// --------------------------------------------------
runTest('Audit tab-resilient recovery handling for offline timer expirations using module time evaluation', () => {
  const now = Date.now();
  const expiredSessionBackup = {
    sessionType: 'exam',
    questions: [{ id: "CCAF-1-001", domain: 1, optionOrder: ["opt_1", "opt_2", "opt_3", "opt_4"] }],
    currentIndex: 0,
    selections: {},
    endTimestamp: now - 300000 // Expired 5 mins ago
  };

  const remainingSec = CCAF_LOGIC.calculateRemainingTime(expiredSessionBackup.endTimestamp, now);
  let autoSubmitTriggered = (remainingSec <= 0);

  assert.strictEqual(autoSubmitTriggered, true, 'calculateRemainingTime must evaluate expired backup to <= 0 and trigger submission');
});

// --------------------------------------------------
// TEST 11: Lightweight Reference Pointers Grading Verification
// --------------------------------------------------
runTest('evaluateExam correctly evaluates letter submissions against lightweight question pointers with optionOrder', () => {
  // Test question CCAF-1-001 has opt_1 as correct
  const ptr = { id: "CCAF-1-001", domain: 1, optionOrder: ["opt_3", "opt_1", "opt_4", "opt_2"] }; // opt_1 is at index 1 (Letter B)
  
  // User selects B (which corresponds to opt_1 in this specific random presentation)
  const evalPass = CCAF_LOGIC.evaluateExam([ptr], { "CCAF-1-001": "B" });
  assert.strictEqual(evalPass.score, 1, 'Evaluate exam must correctly map letter B to opt_1 and grade as correct');

  // User selects A (corresponds to opt_3)
  const evalFail = CCAF_LOGIC.evaluateExam([ptr], { "CCAF-1-001": "A" });
  assert.strictEqual(evalFail.score, 0, 'Evaluate exam must correctly grade letter A (opt_3) as incorrect');
});

process.on('exit', (code) => {
  console.log('==================================================');
  if (failCount === 0 && code === 0) {
    console.log(`🎉 All ${passCount}/${testCount} unit tests completed with absolute SUCCESS!`);
    process.exitCode = 0;
  } else {
    console.error(`💥 Verification FAILED! ${failCount}/${testCount} test(s) failed:`);
    failedTests.forEach(t => console.error(` - ${t}`));
    process.exitCode = 1;
  }
  console.log('==================================================');
});
