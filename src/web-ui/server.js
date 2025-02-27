const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { generateRoundedSubtitles } = require('../subtitle');
const { disableCanvas, enableVerboseLogging } = require('../config');
const { exec, spawn } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Helper function to validate ASS file content
async function validateAssFile(filePath, logs) {
    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            logs.push({ type: 'error', message: `ASS file not found: ${filePath}` });
            return false;
        }
        
        // Check file size
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
            logs.push({ type: 'error', message: `ASS file is empty: ${filePath}` });
            return false;
        }
        
        // Read file content
        const content = await fs.readFile(filePath, 'utf8');
        
        // Basic structure validation
        const hasScriptInfo = content.includes('[Script Info]');
        const hasStyles = content.includes('[V4+ Styles]');
        const hasEvents = content.includes('[Events]');
        
        if (!hasScriptInfo || !hasStyles || !hasEvents) {
            logs.push({ 
                type: 'error', 
                message: `ASS file is missing required sections: ${!hasScriptInfo ? '[Script Info] ' : ''}${!hasStyles ? '[V4+ Styles] ' : ''}${!hasEvents ? '[Events] ' : ''}` 
            });
            return false;
        }
        
        // Check for dialogue lines
        const hasDialogue = content.includes('Dialogue:');
        if (!hasDialogue) {
            logs.push({ type: 'error', message: 'ASS file has no dialogue lines' });
            return false;
        }
        
        logs.push({ 
            type: 'info', 
            message: `ASS file validated successfully: ${stats.size} bytes, contains required sections` 
        });
        return true;
    } catch (error) {
        logs.push({ type: 'error', message: `Error validating ASS file: ${error.message}` });
        return false;
    }
}

const app = express();
const port = process.env.PORT || 3000;

// Set up static file serving
app.use(express.static(path.join(__dirname)));
app.use('/generated', express.static(path.join(__dirname, 'generated')));

// Add explicit route for serving generated files
app.get('/generated/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'generated', req.params.filename);
    
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(filePath);
});

// Configure multer for file uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = path.join(__dirname, 'uploads');
            fs.ensureDirSync(uploadDir);
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + '-' + file.originalname);
        }
    })
});

// Handle subtitle generation
app.post('/generate', upload.fields([
    { name: 'srtFile', maxCount: 1 },
    { name: 'videoFile', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files.srtFile) {
            return res.status(400).json({ error: 'No SRT file uploaded' });
        }

        const srtFile = req.files.srtFile[0];
        const videoFile = req.files.videoFile ? req.files.videoFile[0] : null;

        // Get configuration options from request body
        const config = {
            font: req.body.font || 'Arial',
            fontSize: parseInt(req.body.fontSize, 10) || 48,
            textColor: req.body.textColor || 'FFFFFF',
            bgColor: req.body.bgColor || '000000',
            bgAlpha: parseInt(req.body.opacity, 10) || 80,
            paddingX: parseInt(req.body.paddingX, 10) || 20,
            paddingY: parseInt(req.body.paddingY, 10) || 10,
            radius: parseInt(req.body.radius, 10) || 10,
            widthCorrection: parseFloat(req.body.widthRatio) || 1.0,
            marginBottom: parseInt(req.body.marginBottom, 10) || 50
        };

        // Handle special options
        if (req.body.disableCanvas === 'true') {
            disableCanvas();
        }
        
        if (req.body.verbose === 'true') {
            enableVerboseLogging();
        }

        // Generate output file paths
        const outputDir = path.join(__dirname, 'generated');
        fs.ensureDirSync(outputDir);
        
        const baseName = path.basename(srtFile.originalname, path.extname(srtFile.originalname));
        const outputFile = path.join(outputDir, baseName + '.ass');
        const previewVideoFile = path.join(outputDir, baseName + '_preview.mp4');

        // Capture console output for client
        const logs = [];
        const originalConsoleLog = console.log;
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;

        // Override console methods to capture logs
        console.log = function() {
            logs.push({ type: 'info', message: Array.from(arguments).join(' ') });
            originalConsoleLog.apply(console, arguments);
        };
        
        console.warn = function() {
            logs.push({ type: 'warning', message: Array.from(arguments).join(' ') });
            originalConsoleWarn.apply(console, arguments);
        };
        
        console.error = function() {
            logs.push({ type: 'error', message: Array.from(arguments).join(' ') });
            originalConsoleError.apply(console, arguments);
        };

        try {
            // Generate subtitles
            await generateRoundedSubtitles(
                srtFile.path,
                videoFile ? videoFile.path : null,
                outputFile,
                config
            );

            // Create preview video with subtitles if video was uploaded
            let previewUrl = null;
            if (videoFile) {
                logs.push({ type: 'info', message: 'Creating preview video with subtitles...' });
                
                try {
                    // Ensure the output directory exists
                    fs.ensureDirSync(path.dirname(previewVideoFile));
                    
                    // Check if output file already exists and remove it
                    if (fs.existsSync(previewVideoFile)) {
                        fs.unlinkSync(previewVideoFile);
                        logs.push({ type: 'info', message: 'Removed existing preview file' });
                    }
                    
                    // Add a small delay and verify the ASS file exists and is accessible before proceeding
                    await new Promise((resolve, reject) => {
                        // Check every 100ms for up to 2 seconds if the file exists and is accessible
                        let attempts = 0;
                        const maxAttempts = 20;
                        
                        const checkFile = () => {
                            attempts++;
                            try {
                                if (fs.existsSync(outputFile)) {
                                    // Try to read the file to ensure it's not locked
                                    fs.accessSync(outputFile, fs.constants.R_OK);
                                    const stats = fs.statSync(outputFile);
                                    logs.push({ type: 'info', message: `ASS file ready (${stats.size} bytes)` });
                                    resolve();
                                } else if (attempts < maxAttempts) {
                                    logs.push({ type: 'info', message: `Waiting for ASS file to be ready (attempt ${attempts}/${maxAttempts})` });
                                    setTimeout(checkFile, 100);
                                } else {
                                    reject(new Error('ASS file not available after timeout'));
                                }
                            } catch (err) {
                                if (attempts < maxAttempts) {
                                    logs.push({ type: 'info', message: `File exists but not accessible yet, retrying (attempt ${attempts}/${maxAttempts})` });
                                    setTimeout(checkFile, 100);
                                } else {
                                    reject(new Error(`ASS file exists but not accessible: ${err.message}`));
                                }
                            }
                        };
                        
                        // Start checking
                        checkFile();
                    });
                    
                    // Validate the ASS file content
                    const isAssValid = await validateAssFile(outputFile, logs);
                    if (!isAssValid) {
                        logs.push({ type: 'error', message: 'ASS file validation failed, but attempting FFmpeg anyway' });
                    }
                    
                    // Use FFmpeg to create a preview video with the subtitles
                    const ffmpegCmd = `ffmpeg -y -i "${videoFile.path}" -t 10 -vf "ass=${outputFile}" -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 128k "${previewVideoFile}"`;
                    logs.push({ type: 'info', message: `Executing FFmpeg command: ${ffmpegCmd}` });
                    
                    // Log the user's environment variables that might be relevant
                    logs.push({ type: 'info', message: `PATH: ${process.env.PATH}` });
                    logs.push({ type: 'info', message: `Working directory: ${process.cwd()}` });
                    
                    // Log information about the files to help with debugging
                    logs.push({ type: 'info', message: `Input video file: ${videoFile.path} (${fs.existsSync(videoFile.path) ? 'exists' : 'missing'})`});
                    logs.push({ type: 'info', message: `ASS subtitle file: ${outputFile} (${fs.existsSync(outputFile) ? 'exists' : 'missing'})`});
                    logs.push({ type: 'info', message: `Output preview file: ${previewVideoFile}`});
                    
                    // Function to run FFmpeg with retry capability
                    const runFfmpegWithRetry = async (maxRetries = 2) => {
                        let attempt = 0;
                        
                        while (attempt <= maxRetries) {
                            attempt++;
                            
                            if (attempt > 1) {
                                logs.push({ type: 'info', message: `Retry attempt ${attempt-1} of ${maxRetries}` });
                                // Add a small delay before retrying
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                            
                            try {
                                // Make sure paths are properly escaped
                                const assPath = outputFile.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                                
                                logs.push({ type: 'info', message: `Starting FFmpeg (attempt ${attempt}/${maxRetries+1})` });
                                
                                // Use spawn instead of exec for better control and output handling
                                const ffmpeg = spawn('ffmpeg', [
                                    '-y',
                                    '-i', videoFile.path,
                                    '-t', '10',
                                    '-vf', `ass=${assPath}`,
                                    '-c:v', 'libx264',
                                    '-preset', 'fast',
                                    '-crf', '22',
                                    '-c:a', 'aac',
                                    '-b:a', '128k',
                                    previewVideoFile
                                ]);
                                
                                logs.push({ type: 'info', message: `FFmpeg process started with PID: ${ffmpeg.pid}` });
                                
                                let stdoutData = '';
                                let stderrData = '';
                                
                                ffmpeg.stdout.on('data', (data) => {
                                    stdoutData += data.toString();
                                    logs.push({ type: 'info', message: `FFmpeg stdout: ${data.toString().trim()}` });
                                });
                                
                                ffmpeg.stderr.on('data', (data) => {
                                    stderrData += data.toString();
                                    logs.push({ type: 'info', message: `FFmpeg stderr: ${data.toString().trim()}` });
                                });
                                
                                // Wait for the process to complete
                                await new Promise((resolve, reject) => {
                                    ffmpeg.on('close', (code) => {
                                        if (code === 0) {
                                            logs.push({ type: 'success', message: `FFmpeg process exited with code ${code}` });
                                            resolve();
                                        } else {
                                            logs.push({ type: 'error', message: `FFmpeg process exited with code ${code}` });
                                            
                                            // Log more detailed error information
                                            if (stderrData) {
                                                const errorLines = stderrData.split('\n').filter(line => 
                                                    line.includes('Error') || 
                                                    line.includes('error') || 
                                                    line.includes('failed') ||
                                                    line.includes('No such file')
                                                );
                                                
                                                if (errorLines.length > 0) {
                                                    logs.push({ type: 'error', message: `FFmpeg key errors: ${errorLines.join('\n')}` });
                                                }
                                            }
                                            
                                            // Check if the output file was created despite the error
                                            if (fs.existsSync(previewVideoFile)) {
                                                const stats = fs.statSync(previewVideoFile);
                                                logs.push({ 
                                                    type: 'warning', 
                                                    message: `Output file exists (${stats.size} bytes) despite FFmpeg error` 
                                                });
                                            }
                                            
                                            reject(new Error(`FFmpeg exited with code ${code}\n${stderrData}`));
                                        }
                                    });
                                    
                                    ffmpeg.on('error', (err) => {
                                        logs.push({ type: 'error', message: `FFmpeg process error: ${err.message}` });
                                        
                                        // Check if the error might be due to FFmpeg not being installed
                                        if (err.code === 'ENOENT') {
                                            logs.push({ 
                                                type: 'error', 
                                                message: 'FFmpeg executable not found. Please ensure FFmpeg is installed and available in your PATH.' 
                                            });
                                        }
                                        
                                        reject(err);
                                    });
                                });
                                
                                // If we reached here, FFmpeg was successful
                                return true;
                                
                            } catch (error) {
                                // If this is not the last attempt, log the error but continue to the next attempt
                                if (attempt <= maxRetries) {
                                    logs.push({ 
                                        type: 'warning', 
                                        message: `FFmpeg attempt ${attempt} failed: ${error.message}. Will retry...` 
                                    });
                                } else {
                                    // Last attempt failed, rethrow the error
                                    logs.push({ 
                                        type: 'error', 
                                        message: `All FFmpeg attempts failed. Last error: ${error.message}` 
                                    });
                                    throw error;
                                }
                            }
                        }
                    };
                    
                    // Run FFmpeg with retry
                    try {
                        await runFfmpegWithRetry();
                    } catch (spawnError) {
                        logs.push({ type: 'error', message: `Error running FFmpeg after retries: ${spawnError.message}` });
                        
                        // Try to get more context on why it failed
                        if (spawnError.code) {
                            logs.push({ type: 'error', message: `Error code: ${spawnError.code}` });
                        }
                        
                        if (spawnError.path) {
                            logs.push({ type: 'error', message: `Path attempted: ${spawnError.path}` });
                        }
                        
                        throw spawnError;
                    }
                    
                    // Verify the preview file was created
                    if (fs.existsSync(previewVideoFile)) {
                        const stats = fs.statSync(previewVideoFile);
                        if (stats.size > 0) {
                            previewUrl = `/generated/${path.basename(previewVideoFile)}`;
                            logs.push({ type: 'success', message: `Preview video created successfully (${stats.size} bytes)` });
                            logs.push({ type: 'info', message: `Preview URL: ${previewUrl}` });
                        } else {
                            logs.push({ type: 'error', message: 'Preview video file was created but is empty' });
                        }
                    } else {
                        logs.push({ type: 'error', message: 'Preview video file was not created by FFmpeg' });
                    }
                } catch (ffmpegError) {
                    logs.push({ type: 'error', message: `Error creating preview video: ${ffmpegError.message}` });
                    if (ffmpegError.stderr) {
                        logs.push({ type: 'error', message: `FFmpeg stderr: ${ffmpegError.stderr}` });
                    }
                    console.error('FFmpeg error:', ffmpegError);
                }
            } else {
                logs.push({ type: 'info', message: 'No video file provided for preview' });
            }

            // Restore console methods
            console.log = originalConsoleLog;
            console.warn = originalConsoleWarn;
            console.error = originalConsoleError;

            // Return the path to the generated file, preview URL, and logs
            res.json({
                success: true,
                message: 'Subtitles generated successfully',
                outputFile: path.basename(outputFile),
                downloadUrl: `/download/${path.basename(outputFile)}`,
                previewUrl: previewUrl,
                logs
            });
        } catch (error) {
            // Restore console methods
            console.log = originalConsoleLog;
            console.warn = originalConsoleWarn;
            console.error = originalConsoleError;
            throw error;
        }
    } catch (error) {
        console.error('Error generating subtitles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Handle file downloads
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'generated', req.params.filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath);
});

// Test FFmpeg command endpoint
app.post('/test-ffmpeg', express.json(), async (req, res) => {
    try {
        const { command } = req.body;
        
        if (!command) {
            return res.status(400).json({ success: false, error: 'No command provided' });
        }
        
        // Security check - only allow ffmpeg commands
        if (!command.trim().startsWith('ffmpeg')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Only FFmpeg commands are allowed for security reasons' 
            });
        }
        
        console.log(`Executing test FFmpeg command: ${command}`);
        
        // Execute the command
        const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
        
        // Return the results
        res.json({
            success: true,
            stdout,
            stderr,
            environment: {
                path: process.env.PATH,
                workingDirectory: process.cwd(),
                platform: process.platform,
                nodeVersion: process.version
            }
        });
    } catch (error) {
        console.error('Error testing FFmpeg command:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr,
            stdout: error.stdout
        });
    }
});

// Clean up uploaded and generated files periodically (every hour)
setInterval(() => {
    try {
        const uploadDir = path.join(__dirname, 'uploads');
        const generatedDir = path.join(__dirname, 'generated');
        
        // Delete files older than 1 hour
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        [uploadDir, generatedDir].forEach(dir => {
            if (fs.existsSync(dir)) {
                fs.readdirSync(dir).forEach(file => {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime.getTime() < oneHourAgo) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted old file: ${filePath}`);
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error cleaning up files:', error);
    }
}, 60 * 60 * 1000); // Run every hour

// Start the server
app.listen(port, () => {
    console.log(`RoundedJS Web UI server running on port ${port}`);
    console.log(`Open http://localhost:${port} in your browser`);
    
    // Create necessary directories
    fs.ensureDirSync(path.join(__dirname, 'uploads'));
    fs.ensureDirSync(path.join(__dirname, 'generated'));
}); 