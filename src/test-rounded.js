/**
 * Test script for rounded subtitles generation with the Node.js addon
 */

'use strict';

const path = require('path');
const fs = require('fs-extra');
const { generateRoundedSubtitles } = require('./subtitle');

// Create a sample SRT file for testing
const testSrtContent = `1
00:00:01,000 --> 00:00:05,000
This is a test subtitle line 1

2
00:00:06,000 --> 00:00:10,000
This is a test subtitle line 2 with some more text

3
00:00:11,000 --> 00:00:20,000
This is a longer test subtitle line 3 with even more text to check dimensions`;

// Path to test files
const testSrtFile = path.join(__dirname, '../test-sample.srt');
const outputAssFile = path.join(__dirname, '../test-output.ass');

// Write test SRT file
fs.writeFileSync(testSrtFile, testSrtContent, 'utf8');
console.log(`Created test SRT file: ${testSrtFile}`);

// Video dimensions
const videoWidth = 1920;
const videoHeight = 1080;

// Generate rounded subtitles
async function runTest() {
  try {
    console.log(`Generating rounded subtitles with video dimensions: ${videoWidth}x${videoHeight}`);
    
    // Generate the ASS file with rounded backgrounds
    const result = await generateRoundedSubtitles(
      testSrtFile,     // SRT input
      'dummy.mp4',     // Dummy video path (not actually used)
      outputAssFile,   // ASS output
      {
        useAssMeasure: true,  // Use our Node.js addon
        videoWidth,
        videoHeight,
        bgColor: '&H80000000',  // Semi-transparent black
        textColor: '&HFFFFFF',  // White text
        borderRadius: 5,        // Rounded corners
        fontSize: 48
      }
    );
    
    console.log(`\nSuccess! Generated ASS file: ${result}`);
    console.log(`\nFeel free to examine the file. It will be deleted in 5 seconds...`);
    
    // Wait 5 seconds before cleaning up
    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
  } finally {
    // Clean up test files
    fs.removeSync(testSrtFile);
    fs.removeSync(outputAssFile);
    console.log('Cleaned up test files');
  }
}

runTest(); 