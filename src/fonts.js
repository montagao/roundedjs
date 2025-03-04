/**
 * Font utilities for font detection, measurement, and text dimensions calculation.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const PDFDocument = require('pdfkit');
const opentype = require('opentype.js');
const { detectScript, isMonospaceFont } = require('./textUtils');
const { WIDTH_ESTIMATION, DEBUG } = require('./config');

// Cache objects to improve performance
const FONT_PATH_CACHE = {};
const FONT_CATEGORY_CACHE = {};
const PDF_FONT_CACHE = {};

/**
 * Character width data by script and font category.
 * Values represent average character width as a ratio of font size.
 */
const CHARACTER_WIDTH_DATA = {
    // Latin script (English, European languages)
    latin: {
        default: 0.65,    // Arial, Helvetica, etc.
        narrow: 0.58,     // Times New Roman, etc.
        wide: 0.70,       // Comic Sans, etc.
        monospace: 0.75,  // Courier, etc.
        // Common individual character widths for Latin script
        chars: {
            'i': 0.28, 'l': 0.28, 'I': 0.34, 'j': 0.34, 't': 0.41,
            'r': 0.41, 'f': 0.41, 's': 0.48, 'a': 0.54, 'e': 0.54,
            'n': 0.63, 'o': 0.63, 'u': 0.63, 'c': 0.54, 'z': 0.54,
            'g': 0.60, 'k': 0.60, 'v': 0.60, 'x': 0.60, 'y': 0.60,
            'b': 0.60, 'd': 0.60, 'h': 0.60, 'p': 0.60, 'q': 0.60,
            'm': 0.98, 'w': 0.89, 'A': 0.81, 'B': 0.81, 'C': 0.81,
            'D': 0.81, 'E': 0.75, 'F': 0.69, 'G': 0.89, 'H': 0.89,
            'J': 0.63, 'K': 0.81, 'L': 0.69, 'M': 1.03, 'N': 0.89,
            'O': 0.95, 'P': 0.75, 'Q': 0.95, 'R': 0.81, 'S': 0.75,
            'T': 0.75, 'U': 0.89, 'V': 0.81, 'W': 1.15, 'X': 0.81,
            'Y': 0.75, 'Z': 0.75, '0': 0.63, '1': 0.63, '2': 0.63,
            '3': 0.63, '4': 0.63, '5': 0.63, '6': 0.63, '7': 0.63,
            '8': 0.63, '9': 0.63, '.': 0.34, ',': 0.34, ':': 0.34,
            ';': 0.34, '!': 0.34, '?': 0.54, '"': 0.41, "'": 0.28,
            '(': 0.41, ')': 0.41, '[': 0.41, ']': 0.41, '{': 0.41,
            '}': 0.41, '*': 0.48, '+': 0.69, '-': 0.41, '_': 0.63,
            '/': 0.34, '\\': 0.34, '@': 1.03, '#': 0.69, '$': 0.63,
            '%': 1.03, '^': 0.63, '&': 0.81, ' ': 0.34
        }
    },
    // Other scripts with width multipliers
    cyrillic: { default: 0.65, narrow: 0.56, wide: 0.71, monospace: 0.75 },
    arabic: { default: 0.69, narrow: 0.63, wide: 0.75, monospace: 0.75 },
    hebrew: { default: 0.68, narrow: 0.60, wide: 0.73, monospace: 0.75 },
    cjk: { default: 1.05, narrow: 0.95, wide: 1.1, monospace: 1.05 },
    thai: { default: 0.75, narrow: 0.69, wide: 0.81, monospace: 0.75 },
    devanagari: { default: 0.78, narrow: 0.73, wide: 0.85, monospace: 0.78 },
    other: { default: 0.69, narrow: 0.63, wide: 0.75, monospace: 0.75 }
};

/**
 * Font categories with associated adjustment factors.
 * Categories: default, narrow, wide, monospace
 */
const FONT_CATEGORIES = {
    // Default proportional fonts
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

    // Monospace fonts
    'Courier New': { category: 'monospace', factor: 1.0 },
    'Consolas': { category: 'monospace', factor: 1.0 },
    'Courier': { category: 'monospace', factor: 1.0 },
    'Monaco': { category: 'monospace', factor: 1.0 },
    'Menlo': { category: 'monospace', factor: 1.0 },
    'Lucida Console': { category: 'monospace', factor: 1.0 },
    'DejaVu Sans Mono': { category: 'monospace', factor: 1.0 },
    'Andale Mono': { category: 'monospace', factor: 1.0 },

    // CJK fonts
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
    'Noto Sans CJK KR': { category: 'default', factor: 1.0, script: 'cjk' }
};

// Common font paths by platform
const FONT_PATHS = {
    win32: [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')],
    darwin: ['/System/Library/Fonts', '/Library/Fonts', path.join(os.homedir(), 'Library/Fonts')],
    linux: [
        '/usr/share/fonts',
        '/usr/local/share/fonts',
        path.join(os.homedir(), '.fonts'),
        path.join(os.homedir(), '.local/share/fonts')
    ]
};

// Standard PDF fonts available in PDFKit without embedding
const PDF_STANDARD_FONTS = [
    'Arial',
    'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
    'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique', 
    'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
    'Symbol', 'ZapfDingbats'
];

/**
 * Get text dimensions using PDFKit (more accurate than Canvas).
 * 
 * @param {string} text - The text to measure
 * @param {number} fontSize - Font size in pixels
 * @param {string} fontName - Name of the font to use
 * @returns {Object|null} - Object with width and height, or null if measurement failed
 */
function getTextDimensionsPDF(text, fontSize, fontName = 'Helvetica') {
    if (!WIDTH_ESTIMATION.useCanvas) {
        if (DEBUG.verboseWidthCalculation) {
            console.log(`[DEBUG] PDF measurement disabled`);
        }
        return null;
    }

    try {
        // Create a PDF document for text measurement
        const doc = new PDFDocument({ autoFirstPage: true });
        
        // Normalize font name
        const normalizedName = fontName.toLowerCase();
        
        // Try standard fonts first (by name)
        let fontLoaded = false;
        
        // Check if it's a standard PDF font
        const stdFontMatch = PDF_STANDARD_FONTS.find(f => 
            f.toLowerCase() === normalizedName || 
            f.toLowerCase().startsWith(normalizedName + '-'));
            
        if (stdFontMatch) {
            // Use standard font
            doc.font(stdFontMatch);
            fontLoaded = true;
            
            if (DEBUG.verboseWidthCalculation) {
                console.log(`[DEBUG] Using standard PDF font: ${stdFontMatch}`);
            }
        } else {
            // Try to map common font names to standard PDF fonts
            const fontMappings = {
                'arial': 'Helvetica',
                'helvetica': 'Helvetica',
                'times': 'Times-Roman',
                'times new roman': 'Times-Roman',
                'courier': 'Courier',
                'courier new': 'Courier',
                'georgia': 'Times-Roman',
                'verdana': 'Helvetica',
                'tahoma': 'Helvetica',
                'trebuchet': 'Helvetica',
                'comic': 'Helvetica',
                'calibri': 'Helvetica',
                'cambria': 'Times-Roman',
                'garamond': 'Times-Roman',
                'palatino': 'Times-Roman',
                'consolas': 'Courier',
                'monaco': 'Courier',
                'menlo': 'Courier'
            };
            
            const mappedFont = fontMappings[normalizedName] || 
                               Object.entries(fontMappings).find(([key]) => 
                                   normalizedName.includes(key))?.[1];
            
            if (mappedFont) {
                doc.font(mappedFont);
                fontLoaded = true;
                
                if (DEBUG.verboseWidthCalculation) {
                    console.log(`[DEBUG] Mapped '${fontName}' to standard PDF font: ${mappedFont}`);
                }
            }
        }
        
        // Fallback to Helvetica if no font was loaded
        if (!fontLoaded) {
            doc.font('Helvetica');
            
            if (DEBUG.verboseWidthCalculation) {
                console.log(`[DEBUG] Using fallback font: Helvetica for '${fontName}'`);
            }
        }
        
        // Set font size
        doc.fontSize(fontSize);
        
        // Process lines
        const lines = text.split('\\N');
        let maxWidth = 0;
        let totalHeight = 0;
        
        // Calculate line height
        const lineHeight = fontSize * 1.2;
        
        // Measure each line
        for (const line of lines) {
            // Get width of this line
            const lineWidth = doc.widthOfString(line);
            maxWidth = Math.max(maxWidth, lineWidth);
            totalHeight += lineHeight;
        }
        
        // Adjust height for line spacing
        if (lines.length > 1) {
            totalHeight -= lineHeight * 0.2;
        }
        
        // Apply a small correction factor for browser rendering
        const browserAdjustment = 1.05;
        maxWidth *= browserAdjustment;

        console.log("pdfkit got line width", width);
        
        return { width: maxWidth, height: totalHeight };
    } catch (error) {
        console.log(`PDF measurement error: ${error.message}`);
        return null;
    }
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

    // Try direct or case-insensitive match
    if (FONT_CATEGORIES[fontName]) {
        FONT_CATEGORY_CACHE[fontName] = FONT_CATEGORIES[fontName];
        return FONT_CATEGORIES[fontName];
    }

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

    // Default to Arial-like if not found
    const result = { category: 'default', factor: 1.0 };
    FONT_CATEGORY_CACHE[fontName] = result;
    return result;
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

    // Get script-specific width data (default to 'other' if not found)
    const scriptData = CHARACTER_WIDTH_DATA[script] || CHARACTER_WIDTH_DATA.other;
    
    // Get base multiplier for this font category (default to 'default' if not found)
    const baseMultiplier = (scriptData[fontCategory] || scriptData.default) * fontFactor;

    // Process each line
    for (const line of lines) {
        let lineWidth = 0;

        // For Latin script, use character-specific widths when available
        if (script === 'latin' && scriptData.chars) {
            for (const char of line) {
                // Use specific char width or average width
                lineWidth += (scriptData.chars[char] || baseMultiplier) * fontSize;
            }
        } else {
            // For other scripts, use average character width
            lineWidth = line.length * baseMultiplier * fontSize;
        }

        maxWidth = Math.max(maxWidth, lineWidth);
    }

    return maxWidth;
}

/**
 * Calculate text dimensions using PDFKit if available, fall back to empirical data.
 * 
 * @param {string} text - The text to measure
 * @param {number} fontSize - Font size in pixels
 * @param {string} fontName - The name of the font
 * @param {number} widthCorrection - Width correction factor
 * @param {number} lineSpacing - Line spacing multiplier
 * @param {boolean} tightFit - Whether to use tight fitting (preserved for compatibility)
 * @returns {Object} - Object with width and height properties
 */
function calculateTextDimensions(text, fontSize, fontName = 'Arial', widthCorrection = null, lineSpacing = 1.2, tightFit = true) {
    // Use config default if widthCorrection is null
    if (widthCorrection === null) {
        widthCorrection = WIDTH_ESTIMATION.defaultWidthCorrection;
    }

    if (DEBUG.verboseWidthCalculation) {
        console.log(`[DEBUG] Calculating dimensions for '${text.substring(0, 20)}${text.length > 20 ? '...' : ''}', font: ${fontName}, size: ${fontSize}px`);
    }

    let width = null;
    let height = null;
    
    // Try PDFKit method first (using font name only)
    const pdfResult = getTextDimensionsPDF(text, fontSize, fontName);
    
    if (pdfResult) {
        width = pdfResult.width;
        height = pdfResult.height;
        
        if (DEBUG.verboseWidthCalculation) {
            console.log(`[DEBUG] PDFKit width: ${width.toFixed(2)}px, height: ${height.toFixed(2)}px`);
        }
    }

    // Fall back to empirical calculation if PDFKit failed
    if (width === null || height === null) {
        console.log("SOMETHING WENT WRONG");
        // Get text script and font properties
        const script = detectScript(text);
        const fontInfo = getFontCategoryAndFactor(fontName);
        const fontCategory = fontInfo.category;
        const fontFactor = fontInfo.factor;
        
        // Use font script override if available
        const effectiveScript = fontInfo.script || script;

        if (DEBUG.verboseWidthCalculation) {
            console.log(`[DEBUG] Using empirical method - script: ${effectiveScript}, category: ${fontCategory}`);
        }

        // Calculate width using character width data
        width = calculateEmpiricalWidth(text, fontSize, effectiveScript, fontCategory, fontFactor);

        // Calculate height based on line count
        const lines = text.split('\\N');
        let lineHeightBase = fontSize;
        
        // Apply height adjustments for certain scripts
        if (effectiveScript === 'thai' || effectiveScript === 'devanagari') {
            lineHeightBase *= 1.2;
        }

        // Sum up height for all lines with line spacing
        height = 0;
        for (let i = 0; i < lines.length; i++) {
            // Add the line height (with line spacing for all but the last line)
            let currentHeight = lineHeightBase;
            if (i < lines.length - 1) {
                currentHeight *= lineSpacing;
            }
            height += currentHeight;
        }
    }

    // Apply width correction factor
    width *= widthCorrection;
    
    // Apply browser rendering adjustment factor
    const browserRenderingAdjustment = 1.05; // Additional 5% for browser rendering
    width *= browserRenderingAdjustment;
    
    // Apply reasonable width cap if needed
    const charCount = text.split('\\N').reduce((sum, line) => sum + line.length, 0);
    const reasonableCharWidth = WIDTH_ESTIMATION.reasonableCharWidth * 1.2;
    const reasonableMaxWidth = charCount * fontSize * reasonableCharWidth;
    
    // Cap width if it exceeds reasonable maximum
    if (width > reasonableMaxWidth * WIDTH_ESTIMATION.maxWidthCapMultiplier) {
        width = reasonableMaxWidth;
    }

    return { width, height };
}

module.exports = {
    getFontCategoryAndFactor,
    calculateEmpiricalWidth,
    calculateTextDimensions,
    getTextDimensionsPDF
}; 
