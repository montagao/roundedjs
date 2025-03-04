/**
 * @file index.js
 * @description JavaScript wrapper for the ass-measure native module
 */

'use strict';

const bindings = require('bindings');
const assMeasureNative = bindings('ass_measure_native');

/**
 * Measures the dimensions of subtitle lines in an ASS file
 * 
 * @param {string} assFilePath - Path to the ASS subtitle file
 * @param {number} videoWidth - Width of the video in pixels
 * @param {number} videoHeight - Height of the video in pixels
 * @returns {Array<Object>} Array of subtitle line information
 * @throws {Error} If the parameters are invalid or if an error occurs during measurement
 */
function measureSubtitles(assFilePath, videoWidth, videoHeight) {
  // Validate parameters
  if (typeof assFilePath !== 'string') {
    throw new TypeError('assFilePath must be a string');
  }
  
  if (!Number.isInteger(videoWidth) || videoWidth <= 0) {
    throw new TypeError('videoWidth must be a positive integer');
  }
  
  if (!Number.isInteger(videoHeight) || videoHeight <= 0) {
    throw new TypeError('videoHeight must be a positive integer');
  }
  
  try {
    // Call the native function
    const result = assMeasureNative.measureLines(assFilePath, videoWidth, videoHeight);
    
    // Process the results (optional additional transformations)
    return result.map(line => ({
      text: line.text,
      width: line.width,
      height: line.height,
      startTime: line.startTime,
      endTime: line.endTime,
      
      // Add derived properties
      duration: line.endTime - line.startTime,
      
      // Helper methods
      getDurationInSeconds() {
        return (line.endTime - line.startTime) / 1000;
      }
    }));
  } catch (error) {
    throw new Error(`Failed to measure subtitles: ${error.message}`);
  }
}

module.exports = {
  measureSubtitles
}; 