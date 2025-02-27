/**
 * Font utilities for font detection, measurement, and text dimensions calculation.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { createCanvas } = require('canvas');
const opentype = require('opentype.js');
const { detectScript, isMonospaceFont } = require('./textUtils');
const { WIDTH_ESTIMATION, DEBUG } = require('./config');

// Font path cache for consistent results
const FONT_PATH_CACHE = {};

// Font category cache to ensure consistent results
const FONT_CATEGORY_CACHE = {};

// Empirical character width data by script and font category
// Values represent the average character width as a ratio of font size
const CHARACTER_WIDTH_DATA = {
    latin: {
        default: 0.48,        // Arial, Helvetica, etc.
        narrow: 0.42,         // Times New Roman, etc.
        wide: 0.53,           // Comic Sans, etc.
        monospace: 0.60,      // Courier, etc.

        // Common character width ratios (relative to font size)
        chars: {
            'i': 0.22, 'l': 0.22, 'I': 0.27, 'j': 0.27, 't': 0.33,
            'r': 0.33, 'f': 0.33, 's': 0.38, 'a': 0.43, 'e': 0.43,
            'n': 0.50, 'o': 0.50, 'u': 0.50, 'c': 0.43, 'z': 0.43,
            'g': 0.48, 'k': 0.48, 'v': 0.48, 'x': 0.48, 'y': 0.48,
            'b': 0.48, 'd': 0.48, 'h': 0.48, 'p': 0.48, 'q': 0.48,
            'm': 0.78, 'w': 0.71, 'A': 0.65, 'B': 0.65, 'C': 0.65,
            'D': 0.65, 'E': 0.60, 'F': 0.55, 'G': 0.71, 'H': 0.71,
            'J': 0.50, 'K': 0.65, 'L': 0.55, 'M': 0.82, 'N': 0.71,
            'O': 0.76, 'P': 0.60, 'Q': 0.76, 'R': 0.65, 'S': 0.60,
            'T': 0.60, 'U': 0.71, 'V': 0.65, 'W': 0.92, 'X': 0.65,
            'Y': 0.60, 'Z': 0.60, '0': 0.50, '1': 0.50, '2': 0.50,
            '3': 0.50, '4': 0.50, '5': 0.50, '6': 0.50, '7': 0.50,
            '8': 0.50, '9': 0.50, '.': 0.27, ',': 0.27, ':': 0.27,
            ';': 0.27, '!': 0.27, '?': 0.43, '"': 0.33, "'": 0.22,
            '(': 0.33, ')': 0.33, '[': 0.33, ']': 0.33, '{': 0.33,
            '}': 0.33, '*': 0.38, '+': 0.55, '-': 0.33, '_': 0.50,
            '/': 0.27, '\\': 0.27, '@': 0.82, '#': 0.55, '$': 0.50,
            '%': 0.82, '^': 0.50, '&': 0.65, ' ': 0.27
        }
    },
    cyrillic: {
        default: 0.52,
        narrow: 0.45,
        wide: 0.57,
        monospace: 0.60
    },
    arabic: {
        default: 0.55,
        narrow: 0.50,
        wide: 0.60,
        monospace: 0.60
    },
    hebrew: {
        default: 0.54,
        narrow: 0.48,
        wide: 0.58,
        monospace: 0.60
    },
    cjk: {
        default: 0.95,  // CJK characters are nearly square
        narrow: 0.85,
        wide: 1.0,
        monospace: 0.95
    },
    thai: {
        default: 0.60,
        narrow: 0.55,
        wide: 0.65,
        monospace: 0.60
    },
    devanagari: {
        default: 0.62,
        narrow: 0.58,
        wide: 0.68,
        monospace: 0.62
    },
    other: {
        default: 0.55,
        narrow: 0.50,
        wide: 0.60,
        monospace: 0.60
    }
};

// Font family categories with associated width adjustment factors
const FONT_CATEGORIES = {
    // Default proportional fonts (calibrated for Arial)
    'Arial': { category: 'default', factor: 1.0 },
    'Helvetica': { category: 'default', factor: 1.0 },
    'Verdana': { category: 'default', factor: 1.05 },
    'Tahoma': { category: 'default', factor: 1.0 },
    'Calibri': { category: 'default', factor: 0.98 },
    'Toucher Semibold': { category: 'default', factor: 1.0 },

    // Narrower proportional fonts
    'Times New Roman': { category: 'narrow', factor: 0.95 },
    'Georgia': { category: 'narrow', factor: 0.98 },
    'Garamond': { category: 'narrow', factor: 0.93 },
    'Cambria': { category: 'narrow', factor: 0.96 },
    'Palatino': { category: 'narrow', factor: 0.97 },

    // Wider proportional fonts
    'Comic Sans MS': { category: 'wide', factor: 1.1 },
    'Trebuchet MS': { category: 'wide', factor: 1.05 },
    'Segoe UI': { category: 'wide', factor: 1.02 },
    'Lucida Grande': { category: 'wide', factor: 1.08 },

    // Monospace fonts (all characters have the same width)
    'Courier New': { category: 'monospace', factor: 1.0 },
    'Consolas': { category: 'monospace', factor: 1.0 },
    'Courier': { category: 'monospace', factor: 1.0 },
    'Monaco': { category: 'monospace', factor: 1.0 },
    'Menlo': { category: 'monospace', factor: 1.0 },
    'Lucida Console': { category: 'monospace', factor: 1.0 },
    'DejaVu Sans Mono': { category: 'monospace', factor: 1.0 },
    'Andale Mono': { category: 'monospace', factor: 1.0 },

    'SimSun': { category: 'default', factor: 1.0, script: 'cjk' },
    'Microsoft YaHei': { category: 'default', factor: 1.0, script: 'cjk' },
    'SimHei': { category: 'default', factor: 1.0, script: 'cjk' },
    'MS Gothic': { category: 'default', factor: 1.0, script: 'cjk' },
    'Meiryo': { category: 'default', factor: 1.0, script: 'cjk' },
    'Malgun Gothic': { category: 'default', factor: 1.0, script: 'cjk' },
    'NSimSun': { category: 'default', factor: 1.0, script: 'cjk' },
    'Batang': { category: 'default', factor: 1.0, script: 'cjk' },
    'Gulim': { category: 'default', factor: 1.0, script: 'cjk' },
    'Mingliu': { category: 'default', factor: 1.0, script: 'cjk' },
    'PingFang SC': { category: 'default', factor: 1.0, script: 'cjk' },
    'PingFang TC': { category: 'default', factor: 1.0, script: 'cjk' },
    'PingFang HK': { category: 'default', factor: 1.0, script: 'cjk' },
    'Hiragino Sans GB': { category: 'default', factor: 1.0, script: 'cjk' },
    'Heiti SC': { category: 'default', factor: 1.0, script: 'cjk' },
    'Heiti TC': { category: 'default', factor: 1.0, script: 'cjk' },
    'STHeiti': { category: 'default', factor: 1.0, script: 'cjk' },
    'Songti SC': { category: 'default', factor: 1.0, script: 'cjk' },
    'Songti TC': { category: 'default', factor: 1.0, script: 'cjk' },
    'Noto Sans CJK SC': { category: 'default', factor: 1.0, script: 'cjk' },
    'Noto Sans CJK TC': { category: 'default', factor: 1.0, script: 'cjk' },
    'Noto Sans CJK JP': { category: 'default', factor: 1.0, script: 'cjk' },
    'Noto Sans CJK KR': { category: 'default', factor: 1.0, script: 'cjk' },
};

// Common font paths for different operating systems
const FONT_PATHS = {
    win32: [
        path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'),
    ],
    darwin: [  // macOS
        '/System/Library/Fonts',
        '/Library/Fonts',
        path.join(os.homedir(), 'Library/Fonts')
    ],
    linux: [
        '/usr/share/fonts',
        '/usr/local/share/fonts',
        path.join(os.homedir(), '.fonts'),
        path.join(os.homedir(), '.local/share/fonts')
    ]
};

/**
 * Find the path to a font file based on the font name.
 * 
 * @param {string} fontName - The name of the font to find
 * @returns {string|null} - The path to the font file, or null if not found
 */
function findFontFile(fontName) {
    // Use cached path if available
    if (FONT_PATH_CACHE[fontName]) {
        return FONT_PATH_CACHE[fontName];
    }

    // Common extensions
    const extensions = ['.ttf', '.ttc', '.otf'];

    // Get platform-specific font directories
    const fontDirs = FONT_PATHS[process.platform] || ['/usr/share/fonts'];

    // Log font search if debug enabled
    if (DEBUG.logFontPaths) {
        console.log(`[FONT DEBUG] Looking for font '${fontName}' in: ${fontDirs.join(', ')}`);
    }

    // Normalize font name for comparison
    const fontNameLower = fontName.toLowerCase();

    // For CJK fonts, prepare alternative names to try
    const alternativeNames = [fontNameLower];

    // Add common CJK font variations
    if (fontNameLower.includes('cjk')) {
        if (fontNameLower.includes('sc')) {
            alternativeNames.push('cjk');
            alternativeNames.push('chinese');
            alternativeNames.push('simplified');
        } else if (fontNameLower.includes('tc')) {
            alternativeNames.push('cjk');
            alternativeNames.push('chinese');
            alternativeNames.push('traditional');
        } else if (fontNameLower.includes('jp')) {
            alternativeNames.push('cjk');
            alternativeNames.push('japanese');
        } else if (fontNameLower.includes('kr')) {
            alternativeNames.push('cjk');
            alternativeNames.push('korean');
        }
    }

    // Search for the font file
    for (const fontDir of fontDirs) {
        if (!fs.existsSync(fontDir)) {
            continue;
        }

        try {
            const findFontInDir = (dir) => {
                const files = fs.readdirSync(dir);

                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);

                    if (stat.isDirectory()) {
                        try {
                            const result = findFontInDir(filePath);
                            if (result) return result;
                        } catch (err) {
                            // Skip directories we can't read
                        }
                    } else if (stat.isFile()) {
                        const ext = path.extname(file).toLowerCase();
                        if (extensions.includes(ext)) {
                            const filenameLower = file.toLowerCase().replace(/\s/g, '').replace(/-/g, '');

                            // Try exact match first
                            if (filenameLower.includes(fontNameLower)) {
                                FONT_PATH_CACHE[fontName] = filePath;
                                if (DEBUG.logFontPaths) {
                                    console.log(`[FONT DEBUG] Found font '${fontName}' at: ${filePath}`);
                                }
                                return filePath;
                            }

                            // Then try alternative names for CJK fonts
                            for (const altName of alternativeNames) {
                                if (altName !== fontNameLower && filenameLower.includes(altName)) {
                                    FONT_PATH_CACHE[fontName] = filePath;
                                    if (DEBUG.logFontPaths) {
                                        console.log(`[FONT DEBUG] Found font '${fontName}' using alternative name '${altName}' at: ${filePath}`);
                                    }
                                    return filePath;
                                }
                            }
                        }
                    }
                }

                return null;
            };

            const result = findFontInDir(fontDir);
            if (result) return result;
        } catch (err) {
            // Skip directories we can't read
        }
    }

    // Fallbacks for common fonts
    const fallbacks = {
        'arial': ['arial.ttf', 'Arial.ttf', 'LiberationSans-Regular.ttf', 'DejaVuSans.ttf'],
        'times new roman': ['times.ttf', 'TimesNewRoman.ttf', 'LiberationSerif-Regular.ttf'],
        'courier new': ['cour.ttf', 'CourierNew.ttf', 'LiberationMono-Regular.ttf'],
        'touche semibold': ['Touche-Semibold.otf'],
    };

    // Try fallbacks
    for (const [name, files] of Object.entries(fallbacks)) {
        if (fontNameLower.includes(name) || name.includes(fontNameLower)) {
            for (const fontDir of fontDirs) {
                if (!fs.existsSync(fontDir)) {
                    continue;
                }

                for (const file of files) {
                    const potentialPath = path.join(fontDir, file);
                    if (fs.existsSync(potentialPath)) {
                        FONT_PATH_CACHE[fontName] = potentialPath;
                        return potentialPath;
                    }
                }
            }
        }
    }

    // Return null if font file not found
    console.log(`Warning: Could not find font file for '${fontName}'. Using fallback width calculation.`);
    FONT_PATH_CACHE[fontName] = null;
    return null;
}

/**
 * Get the font category and width adjustment factor for a given font.
 * 
 * @param {string} fontName - The name of the font
 * @returns {Object} - Object with category and factor properties
 */
function getFontCategoryAndFactor(fontName) {
    // Use cached result if available
    if (FONT_CATEGORY_CACHE[fontName]) {
        return FONT_CATEGORY_CACHE[fontName];
    }

    // Try direct match
    if (FONT_CATEGORIES[fontName]) {
        FONT_CATEGORY_CACHE[fontName] = FONT_CATEGORIES[fontName];
        return FONT_CATEGORIES[fontName];
    }

    // Try case-insensitive match
    for (const [font, data] of Object.entries(FONT_CATEGORIES)) {
        if (font.toLowerCase() === fontName.toLowerCase()) {
            FONT_CATEGORY_CACHE[fontName] = data;
            return data;
        }
    }

    // Check if it's a monospace font not in our list
    if (isMonospaceFont(fontName)) {
        const result = { category: 'monospace', factor: 1.0 };
        FONT_CATEGORY_CACHE[fontName] = result;
        return result;
    }

    // Default to Arial if not found
    console.log(`Warning: Font '${fontName}' not in calibrated list. Using default category.`);
    const result = { category: 'default', factor: 1.0 };
    FONT_CATEGORY_CACHE[fontName] = result;
    return result;
}

/**
 * Get precise text dimensions using Canvas.
 * 
 * @param {string} text - The text to measure
 * @param {string} fontPath - Path to the font file
 * @param {number} fontSize - Font size in pixels
 * @param {boolean} tightFit - Whether to use tight fitting
 * @returns {Object|null} - Object with width and height, or null if measurement failed
 */
function getTextDimensionsCanvas(text, fontPath, fontSize, tightFit = true) {
    if (!WIDTH_ESTIMATION.useCanvas || !fontPath || !fs.existsSync(fontPath)) {
        return null;
    }

    try {
        // Create a canvas for text measurement
        const canvas = createCanvas(1, 1);
        const ctx = canvas.getContext('2d');

        // Register the font with node-canvas
        const fontFamily = `CustomFont-${Date.now()}`;

        // Set the font on the context
        ctx.font = `${fontSize}px "${fontFamily}"`;

        // Split into lines
        const lines = text.split('\\N');
        let maxWidth = 0;
        let totalHeight = 0;

        // Calculate line heights and maximum width
        for (const line of lines) {
            const metrics = ctx.measureText(line);
            const lineWidth = metrics.width;

            // Get line height - node-canvas doesn't provide ascent/descent easily
            // so we use fontSize as an approximation
            const lineHeight = fontSize;

            maxWidth = Math.max(maxWidth, lineWidth);
            totalHeight += lineHeight;
        }

        // Add line spacing for multiple lines
        if (lines.length > 1) {
            const lineSpacingFactor = 1.1;  // Default line spacing
            // Adjust total height - don't add extra for the last line
            totalHeight = totalHeight * lineSpacingFactor -
                (lineSpacingFactor - 1) * fontSize / lines.length;
        }

        // If we didn't get valid dimensions, ensure defaults
        if (maxWidth <= 0) {
            maxWidth = fontSize * text.length * 0.6;
        }
        if (totalHeight <= 0) {
            totalHeight = fontSize * lines.length;
        }

        // Apply tight fit adjustments - fixed margin to ensure consistency
        maxWidth *= 1.01;  // Just 1% extra width, always applied

        // Strict sanity check - ensure width is reasonable and CONSISTENT
        const charCount = lines.reduce((sum, line) => sum + line.length, 0);
        if (charCount > 0) {
            const averageCharWidth = maxWidth / charCount;
            const maxAllowedWidth = fontSize * WIDTH_ESTIMATION.maxAverageCharWidth;
            if (averageCharWidth > maxAllowedWidth) {
                maxWidth = charCount * fontSize * WIDTH_ESTIMATION.reasonableCharWidth * 0.92;
            }
        }

        // Apply a maximum width cap with a fixed multiplier for consistency
        const reasonableMaxWidth = charCount * fontSize * WIDTH_ESTIMATION.reasonableCharWidth;
        const maxWidthCap = reasonableMaxWidth * WIDTH_ESTIMATION.maxWidthCapMultiplier;
        if (maxWidth > maxWidthCap) {
            maxWidth = reasonableMaxWidth;
        }

        return { width: maxWidth, height: totalHeight };
    } catch (error) {
        console.log(`Canvas error: ${error.message}`);
        return null;
    }
}

/**
 * Calculate text width using empirical character width data.
 * 
 * @param {string} text - The text to measure
 * @param {number} fontSize - Font size in pixels
 * @param {string} script - The script of the text
 * @param {string} fontCategory - The font category
 * @param {number} fontFactor - The font adjustment factor
 * @returns {number} - The calculated width
 */
function calculateEmpiricalWidth(text, fontSize, script, fontCategory, fontFactor) {
    const lines = text.split('\\N');
    let maxWidth = 0;

    // Get script-specific width data
    if (!CHARACTER_WIDTH_DATA[script]) {
        script = 'other';
    }

    const scriptData = CHARACTER_WIDTH_DATA[script];

    // Determine base width multiplier from font category
    if (!scriptData[fontCategory]) {
        fontCategory = 'default';
    }

    const baseMultiplier = scriptData[fontCategory] * fontFactor;

    // Process each line
    for (const line of lines) {
        let lineWidth = 0;

        // For Latin script, use character-specific widths when available
        if (script === 'latin' && scriptData.chars) {
            const charWidths = scriptData.chars;

            for (const char of line) {
                if (charWidths[char]) {
                    lineWidth += charWidths[char] * fontSize;
                } else {
                    // Default to average width for unknown characters
                    lineWidth += baseMultiplier * fontSize;
                }
            }
        } else {
            // For other scripts or when no char data, use average width
            lineWidth = line.length * baseMultiplier * fontSize;
        }

        maxWidth = Math.max(maxWidth, lineWidth);
    }

    return maxWidth;
}

/**
 * Calculate text dimensions using Canvas if available, fall back to empirical data.
 * 
 * @param {string} text - The text to measure
 * @param {number} fontSize - Font size in pixels
 * @param {string} fontName - The name of the font
 * @param {number} widthCorrection - Width correction factor
 * @param {number} lineSpacing - Line spacing multiplier
 * @param {boolean} tightFit - Whether to use tight fitting
 * @returns {Object} - Object with width and height properties
 */
function calculateTextDimensions(text, fontSize, fontName = 'Arial', widthCorrection = null, lineSpacing = 1.2, tightFit = true) {
    // Use config value if widthCorrection is null
    if (widthCorrection === null) {
        widthCorrection = WIDTH_ESTIMATION.defaultWidthCorrection;
    }

    // Log calculation start if debug enabled
    if (DEBUG.verboseWidthCalculation) {
        console.log(`[DEBUG] Calculating dimensions for text: '${text.substr(0, 20)}${text.length > 20 ? '...' : ''}', font: ${fontName}, size: ${fontSize}px`);
    }

    // Try using Canvas for precise measurements
    const fontPath = findFontFile(fontName);
    let width = null;
    let height = null;

    // Check if we should use Canvas
    if (WIDTH_ESTIMATION.useCanvas && fontPath) {
        if (DEBUG.verboseWidthCalculation) {
            console.log(`[DEBUG] Using Canvas with font at: ${fontPath}`);
        }

        const canvasResult = getTextDimensionsCanvas(text, fontPath, fontSize, tightFit);

        if (canvasResult) {
            width = canvasResult.width;
            height = canvasResult.height;

            if (DEBUG.verboseWidthCalculation) {
                console.log(`[DEBUG] Canvas calculation results - width: ${width.toFixed(2)}px, height: ${height.toFixed(2)}px`);
            }
        } else if (DEBUG.verboseWidthCalculation) {
            console.log(`[DEBUG] Canvas calculation failed, falling back to empirical method`);
        }
    }

    // If Canvas fails or is disabled, fall back to empirical data
    if (width === null || height === null) {
        const script = detectScript(text);
        const lines = text.split('\\N');

        if (DEBUG.verboseWidthCalculation) {
            console.log(`[DEBUG] Using empirical method - detected script: ${script}, line count: ${lines.length}`);
        }

        // Get font category and adjustment factor
        const fontInfo = getFontCategoryAndFactor(fontName);
        const fontCategory = fontInfo.category;
        const fontFactor = fontInfo.factor;

        if (DEBUG.verboseWidthCalculation) {
            console.log(`[DEBUG] Font category: ${fontCategory}, adjustment factor: ${fontFactor}`);
        }

        // If the font has a specific script override, use it
        if (fontInfo.script) {
            const overrideScript = fontInfo.script;
            if (DEBUG.verboseWidthCalculation) {
                console.log(`[DEBUG] Using font-specific script override: ${overrideScript}`);
            }
        }

        // Calculate width using empirical data
        width = calculateEmpiricalWidth(text, fontSize, script, fontCategory, fontFactor);

        if (DEBUG.verboseWidthCalculation) {
            console.log(`[DEBUG] Empirical width calculation: ${width.toFixed(2)}px`);
        }

        // Calculate height
        let lineHeightBase = fontSize * 1.0;
        if (script === 'thai' || script === 'devanagari') {
            lineHeightBase *= 1.2;
            if (DEBUG.verboseWidthCalculation) {
                console.log(`[DEBUG] Applied height adjustment for ${script} script: factor 1.2`);
            }
        }

        if (DEBUG.verboseWidthCalculation) {
            console.log(`[DEBUG] Base line height: ${lineHeightBase.toFixed(2)}px, line spacing: ${lineSpacing}`);
        }

        height = 0;
        for (let i = 0; i < lines.length; i++) {
            // Use line spacing for all but the last line
            let currentHeight = lineHeightBase;
            if (i < lines.length - 1) {
                currentHeight *= lineSpacing;
            }
            height += currentHeight;

            if (DEBUG.verboseWidthCalculation) {
                console.log(`[DEBUG] Line ${i + 1} height: ${currentHeight.toFixed(2)}px, running total: ${height.toFixed(2)}px`);
            }
        }
    }

    // Apply width correction factor
    const originalWidth = width;
    width *= widthCorrection;

    if (DEBUG.verboseWidthCalculation) {
        console.log(`[DEBUG] Applied width correction factor ${widthCorrection}: ${originalWidth.toFixed(2)}px → ${width.toFixed(2)}px`);
    }

    // Apply a maximum reasonable width cap as a final check
    const charCount = text.split('\\N').reduce((sum, line) => sum + line.length, 0);
    const reasonableMaxWidth = charCount * fontSize * WIDTH_ESTIMATION.reasonableCharWidth;

    if (DEBUG.verboseWidthCalculation) {
        console.log(`[DEBUG] Character count: ${charCount}, reasonable maximum width: ${reasonableMaxWidth.toFixed(2)}px`);
    }

    const maxWidthCap = reasonableMaxWidth * WIDTH_ESTIMATION.maxWidthCapMultiplier;
    if (width > maxWidthCap) {
        if (DEBUG.verboseWidthCalculation) {
            console.log(`[DEBUG] Width estimation cap applied: ${width.toFixed(2)}px → ${reasonableMaxWidth.toFixed(2)}px`);
        }
        width = reasonableMaxWidth;
    }

    if (DEBUG.verboseWidthCalculation) {
        console.log(`[DEBUG] Final dimensions - width: ${width.toFixed(2)}px, height: ${height.toFixed(2)}px`);
    }

    return { width, height };
}

module.exports = {
    findFontFile,
    getFontCategoryAndFactor,
    calculateEmpiricalWidth,
    calculateTextDimensions
}; 
