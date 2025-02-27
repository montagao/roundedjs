/**
 * Test script for RoundedJS
 * This script tests the width calculation consistency and shows debug info
 */

const { calculateTextDimensions } = require('./src/fonts');
const { detectScript } = require('./src/textUtils');
const { getNodeInfo, enableVerboseLogging, disableCanvas } = require('./src/config');

// Enable verbose logging
enableVerboseLogging();

// Test parameters
const TEST_SAMPLES = [
  "Hello world!",
  "This is a longer test sentence with more characters.",
  "CJK test: 你好，世界!",
  "Multi-line test\\Nwith two separate lines."
];

const FONTS = ["Arial", "Times New Roman"];
const FONT_SIZES = [36, 48];

// Print Node.js environment information
console.log("=== Node.js Environment Information ===");
console.log(getNodeInfo());
console.log();

console.log("=== Font Measurement Test with Canvas ===");
runTests(false);

console.log("\n=== Font Measurement Test with Empirical Calculation ===");
disableCanvas();
runTests(true);

/**
 * Run tests with various text samples, fonts and sizes
 */
function runTests(isEmpirical) {
  TEST_SAMPLES.forEach(text => {
    FONTS.forEach(font => {
      FONT_SIZES.forEach(fontSize => {
        const script = detectScript(text);
        console.log(`\nTesting: "${text}" with ${font} at ${fontSize}px (Script: ${script})`);
        
        // Run multiple measurements to check consistency
        const results = [];
        for (let i = 0; i < 3; i++) {
          const start = performance.now();
          const dimensions = calculateTextDimensions(text, fontSize, font);
          const end = performance.now();
          
          results.push({
            width: dimensions.width,
            height: dimensions.height,
            time: end - start
          });
        }
        
        // Print results
        results.forEach((result, i) => {
          console.log(`Run ${i+1}: Width ${result.width.toFixed(2)}, Height ${result.height.toFixed(2)}, Time: ${result.time.toFixed(2)}ms`);
        });
        
        // Check consistency
        const consistent = results.every((result, i, arr) => 
          i === 0 || (Math.abs(result.width - arr[0].width) < 0.01)
        );
        
        console.log(`Consistency: ${consistent ? "✓ PASSED" : "✗ FAILED"}`);
        console.log(`Method: ${isEmpirical ? "Empirical calculation" : "Canvas measurement"}`);
      });
    });
  });
} 
