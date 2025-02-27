#!/usr/bin/env node

/**
 * RoundedJS - Main CLI interface 
 * Generates ASS subtitles with rounded backgrounds from SRT files
 */

const path = require('path');
const fs = require('fs-extra');
const { program } = require('commander');
const { generateRoundedSubtitles } = require('./subtitle');
const { disableCanvas, enableVerboseLogging, getNodeInfo } = require('./config');
const packageInfo = require('../package.json');

// Set up the command line interface
program
    .name('roundedjs')
    .description('Convert SRT subtitles to ASS with rounded backgrounds')
    .version(packageInfo.version || '1.0.0')
    .argument('<srt-file>', 'Input SRT subtitle file')
    .argument('[video-file]', 'Optional video file for dimensions detection')
    .option('-o, --output <file>', 'Output ASS file (defaults to input file with .ass extension)')
    .option('-f, --font <name>', 'Font name (default: Arial)', 'Arial')
    .option('-s, --font-size <size>', 'Font size in pixels (default: 48)', parseInt, 48)
    .option('--text-color <color>', 'Text color in hex without # (default: FFFFFF)', 'FFFFFF')
    .option('--bg-color <color>', 'Background color in hex without # (default: 000000)', '000000')
    .option('--opacity <value>', 'Background opacity (0-255, where 0 is opaque, 255 is transparent)', parseInt, 0)
    .option('--padding-x <pixels>', 'Horizontal padding in pixels (default: 20)', parseInt, 20)
    .option('--padding-y <pixels>', 'Vertical padding in pixels (default: 10)', parseInt, 10)
    .option('--radius <pixels>', 'Corner radius in pixels (default: 10)', parseInt, 10)
    .option('--width-ratio <ratio>', 'Width adjustment ratio (default: 1.0)', parseFloat, 1.0)
    .option('--margin-bottom <pixels>', 'Bottom margin in pixels (default: 50)', (value) => parseInt(value, 10), 50)
    .option('--disable-canvas', 'Disable Canvas and use empirical width calculation for consistency')
    .option('--verbose', 'Enable verbose logging for debugging')
    .option('--node-info', 'Display Node.js version and environment information')
    .parse(process.argv);

// Main function to handle CLI arguments and run the subtitle generation
async function main() {
    const args = program.args;
    const options = program.opts();

    // Handle node-info option
    if (options.nodeInfo) {
        console.log(getNodeInfo());
        return;
    }

    // Check for input file
    const srtFile = args[0];
    if (!srtFile) {
        console.error('Error: Input SRT file is required');
        program.help();
        return;
    }

    // Make sure input file exists
    if (!fs.existsSync(srtFile)) {
        console.error(`Error: Input file not found: ${srtFile}`);
        return;
    }

    // Set output file if not specified
    let outputFile = options.output;
    if (!outputFile) {
        const srtBasename = path.basename(srtFile, path.extname(srtFile));
        outputFile = `${srtBasename}.ass`;
    }

    // Configure options
    if (options.disableCanvas) {
        disableCanvas();
        console.log('Canvas is disabled, using empirical width calculation for consistency');
    }

    if (options.verbose) {
        enableVerboseLogging();
        console.log('Verbose logging enabled');
    }

    // Get video file if provided
    const videoFile = args[1];

    // Convert opacity from 0-255 to hex
    const alphaHex = options.opacity.toString(16).padStart(2, '0').toUpperCase();

    // Prepare configuration for subtitle generation
    const config = {
        videoPath: videoFile,
        font: options.font,
        fontSize: options.fontSize,
        textColor: options.textColor,
        bgColor: options.bgColor,
        bgAlpha: options.opacity,
        paddingX: options.paddingX,
        paddingY: options.paddingY,
        radius: options.radius,
        widthRatio: options.widthRatio,
        marginBottom: options.marginBottom
    };

    try {
        console.log(`Converting ${srtFile} to ${outputFile}`);
        console.log('Configuration:');
        console.log(`- Font: ${config.font}, Size: ${config.fontSize}px`);
        console.log(`- Text Color: #${config.textColor}`);
        console.log(`- Background Color: #${config.bgColor}, Opacity: ${options.opacity}/255`);
        console.log(`- Padding: ${config.paddingX}px horizontal, ${config.paddingY}px vertical`);
        console.log(`- Radius: ${config.radius}px`);
        console.log(`- Width ratio: ${config.widthRatio}`);
        console.log(`- Bottom margin: ${config.marginBottom}px`);

        // Generate the subtitles
        await generateRoundedSubtitles(srtFile, videoFile, outputFile, config);

        console.log(`Conversion complete: ${outputFile}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run the program
main().catch(error => {
    console.error(`Fatal error: ${error.stack}`);
    process.exit(1);
}); 
