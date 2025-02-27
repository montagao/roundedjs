/**
 * Text utilities for script detection and text analysis.
 */

// Character ranges for different scripts
const SCRIPT_RANGES = {
  latin: [
    [0x0020, 0x007F], // Basic Latin
    [0x00A0, 0x00FF], // Latin-1 Supplement
    [0x0100, 0x017F], // Latin Extended-A
    [0x0180, 0x024F]  // Latin Extended-B
  ],
  cyrillic: [
    [0x0400, 0x04FF], // Cyrillic
    [0x0500, 0x052F]  // Cyrillic Supplement
  ],
  arabic: [
    [0x0600, 0x06FF], // Arabic
    [0x0750, 0x077F]  // Arabic Supplement
  ],
  hebrew: [
    [0x0590, 0x05FF]  // Hebrew
  ],
  cjk: [
    [0x4E00, 0x9FFF], // CJK Unified Ideographs
    [0x3040, 0x309F], // Hiragana
    [0x30A0, 0x30FF], // Katakana
    [0x3400, 0x4DBF], // CJK Unified Ideographs Extension A
    [0xAC00, 0xD7AF]  // Hangul Syllables
  ],
  thai: [
    [0x0E00, 0x0E7F]  // Thai
  ],
  devanagari: [
    [0x0900, 0x097F]  // Devanagari
  ]
};

// RTL Scripts
const RTL_SCRIPTS = ['arabic', 'hebrew'];

/**
 * Check if a character is within any of the ranges defined for a script.
 * 
 * @param {number} charCode - The character code to check
 * @param {Array} ranges - Array of ranges to check against
 * @returns {boolean} - True if the character is within any range
 */
function isInRanges(charCode, ranges) {
  return ranges.some(([start, end]) => charCode >= start && charCode <= end);
}

/**
 * Detect the script of a given text.
 * 
 * @param {string} text - The text to analyze
 * @returns {string} - The detected script name
 */
function detectScript(text) {
  if (!text) return 'latin';
  
  // Clean the text (remove newlines and special formatting)
  const cleanText = text.replace(/\\N/g, ' ').replace(/\\h/g, ' ');
  
  // Count occurrences of each script
  const scriptCounts = {};
  
  for (const char of cleanText) {
    const charCode = char.charCodeAt(0);
    
    // Skip control characters and common punctuation
    if (charCode < 0x20) continue;
    
    // Check each script
    for (const [script, ranges] of Object.entries(SCRIPT_RANGES)) {
      if (isInRanges(charCode, ranges)) {
        scriptCounts[script] = (scriptCounts[script] || 0) + 1;
        break;
      }
    }
  }
  
  // Find the script with the highest count
  let maxCount = 0;
  let detectedScript = 'latin'; // Default to Latin
  
  for (const [script, count] of Object.entries(scriptCounts)) {
    if (count > maxCount) {
      maxCount = count;
      detectedScript = script;
    }
  }
  
  return detectedScript;
}

/**
 * Check if a script is right-to-left.
 * 
 * @param {string} script - The script name
 * @returns {boolean} - True if the script is RTL
 */
function isRtlScript(script) {
  return RTL_SCRIPTS.includes(script);
}

/**
 * Check if a font is monospace based on its name.
 * This is a simple heuristic, not a definitive test.
 * 
 * @param {string} fontName - The font name
 * @returns {boolean} - True if the font is likely monospace
 */
function isMonospaceFont(fontName) {
  const fontLower = fontName.toLowerCase();
  const monospaceKeywords = [
    'mono', 'console', 'typewriter', 'courier', 'terminal', 'fixed'
  ];
  
  return monospaceKeywords.some(keyword => fontLower.includes(keyword));
}

module.exports = {
  detectScript,
  isRtlScript,
  isMonospaceFont
}; 