/**
 * @file test.js
 * @description Test file for the ass-measure module
 */

'use strict';

const path = require('path');
const assMeasure = require('./');

// Path to a test ASS file - you need to replace this with an actual file
const testFilePath = process.argv[2] || path.join(__dirname, 'examples', 'test.ass');

// Video dimensions
const videoWidth = 1920;
const videoHeight = 1080;

console.log(`Testing ass-measure with file: ${testFilePath}`);
console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);

try {
  // Measure the subtitles
  const subtitles = assMeasure.measureSubtitles(testFilePath, videoWidth, videoHeight);
  
  // Display results
  console.log(`Found ${subtitles.length} subtitle lines:`);
  
  subtitles.forEach((line, index) => {
    console.log(`\nLine ${index + 1}:`);
    console.log(`  Text: "${line.text}"`);
    console.log(`  Dimensions: ${line.width}x${line.height} pixels`);
    console.log(`  Time: ${line.startTime}ms -> ${line.endTime}ms (${line.getDurationInSeconds()}s)`);
  });
  
  console.log('\nTest completed successfully!');
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
} 