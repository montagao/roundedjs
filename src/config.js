/**
 * Global configuration settings for RoundedJS.
 * This file ensures consistent behavior across different environments.
 */

// Width estimation algorithm settings
const WIDTH_ESTIMATION = {
  // Set to false to force only using empirical calculation (more consistent across environments)
  useCanvas: true,
  
  // Default width correction factor (applied to all calculated widths)
  defaultWidthCorrection: 0.95,
  
  // Character width caps as ratio of font size
  maxAverageCharWidth: 0.7,
  reasonableCharWidth: 0.6,
  
  // Maximum width cap multiplier
  maxWidthCapMultiplier: 1.2,
};

// Debug settings
const DEBUG = {
  // Set to true to enable detailed logging of width calculations
  verboseWidthCalculation: false,
  
  // Set to true to log font resolution paths
  logFontPaths: false,
};

/**
 * Disable Canvas for consistent results across environments.
 */
function disableCanvas() {
  WIDTH_ESTIMATION.useCanvas = false;
  console.log("Canvas disabled. Using consistent empirical width calculation only.");
}

/**
 * Enable verbose logging for debugging.
 */
function enableVerboseLogging() {
  DEBUG.verboseWidthCalculation = true;
  DEBUG.logFontPaths = true;
  console.log("Verbose logging enabled.");
}

/**
 * Get information about the Node.js environment.
 */
function getNodeInfo() {
  return {
    version: process.version,
    platform: process.platform,
    arch: process.arch,
    executable: process.execPath
  };
}

module.exports = {
  WIDTH_ESTIMATION,
  DEBUG,
  disableCanvas,
  enableVerboseLogging,
  getNodeInfo
}; 
