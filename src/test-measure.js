/**
 * Test script to verify the integration of ass-measure Node.js addon
 */

'use strict';

const path = require('path');
const fs = require('fs-extra');
const { measureSubtitleDimensions } = require('./subtitle');

// Create a sample ASS file for testing
const testAssContent = `[Script Info]
Title: Test Subtitle
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
Timer: 100.0000

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,This is a test subtitle line 1
Dialogue: 0,0:00:06.00,0:00:10.00,Default,,0,0,0,,This is a test subtitle line 2 with some more text
Dialogue: 0,0:00:11.00,0:00:20.00,Default,,0,0,0,,This is a longer test subtitle line 3 with even more text to check dimensions`;

// Write test ASS file
const testAssFile = path.join(__dirname, '../test-sample.ass');
fs.writeFileSync(testAssFile, testAssContent, 'utf8');

console.log(`Created test ASS file: ${testAssFile}`);

// Video dimensions
const videoWidth = 1920;
const videoHeight = 1080;

try {
  // Call the measurement function
  console.log(`Testing measurement with video dimensions: ${videoWidth}x${videoHeight}`);
  const dimensions = measureSubtitleDimensions(testAssFile, videoWidth, videoHeight);
  
  // Display results
  if (dimensions) {
    console.log(`Successfully measured ${dimensions.length} subtitle lines:`);
    
    dimensions.forEach((line, i) => {
      console.log(`\nLine ${i + 1}:`);
      console.log(`  Text: "${line.text}"`);
      console.log(`  Dimensions: ${line.width}x${line.height} pixels`);
    });
  } else {
    console.error('Failed to measure subtitle dimensions');
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
} finally {
  // Clean up test file
  fs.removeSync(testAssFile);
  console.log('Cleaned up test file');
} 