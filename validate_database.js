/**
 * validate_database.js
 * Standalone zero-dependency Node.js database validator for CCAF scenario questions.
 * Audits all entries against schema constraints, precomputed O(1) index proxies, and deep database invariants.
 */

const path = require('path');

// Resolve and require our questions database
let CCAF_DATABASE;
try {
  CCAF_DATABASE = require('./questions.js');
} catch (e) {
  console.error('Error: Failed to load questions.js database. Make sure the file exists and contains correct JavaScript syntax.');
  console.error(e);
  process.exit(1);
}

console.log(`Loaded database questions.js containing ${CCAF_DATABASE.length} entries.`);
console.log('--------------------------------------------------');
console.log('Beginning validation audits...');
console.log('--------------------------------------------------');

let errors = [];
let counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let uniqueIds = new Set();
let correctPositions = { A: 0, B: 0, C: 0, D: 0 };

// Domain weightings & minimum variety pool limits (Realigned v1.6.0)
const MIN_POOL_LIMITS = {
  1: 32, // Domain 1 (27% weight, draw 16) -> 32+
  2: 22, // Domain 2 (18% weight, draw 11) -> 22+
  3: 24, // Domain 3 (20% weight, draw 12) -> 24+
  4: 24, // Domain 4 (20% weight, draw 12) -> 24+
  5: 18  // Domain 5 (15% weight, draw 9)  -> 18+
};

const idRegex = /^CCAF-[1-5]-[0-9]{3}$/;

CCAF_DATABASE.forEach((q, index) => {
  const qLabel = `Question[${index}] (ID: ${q ? q.id || 'MISSING' : 'INVALID'})`;

  if (!q || typeof q !== 'object') {
    errors.push(`${qLabel}: Entry is not a valid JavaScript object.`);
    return;
  }

  // 1. Basic field presence & type validations
  if (!q.id || typeof q.id !== 'string') {
    errors.push(`${qLabel}: Missing or invalid 'id' property (must be string).`);
    return;
  }
  if (!idRegex.test(q.id)) {
    errors.push(`${qLabel}: 'id' does not match regex format CCAF-[domain]-[sequence] (e.g. CCAF-1-001).`);
  }

  // Unique ID check
  if (uniqueIds.has(q.id)) {
    errors.push(`${qLabel}: Globally duplicate ID '${q.id}' detected.`);
  } else {
    uniqueIds.add(q.id);
  }

  if (typeof q.domain !== 'number' || !Number.isInteger(q.domain) || q.domain < 1 || q.domain > 5) {
    errors.push(`${qLabel}: 'domain' must be an integer between 1 and 5.`);
  } else {
    counts[q.domain]++;
    // Verify ID domain aligns with domain property
    const idParts = q.id.split('-');
    if (idParts[1] && parseInt(idParts[1], 10) !== q.domain) {
      errors.push(`${qLabel}: ID domain prefix '${idParts[1]}' does not match domain property '${q.domain}'.`);
    }
  }

  if (typeof q.scenario !== 'string' || q.scenario.trim().length < 50) {
    const gotLen = typeof q.scenario === 'string' ? q.scenario.trim().length : 'invalid_type';
    errors.push(`${qLabel}: 'scenario' must be a string of at least 50 trimmed characters (got ${gotLen}).`);
  }

  if (typeof q.question !== 'string' || q.question.trim().length < 15) {
    const gotLen = typeof q.question === 'string' ? q.question.trim().length : 'invalid_type';
    errors.push(`${qLabel}: 'question' must be a string of at least 15 trimmed characters (got ${gotLen}).`);
  }

  // 2. Options validation
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    errors.push(`${qLabel}: 'options' must be an array of exactly 4 option objects.`);
  } else {
    let correctCount = 0;
    q.options.forEach((opt, oIdx) => {
      const optLabel = `${qLabel}.options[${oIdx}]`;
      if (!opt || typeof opt !== 'object') {
        errors.push(`${optLabel}: Invalid option object.`);
        return;
      }
      
      // Check stable option ID presence and structure
      const expectedOptId = `opt_${oIdx + 1}`;
      if (opt.id !== expectedOptId) {
        errors.push(`${optLabel}: Missing or incorrect 'id' property (expected '${expectedOptId}', got '${opt.id}').`);
      }

      if (!Object.isFrozen(opt)) {
        errors.push(`${optLabel}: Option object must be immutable (Object.isFrozen).`);
      }

      if (typeof opt.text !== 'string' || opt.text.trim().length < 5) {
        const gotLen = typeof opt.text === 'string' ? opt.text.trim().length : 'invalid_type';
        errors.push(`${optLabel}: 'text' must be a string of at least 5 trimmed characters (got ${gotLen}).`);
      }
      if (typeof opt.isCorrect !== 'boolean') {
        errors.push(`${optLabel}: 'isCorrect' must be a boolean.`);
      } else if (opt.isCorrect) {
        correctCount++;
        const correctOptId = String.fromCharCode(65 + oIdx);
        correctPositions[correctOptId]++;
      }
      if (typeof opt.explanation !== 'string' || opt.explanation.trim().length < 10) {
        const gotLen = typeof opt.explanation === 'string' ? opt.explanation.trim().length : 'invalid_type';
        errors.push(`${optLabel}: 'explanation' must be a string of at least 10 trimmed characters (got ${gotLen}).`);
      }
    });

    if (correctCount !== 1) {
      errors.push(`${qLabel}: Must contain exactly one option with isCorrect: true (found ${correctCount}).`);
    }
    if (!Object.isFrozen(q.options)) {
      errors.push(`${qLabel}: Options array must be immutable (Object.isFrozen).`);
    }
  }

  if (!Object.isFrozen(q)) {
    errors.push(`${qLabel}: Question object must be immutable (Object.isFrozen).`);
  }

  // 3. Reference validation
  if (typeof q.reference !== 'string' || !q.reference.startsWith('https://')) {
    errors.push(`${qLabel}: 'reference' must be a valid HTTPS URL starting with 'https://' (got '${q.reference}').`);
  }
});

// 4. Variety pool constraints validation
console.log('\nAuditing Domain pool variety sizes...');
let varietyLimitsSatisfied = true;
for (let d = 1; d <= 5; d++) {
  const minRequired = MIN_POOL_LIMITS[d];
  const actualCount = counts[d];
  console.log(`- Domain ${d}: Found ${actualCount} questions (Required minimum: ${minRequired})`);
  if (actualCount < minRequired) {
    errors.push(`Domain variety limit failure: Domain ${d} has only ${actualCount} questions, but requires at least ${minRequired} to maintain a 50% maximum draw ratio.`);
    varietyLimitsSatisfied = false;
  }
}

console.log('\nAuditing Correct Option Positional Bias (35% max constraint)...');
for (const pos in correctPositions) {
  const count = correctPositions[pos];
  const pct = Math.round((count / CCAF_DATABASE.length) * 100);
  console.log(`- Option ${pos}: ${count} correct answers (${pct}%)`);
  if (pct > 35) {
    errors.push(`Bias violation: Option ${pos} exhibits extreme positional bias (${pct}% > 35% limit).`);
  }
}

// 5. Audit Precomputed O(1) Index & Proxy Immutability Traps
console.log('\nAuditing Precomputed O(1) Index & Proxy Immutability Traps...');
if (!CCAF_DATABASE.INDEX || !CCAF_DATABASE.INDEX.byId || !CCAF_DATABASE.INDEX.byDomain) {
  errors.push('Database Index Error: CCAF_DATABASE.INDEX structure is missing or malformed.');
} else {
  const index = CCAF_DATABASE.INDEX;
  if (index.byId.size !== CCAF_DATABASE.length) {
    errors.push(`Database Index Error: index.byId.size (${index.byId.size}) does not match CCAF_DATABASE.length (${CCAF_DATABASE.length}).`);
  } else {
    console.log(`- index.byId.size matches pool count (${index.byId.size})`);
  }

  // Verify Symbol.iterator binding
  try {
    let iterationCount = 0;
    for (const [id, q] of index.byId) {
      iterationCount++;
    }
    if (iterationCount !== CCAF_DATABASE.length) {
      errors.push(`Proxy Iterator Error: Iterated count (${iterationCount}) does not match expected (${CCAF_DATABASE.length}).`);
    } else {
      console.log(`- Proxy Symbol.iterator successfully evaluated across ${iterationCount} Map entries`);
    }
  } catch (err) {
    errors.push(`Proxy Iterator Error: Failed to iterate over index.byId Map (${err.message}).`);
  }

  // Verify immutability rejection traps
  try {
    index.byId.set('TEST_MUTATE', {});
    errors.push('Proxy Immutability Error: index.byId.set() succeeded instead of throwing runtime immutability error.');
  } catch (err) {
    console.log(`- Proxy immutability trap successfully intercepted set() mutation (${err.message})`);
  }

  try {
    index.byId.delete('CCAF-1-001');
    errors.push('Proxy Immutability Error: index.byId.delete() succeeded instead of throwing runtime immutability error.');
  } catch (err) {
    console.log(`- Proxy immutability trap successfully intercepted delete() mutation (${err.message})`);
  }
}

if (errors.length > 0) {
  console.error(`❌ Structural & Index Validation FAILED with ${errors.length} error(s):`);
  console.error('--------------------------------------------------');
  errors.forEach((err) => console.error(`- ${err}`));
  console.error('--------------------------------------------------');
  console.error('Validator exiting early with code 1.');
  process.exit(1);
}

console.log('\nAuditing Correct Option Length Bias (v1.4.0 Dual-Layered constraints)...');
let strictlyLongestCount = 0;
let strictlyShortestCount = 0;
let totalCorrectLength = 0;
let totalIncorrectLength = 0;
let incorrectCountGlobal = 0;

CCAF_DATABASE.forEach((q, index) => {
  const qLabel = `Question[${index}] (ID: ${q.id})`;
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
  
  // 1. Strictly Longest check
  const maxIncorrect = Math.max(...incorrectLengths);
  if (correctLength > maxIncorrect) {
    strictlyLongestCount++;
  }
  
  // 2. Strictly Shortest check
  const minIncorrect = Math.min(...incorrectLengths);
  if (correctLength < minIncorrect) {
    strictlyShortestCount++;
  }
  
  // 3. Per-question Safety Ceiling: [0.50, 1.75] ratio
  const questionRatio = correctLength / incorrectAvg;
  if (questionRatio < 0.50 || questionRatio > 1.75) {
    errors.push(`${qLabel}: Per-question length ratio violation! Correct option length is ${correctLength} chars while distractors average is ${incorrectAvg.toFixed(1)} chars (ratio: ${questionRatio.toFixed(2)}x, must reside within [0.50, 1.75]x).`);
  }
});

const longestPct = Math.round((strictlyLongestCount / CCAF_DATABASE.length) * 100);
const shortestPct = Math.round((strictlyShortestCount / CCAF_DATABASE.length) * 100);
const avgCorrect = totalCorrectLength / CCAF_DATABASE.length;
const avgIncorrect = totalIncorrectLength / incorrectCountGlobal;
const globalRatio = avgCorrect / avgIncorrect;

console.log(`- Strictly Longest Rate: ${strictlyLongestCount}/${CCAF_DATABASE.length} (${longestPct}%, Limit: <= 38%)`);
console.log(`- Strictly Shortest Rate: ${strictlyShortestCount}/${CCAF_DATABASE.length} (${shortestPct}%, Limit: <= 38%)`);
console.log(`- Overall Average Option Length Ratio (Correct/Incorrect): ${globalRatio.toFixed(3)} (Required range: [0.85, 1.15])`);

if (longestPct > 38) {
  errors.push(`Global Bias violation: Correct option is strictly the longest choice in ${longestPct}% of the pool (> 38% limit).`);
}
if (shortestPct > 38) {
  errors.push(`Global Bias violation: Correct option is strictly the shortest choice in ${shortestPct}% of the pool (> 38% limit).`);
}
if (globalRatio < 0.85 || globalRatio > 1.15) {
  errors.push(`Global Ratio violation: Overall average option length ratio is ${globalRatio.toFixed(3)} (must reside in [0.85, 1.15]).`);
}

console.log('--------------------------------------------------');
if (errors.length > 0) {
  console.error(`❌ Validation FAILED with ${errors.length} error(s):`);
  console.error('--------------------------------------------------');
  errors.forEach((err) => console.error(`- ${err}`));
  console.error('--------------------------------------------------');
  console.error('Validator exiting with code 1.');
  process.exit(1);
} else {
  console.log('✅ Validation SUCCESS! All schema constraints, O(1) proxy indices, and deep invariants passed.');
  console.log('--------------------------------------------------');
  console.log('Database Statistics:');
  console.log(`Total Questions in Pool: ${CCAF_DATABASE.length}`);
  console.log('All domain proportional variety requirements are fully satisfied.');
  console.log('--------------------------------------------------');
  console.log('Validator exiting with code 0.');
  process.exit(0);
}
