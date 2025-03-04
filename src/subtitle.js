/**
 * Subtitle processing for SRT parsing and ASS subtitle generation with rounded backgrounds.
 */

const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const iconv = require('iconv-lite');
const { execSync } = require('child_process');
const { getVideoDimensions } = require('./video');
const { calculateTextDimensions } = require('./fonts');
const { detectScript, isRtlScript } = require('./textUtils');
const { WIDTH_ESTIMATION, DEBUG } = require('./config');
const os = require('os');

// SSA/ASS header template
function createAssHeader(videoWidth, videoHeight, predominantScript, fontName, fontSize, marginBottom, bgColor, textColor) {
    return `[Script Info]
Title: ASS subtitles with rounded background boxes
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 0
ScaledBorderAndShadow: yes
Language: ${predominantScript}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},&H00${textColor},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,10,10,${marginBottom},1
Style: Box-BG,${fontName},${fontSize / 2},&H00${bgColor},&H000000FF,&H00${bgColor},&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

/**
 * Parse SRT file with encoding detection and return subtitles.
 * 
 * @param {string} srtPath - Path to the SRT file
 * @returns {Array} - Array of subtitle objects with time in seconds
 */
function parseSRT(srtPath) {
    // Try to detect encoding and read file
    let content;
    try {
        const buffer = fs.readFileSync(srtPath);
        try {
            content = iconv.decode(buffer, 'utf-8');
        } catch (error) {
            // Try Latin-1 if UTF-8 fails
            try {
                content = iconv.decode(buffer, 'latin1');
                console.warn("Warning: SRT file not in UTF-8 format. Using Latin-1 encoding.");
            } catch (error) {
                // Try CP1252 as a last resort
                content = iconv.decode(buffer, 'cp1252');
                console.warn("Warning: SRT file not in UTF-8 format. Using CP1252 encoding.");
            }
        }
    } catch (error) {
        console.error(`Error reading SRT file: ${error.message}`);
        throw error;
    }

    // Regular expression to match SRT entries (similar to Python implementation)
    const pattern = /(\d+)\s+(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})\s+([\s\S]*?)(?=\n\d+\s+|$)/g;

    const subtitles = [];
    let match;

    while ((match = pattern.exec(content)) !== null) {
        const [, index, startTime, endTime, text] = match;

        subtitles.push({
            index: parseInt(index),
            start: parseSrtTime(startTime),
            end: parseSrtTime(endTime),
            text: text.trim().replace(/\n/g, '\\N')
        });
    }

    // Fix timing to prevent flickering (match Python implementation)
    for (let i = 0; i < subtitles.length - 1; i++) {
        const currentSub = subtitles[i];
        const nextSub = subtitles[i + 1];

        // If the gap is small (less than 0.1s), make end time of current = start time of next
        if (nextSub.start - currentSub.end < 0.1) {
            currentSub.end = nextSub.start;
        }
    }

    return subtitles;
}

/**
 * Convert SRT time string to seconds.
 * 
 * @param {string} timeStr - SRT format timestamp (HH:MM:SS,mmm)
 * @returns {number} - Time in seconds
 */
function parseSrtTime(timeStr) {
    const timeComponents = timeStr.replace(',', '.').split(':');
    const hours = parseFloat(timeComponents[0]);
    const minutes = parseFloat(timeComponents[1]);
    const seconds = parseFloat(timeComponents[2]);

    return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format seconds to ASS time format.
 * 
 * @param {number} seconds - Time in seconds
 * @returns {string} - ASS format time (H:MM:SS.ss)
 */
function formatAssTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
}

/**
 * Generate a rounded rectangle drawing command for ASS subtitles.
 * 
 * @param {number} halfWidth - Half width of the rectangle
 * @param {number} halfHeight - Half height of the rectangle
 * @param {number} borderRadius - Corner radius
 * @returns {string} - ASS drawing commands for a rounded rectangle
 */
function generateRoundedRectDrawing(halfWidth, halfHeight, borderRadius) {
    let drawing = '';

    // Ensure border radius is not larger than the dimensions of the box
    // by automatically adjusting it to fit smaller subtitles
    const maxAllowedRadius = Math.max(1, Math.min(halfHeight, halfWidth) - 1);
    const effectiveBorderRadius = borderRadius > 0 ? Math.min(borderRadius, maxAllowedRadius) : 0;
    
    if (effectiveBorderRadius > 0) {
        // Draw a rounded rectangle using bezier curves for corners (matching Python implementation)
        // Start at top-left + radius, going clockwise
        drawing += `m ${-halfWidth + effectiveBorderRadius} ${-halfHeight} `; // Starting point
        drawing += `l ${halfWidth - effectiveBorderRadius} ${-halfHeight} `; // Top edge

        // Top-right corner with bezier
        drawing += `b ${halfWidth} ${-halfHeight} ${halfWidth} ${-halfHeight + effectiveBorderRadius} ${halfWidth} ${-halfHeight + effectiveBorderRadius} `;

        drawing += `l ${halfWidth} ${halfHeight - effectiveBorderRadius} `; // Right edge

        // Bottom-right corner
        drawing += `b ${halfWidth} ${halfHeight} ${halfWidth - effectiveBorderRadius} ${halfHeight} ${halfWidth - effectiveBorderRadius} ${halfHeight} `;

        // Bottom edge
        drawing += `l ${-halfWidth + effectiveBorderRadius} ${halfHeight} `;

        // Bottom-left corner
        drawing += `b ${-halfWidth} ${halfHeight} ${-halfWidth} ${halfHeight - effectiveBorderRadius} ${-halfWidth} ${halfHeight - effectiveBorderRadius} `;

        drawing += `l ${-halfWidth} ${-halfHeight + effectiveBorderRadius} `; // Left edge

        // Top-left corner
        drawing += `b ${-halfWidth} ${-halfHeight} ${-halfWidth + effectiveBorderRadius} ${-halfHeight} ${-halfWidth + effectiveBorderRadius} ${-halfHeight} `;
    } else {
        // Simple rectangle without rounded corners
        drawing += `m ${-halfWidth} ${-halfHeight} `; // Top-left
        drawing += `l ${halfWidth} ${-halfHeight} `; // Top-right
        drawing += `l ${halfWidth} ${halfHeight} `; // Bottom-right
        drawing += `l ${-halfWidth} ${halfHeight} `; // Bottom-left
        drawing += `l ${-halfWidth} ${-halfHeight} `; // Back to top-left
    }

    return drawing;
}

/**
 * Creates a temporary ASS file for measuring dimensions
 * 
 * @param {Array} subtitles - Array of subtitles 
 * @param {string} fontName - Font name
 * @param {number} fontSize - Font size
 * @param {number} videoWidth - Video width
 * @param {number} videoHeight - Video height
 * @returns {string} - Path to created temporary ASS file
 */
function createTemporaryAssFile(subtitles, fontName, fontSize, videoWidth, videoHeight) {
    const tempFilePath = path.join(os.tmpdir(), `temp-${Date.now()}.ass`);
    
    // Create a basic ASS file with just the subtitles in the Default style
    let assContent = `[Script Info]
Title: Temporary ASS file for measurement
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Add each subtitle as a dialogue line
    subtitles.forEach((sub, index) => {
        const startTime = formatAssTime(sub.start);
        const endTime = formatAssTime(sub.end);
        assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${sub.text}\n`;
    });

    // Write the file
    fs.writeFileSync(tempFilePath, assContent, 'utf8');
    
    return tempFilePath;
}

/**
 * Measure subtitle dimensions using the ass-measure library
 * 
 * @param {string} assFilePath - Path to ASS file
 * @param {number} videoWidth - Video width
 * @param {number} videoHeight - Video height
 * @returns {Array} - Array of subtitle dimensions
 */
function measureSubtitleDimensions(assFilePath, videoWidth, videoHeight) {
    try {
        // Execute the command using 'mass' from PATH
        const result = execSync(
            `mass "${assFilePath}" ${videoWidth} ${videoHeight}`,
            { encoding: 'utf8' }
        );
        
        // Parse the output to extract dimensions
        const dimensions = [];
        const lines = result.split('\n');
        let currentLine = null;
        
        for (const line of lines) {
            if (line.startsWith('Line ') && line.includes(':')) {
                currentLine = {
                    index: parseInt(line.match(/Line (\d+):/)[1]) - 1,
                    text: '',
                    width: 0,
                    height: 0
                };
            } else if (line.startsWith('  Text:') && currentLine) {
                // Extract text content
                const match = line.match(/Text: "(.*)"/);
                if (match) {
                    currentLine.text = match[1];
                }
            } else if (line.startsWith('  Dimensions:') && currentLine) {
                // Extract dimensions
                const match = line.match(/Dimensions: (\d+) x (\d+) pixels/);
                if (match) {
                    currentLine.width = parseInt(match[1]);
                    currentLine.height = parseInt(match[2]);
                    dimensions.push(currentLine);
                    currentLine = null;
                }
            }
        }
        
        return dimensions;
    } catch (error) {
        console.error(`Error measuring subtitle dimensions: ${error.message}`);
        // Fallback to estimating dimensions if the measurement fails
        console.warn('Falling back to text dimension estimation.');
        return null;
    }
}

/**
 * Generate an ASS subtitle file from SRT content with rounded backgrounds.
 * 
 * @param {string} srtPath - Path to the SRT file
 * @param {string} videoPath - Path to the video file
 * @param {string} outputPath - Path for output ASS file
 * @param {Object} options - Configuration options
 * @returns {Promise<string>} - Path to the generated ASS file
 */
async function generateRoundedSubtitles(srtPath, videoPath, outputPath, options = {}) {
    try {
        // Parse SRT file
        const subtitles = parseSRT(srtPath);
        if (!subtitles.length) {
            throw new Error('No subtitles found in the SRT file');
        }

        console.log(`Parsed ${subtitles.length} subtitles from ${srtPath}`);

        // Get video dimensions
        let videoWidth = options.videoWidth || 1920;
        let videoHeight = options.videoHeight || 1080;

        // If videoPath is provided, get dimensions from the video
        if (videoPath) {
            try {
                const dimensions = await getVideoDimensions(videoPath);
                if (dimensions) {
                    videoWidth = dimensions.width;
                    videoHeight = dimensions.height;
                    console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
                }
            } catch (error) {
                console.warn(`Warning: Could not get video dimensions: ${error.message}`);
                console.warn('Using default dimensions: 1920x1080');
            }
        }

        // Configuration with defaults matching Python implementation
        const config = {
            marginBottom: options.marginBottom || 50,
            bgAlpha: options.bgAlpha || 80, // 0-255
            bgColor: options.bgColor || '000000',
            textColor: options.textColor || 'FFFFFF',
            paddingV: options.paddingY || 10,
            paddingH: options.paddingX || 0,
            minWidthRatio: options.minWidthRatio || 0.0,
            maxWidthRatio: options.maxWidthRatio || 0.9,
            borderRadius: options.radius || 10,
            lineSpacing: options.lineSpacing || 1.2,
            fontName: options.font || 'Arial',
            widthCorrection: options.widthCorrection || 0.95,
            tightFit: options.tightFit !== undefined ? options.tightFit : true,
            disableMinWidth: options.disableMinWidth !== undefined ? options.disableMinWidth : true,
            useAssMeasure: options.useAssMeasure !== undefined ? options.useAssMeasure : true
        };

        // Calculate font size based on video height (matching Python implementation)
        const fontSize = Math.floor(videoHeight / 20);

        // Determine minimum and maximum box width based on video width
        const minWidth = config.disableMinWidth ? 0 : videoWidth * config.minWidthRatio;
        const maxWidth = videoWidth * config.maxWidthRatio;

        // Determine predominant script from all subtitles
        const allText = subtitles.map(sub => sub.text).join(' ');
        const predominantScript = detectScript(allText);
        console.log(`Detected predominant script: ${predominantScript}`);

        // Calculate average character count
        const totalChars = subtitles.reduce((sum, sub) => sum + sub.text.replace('\\N', '').length, 0);
        const averageChars = subtitles.length > 0 ? totalChars / subtitles.length : 0;
        console.log(`Average subtitle length: ${averageChars.toFixed(1)} characters`);

        // Adjust font for script if needed (matching Python implementation)
        let fontName = config.fontName;
        if (predominantScript === 'cjk' && fontName === 'Arial') {
            if (process.platform === 'win32') { // Windows
                fontName = 'Microsoft YaHei';
            } else { // macOS, Linux
                fontName = 'Noto Sans CJK SC';
            }
            console.log(`Automatically selected font for CJK script: ${fontName}`);
        }

        // Check for RTL script
        const isRtl = isRtlScript(predominantScript);

        // Create ASS header with styles
        let assContent = createAssHeader(
            videoWidth,
            videoHeight,
            predominantScript,
            fontName,
            fontSize,
            config.marginBottom,
            config.bgColor,
            config.textColor
        );

        // Use ass-measure to get accurate subtitle dimensions
        let subtitleDimensions = null;
        if (config.useAssMeasure) {
            console.log('Using ass-measure for accurate subtitle dimensions');
            // Create a temporary ASS file for measurement
            const tempAssFile = createTemporaryAssFile(subtitles, fontName, fontSize, videoWidth, videoHeight);
            // Measure subtitle dimensions
            subtitleDimensions = measureSubtitleDimensions(tempAssFile, videoWidth, videoHeight);
            // Clean up temporary file
            fs.removeSync(tempAssFile);
        }

        // Generate event lines for each subtitle
        const events = [];

        for (let idx = 0; idx < subtitles.length; idx++) {
            const sub = subtitles[idx];
            const startTime = formatAssTime(sub.start);
            const endTime = formatAssTime(sub.end);

            // Calculate position for both text and box
            const yPos = videoHeight - config.marginBottom;

            // Detect script for this specific subtitle
            const textScript = detectScript(sub.text);

            // Calculate box dimensions using ass-measure results if available
            let textWidth, textHeight;
            
            if (subtitleDimensions && idx < subtitleDimensions.length) {
                // Use the accurate dimensions from ass-measure
                textWidth = subtitleDimensions[idx].width;
                textHeight = subtitleDimensions[idx].height;
                console.log(`Using measured dimensions for line ${idx+1}: ${textWidth}x${textHeight}`);
            } else {
            }

            // Add padding to dimensions with special handling for zero padding case
            let boxWidth;
            if (config.paddingH === 0) {
                // When paddingH is exactly 0, use minimal padding to ensure text fits
                boxWidth = textWidth + 2; // Just add 2 pixels total
            } else {
                // Otherwise use the specified padding
                boxWidth = textWidth + (config.paddingH * 2);
            }

            // Vertical padding is always applied
            const boxHeight = textHeight + (config.paddingV * 2);

            // Ensure box width doesn't exceed video width
            boxWidth = Math.min(boxWidth, videoWidth * 0.98); // Leave a small margin

            // Apply minimum width constraint only if enabled
            if (!config.disableMinWidth) {
                boxWidth = Math.max(boxWidth, minWidth);
            }

            // Apply video-relative maximum width
            boxWidth = Math.min(boxWidth, maxWidth);

            // Debug output for troubleshooting (only for first subtitle)
            if (idx === 0) {
                console.log(`Text: '${sub.text}'`);
                console.log(`Calculated text dimensions: width=${textWidth.toFixed(1)}, height=${textHeight.toFixed(1)}`);
                console.log(`Final box dimensions: width=${boxWidth.toFixed(1)}, height=${boxHeight.toFixed(1)}`);
                console.log(`Padding: horizontal=${config.paddingH}, vertical=${config.paddingV}`);
                const charCount = sub.text.replace("\\N", "").length;
                console.log(`Character count: ${charCount} chars`);
                console.log(`Width per character: ${(textWidth / Math.max(1, charCount)).toFixed(1)} pixels`);
            }

            // Half dimensions for drawing
            const halfWidth = boxWidth / 2;
            const halfHeight = boxHeight / 2;

            // Check if we need to adjust border radius and log for the first few subtitles
            const maxAllowedRadius = Math.max(1, Math.min(halfHeight, halfWidth) - 1);
            const originalBorderRadius = config.borderRadius;
            const effectiveBorderRadius = originalBorderRadius > 0 ? Math.min(originalBorderRadius, maxAllowedRadius) : 0;
            
            if (idx < 3 || effectiveBorderRadius !== originalBorderRadius) {
                console.log(`Subtitle ${idx+1}: halfWidth=${halfWidth.toFixed(1)}, halfHeight=${halfHeight.toFixed(1)}`);
                console.log(`Requested border radius: ${originalBorderRadius}, Effective radius: ${effectiveBorderRadius}`);
            }

            // Background on layer 0 using Box-BG style with top-left alignment (7)
            const bgAlphaHex = config.bgAlpha.toString(16).padStart(2, '0');
            let bg = `0,${startTime},${endTime},Box-BG,,0,0,0,,{\\pos(${videoWidth / 2},${yPos})\\bord0\\shad0\\1c&H${config.bgColor}\\1a&H${bgAlphaHex}\\p1}`;

            // Generate the rounded rectangle drawing with the effective border radius
            bg += generateRoundedRectDrawing(halfWidth, halfHeight, effectiveBorderRadius);
            bg += "{\\p0}";

            // Add RTL marker for RTL script if different from predominant script
            const currentRtlMarker = isRtlScript(textScript) ? '\\u+F220' : '';

            // Text on layer 1 with center alignment (5) for both horizontal and vertical centering
            const text = `1,${startTime},${endTime},Default,,0,0,0,,{\\an5\\pos(${videoWidth / 2},${yPos})\\bord0\\shad0}${currentRtlMarker}${sub.text}`;

            events.push("Dialogue: " + bg);
            events.push("Dialogue: " + text);
        }

        // Add events to ASS content
        assContent += events.join('\n') + '\n';

        // Write ASS file
        fs.writeFileSync(outputPath, assContent, 'utf8');
        console.log(`ASS file generated: ${outputPath}`);

        // Print credit info like Python version
        const packageJson = require('../package.json');
        console.log(`Generated by RoundedSSA v${packageJson.version}`);
        console.log(`Created by montagao`);
        console.log(`Script: ${predominantScript}`);

        return outputPath;
    } catch (error) {
        console.error(`Error generating subtitles: ${error.message}`);
        throw error;
    }
}

module.exports = {
    parseSRT,
    generateRoundedSubtitles
};
