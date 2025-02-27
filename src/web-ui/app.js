document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const srtFileInput = document.getElementById('srt-file-input');
    const srtDropArea = document.getElementById('srt-drop-area');
    const srtFileInfo = document.getElementById('srt-file-info');
    
    const videoFileInput = document.getElementById('video-file-input');
    const videoDropArea = document.getElementById('video-drop-area');
    const videoFileInfo = document.getElementById('video-file-info');
    
    const configForm = document.getElementById('config-form');
    const generateBtn = document.getElementById('generate-btn');
    const logOutput = document.getElementById('log-output');
    const clearLogBtn = document.getElementById('clear-log-btn');
    const downloadContainer = document.getElementById('download-container');
    const videoPreviewContainer = document.getElementById('video-preview-container');
    const videoPlayerWrapper = document.getElementById('video-player-wrapper');
    const videoPlayer = document.getElementById('video-player');
    
    // FFmpeg debug elements
    const testFfmpegBtn = document.getElementById('test-ffmpeg-btn');
    const ffmpegCmdInput = document.getElementById('ffmpeg-cmd');
    const ffmpegOutput = document.getElementById('ffmpeg-output');
    
    // Track uploaded files
    let srtFile = null;
    let videoFile = null;
    
    // Opacity slider value display
    const opacitySlider = document.getElementById('opacity');
    const opacityValue = document.getElementById('opacity-value');
    
    opacitySlider.addEventListener('input', function() {
        opacityValue.textContent = this.value;
    });
    
    // Handle panel collapsing and icon rotation
    document.querySelectorAll('.panel-header').forEach(header => {
        const targetId = header.getAttribute('data-bs-target');
        const panel = document.querySelector(targetId);
        
        // Listen for Bootstrap's collapse events instead of using our own click handler
        if (panel) {
            panel.addEventListener('show.bs.collapse', function() {
                const icon = header.querySelector('.bi-chevron-down, .bi-chevron-up');
                if (icon) {
                    icon.classList.remove('bi-chevron-down');
                    icon.classList.add('bi-chevron-up');
                }
            });
            
            panel.addEventListener('hide.bs.collapse', function() {
                const icon = header.querySelector('.bi-chevron-down, .bi-chevron-up');
                if (icon) {
                    icon.classList.remove('bi-chevron-up');
                    icon.classList.add('bi-chevron-down');
                }
            });
        }
    });
    
    // FFmpeg test functionality
    if (testFfmpegBtn) {
        testFfmpegBtn.addEventListener('click', async function() {
            try {
                testFfmpegBtn.disabled = true;
                testFfmpegBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Running...';
                ffmpegOutput.textContent = 'Executing command...';
                
                const command = ffmpegCmdInput.value.trim();
                
                const response = await fetch('/test-ffmpeg', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ command })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    let output = '';
                    
                    output += `Environment Info:\n`;
                    output += `  Working Directory: ${result.environment.workingDirectory}\n`;
                    output += `  PATH: ${result.environment.path}\n`;
                    output += `  Platform: ${result.environment.platform}\n`;
                    output += `  Node Version: ${result.environment.nodeVersion}\n\n`;
                    
                    if (result.stdout) {
                        output += `STDOUT:\n${result.stdout}\n\n`;
                    }
                    
                    if (result.stderr) {
                        output += `STDERR:\n${result.stderr}`;
                    }
                    
                    ffmpegOutput.textContent = output;
                    
                    // Also log to the main log
                    logMessage('FFmpeg test command executed successfully', 'success');
                } else {
                    ffmpegOutput.textContent = `Error: ${result.error}\n\n`;
                    
                    if (result.stderr) {
                        ffmpegOutput.textContent += `STDERR:\n${result.stderr}\n\n`;
                    }
                    
                    if (result.stdout) {
                        ffmpegOutput.textContent += `STDOUT:\n${result.stdout}`;
                    }
                    
                    // Also log to the main log
                    logMessage(`FFmpeg test command failed: ${result.error}`, 'error');
                }
            } catch (error) {
                ffmpegOutput.textContent = `Client Error: ${error.message}`;
                logMessage(`FFmpeg test error: ${error.message}`, 'error');
            } finally {
                testFfmpegBtn.disabled = false;
                testFfmpegBtn.textContent = 'Run Test';
            }
        });
    }
    
    // Setup file input handlers (drag and drop disabled as requested)
    function setupFileInput(dropArea, fileInput, fileInfoElement, fileType) {
        // Handle file selection via input
        fileInput.addEventListener('change', function() {
            handleFileSelect(fileInput, fileInfoElement, fileType);
        });
        
        // Handle click on drop area - open file selector
        dropArea.addEventListener('click', function() {
            fileInput.click();
        });
        
        // Add a clear button to remove the selected file
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.className = 'btn btn-sm btn-outline-secondary mt-2';
        clearBtn.style.display = 'none'; // Hide initially
        dropArea.appendChild(clearBtn);
        
        clearBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent triggering the dropArea click event
            fileInfoElement.innerHTML = '';
            if (fileType === 'srt') {
                srtFile = null;
                localStorage.removeItem('srtFileInfo');
            } else {
                videoFile = null;
                localStorage.removeItem('videoFileInfo');
            }
            fileInput.value = ''; // Clear the file input
            this.style.display = 'none';
            logMessage(`${fileType.toUpperCase()} file cleared`, 'info');
        });
        
        // Show/hide clear button when file is selected/cleared
        const observer = new MutationObserver(function() {
            clearBtn.style.display = fileInfoElement.innerHTML ? 'block' : 'none';
        });
        observer.observe(fileInfoElement, { childList: true, subtree: true });
    }
    
    // Keep these functions for use in other parts of the code, but they're no longer used for drag and drop
    function highlight(element) {
        element.classList.add('highlight');
    }
    
    function unhighlight(element) {
        element.classList.remove('highlight');
    }
    
    function handleFileSelect(fileInput, fileInfoElement, fileType) {
        if (fileInput.files.length) {
            const file = fileInput.files[0];
            
            if (fileType === 'srt' && !file.name.toLowerCase().endsWith('.srt')) {
                logMessage('Please select a valid .srt file', 'error');
                fileInfoElement.innerHTML = '';
                srtFile = null;
                localStorage.removeItem('srtFileInfo');
                return;
            }
            
            if (fileType === 'video' && !file.type.startsWith('video/')) {
                logMessage('Please select a valid video file', 'error');
                fileInfoElement.innerHTML = '';
                videoFile = null;
                localStorage.removeItem('videoFileInfo');
                return;
            }
            
            const fileSize = formatFileSize(file.size);
            fileInfoElement.innerHTML = `<strong>${file.name}</strong> (${fileSize})`;
            
            if (fileType === 'srt') {
                srtFile = file;
                // Save file info to localStorage (not the file itself, just the info)
                localStorage.setItem('srtFileInfo', JSON.stringify({
                    name: file.name,
                    size: fileSize,
                    lastModified: file.lastModified
                }));
                logMessage(`SRT file loaded: ${file.name}`, 'info');
            } else {
                videoFile = file;
                // Save file info to localStorage
                localStorage.setItem('videoFileInfo', JSON.stringify({
                    name: file.name,
                    size: fileSize,
                    lastModified: file.lastModified
                }));
                logMessage(`Video file loaded: ${file.name}`, 'info');
            }
            
            // Save form data when a file is selected
            saveFormData();
        }
    }
    
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }
    
    // Log message to the output container
    function logMessage(message, type = '') {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry${type ? ' log-' + type : ''}`;
        logEntry.textContent = message;
        logOutput.appendChild(logEntry);
        
        // Auto-scroll to bottom
        logOutput.scrollTop = logOutput.scrollHeight;
    }
    
    // Clear log
    clearLogBtn.addEventListener('click', function() {
        logOutput.innerHTML = '<div class="log-entry">Log cleared</div>';
    });
    
    // Setup file inputs (no drag and drop)
    setupFileInput(srtDropArea, srtFileInput, srtFileInfo, 'srt');
    setupFileInput(videoDropArea, videoFileInput, videoFileInfo, 'video');
    
    // Save form data to localStorage
    function saveFormData() {
        const formData = getFormData();
        localStorage.setItem('configFormData', JSON.stringify(formData));
    }
    
    // Load form data from localStorage
    function loadFormData() {
        const savedData = localStorage.getItem('configFormData');
        if (savedData) {
            const formData = JSON.parse(savedData);
            
            // Apply saved values to form fields
            document.getElementById('font').value = formData.font || 'Arial';
            document.getElementById('font-size').value = formData.fontSize || 48;
            document.getElementById('text-color').value = formData.textColor || 'FFFFFF';
            document.getElementById('bg-color').value = formData.bgColor || '000000';
            document.getElementById('opacity').value = formData.opacity || 80;
            document.getElementById('opacity-value').textContent = formData.opacity || 80;
            document.getElementById('radius').value = formData.radius || 10;
            document.getElementById('padding-x').value = formData.paddingX || 20;
            document.getElementById('padding-y').value = formData.paddingY || 10;
            document.getElementById('margin-bottom').value = formData.marginBottom || 50;
            document.getElementById('width-ratio').value = formData.widthRatio || 1.0;
            document.getElementById('disable-canvas').checked = formData.disableCanvas || false;
            document.getElementById('verbose').checked = formData.verbose || false;
            
            logMessage('Loaded saved configuration', 'info');
        }
    }
    
    // Display cached file info if available
    function loadSavedFileInfo() {
        const srtInfo = localStorage.getItem('srtFileInfo');
        const videoInfo = localStorage.getItem('videoFileInfo');
        
        if (srtInfo) {
            const info = JSON.parse(srtInfo);
            srtFileInfo.innerHTML = `<strong>${info.name}</strong> (${info.size})`;
            logMessage(`Cached SRT file info: ${info.name}`, 'info');
            // Note: actual file data is not cached, only info
        }
        
        if (videoInfo) {
            const info = JSON.parse(videoInfo);
            videoFileInfo.innerHTML = `<strong>${info.name}</strong> (${info.size})`;
            logMessage(`Cached video file info: ${info.name}`, 'info');
            // Note: actual file data is not cached, only info
        }
    }
    
    // Save form data when any form field changes
    configForm.addEventListener('change', saveFormData);
    
    // Initialize with saved data
    loadFormData();
    loadSavedFileInfo();
    
    // Generate subtitles
    generateBtn.addEventListener('click', async function() {
        if (!srtFile) {
            logMessage('Please upload an SRT file first', 'error');
            return;
        }
        
        // Save form data before generating
        saveFormData();
        
        try {
            // Disable the button during processing
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
            
            // Reset video preview
            resetVideoPreview();
            
            logMessage('Starting subtitle generation...', 'info');
            
            // Read the files
            const srtContent = await readFileAsText(srtFile);
            
            // Get form data
            const formData = getFormData();
            logConfig(formData);
            
            // Process the subtitles
            // Note: Since we're in the browser environment, we need to implement
            // a modified version of the subtitle processing logic here
            const result = await processSubtitles(srtContent, videoFile, formData);
            
            // Create download button
            createDownloadButton(result.assContent, `${srtFile.name.replace('.srt', '')}.ass`);
            
            // Display video preview if available
            if (result.previewUrl) {
                displayVideoPreview(result.previewUrl);
            }
            
            logMessage('Subtitle generation completed successfully!', 'success');
        } catch (error) {
            logMessage(`Error: ${error.message}`, 'error');
            console.error(error);
        } finally {
            // Re-enable the button
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Subtitles';
        }
    });
    
    // Get form data function (existing)
    function getFormData() {
        return {
            font: document.getElementById('font').value,
            fontSize: parseInt(document.getElementById('font-size').value),
            textColor: document.getElementById('text-color').value,
            bgColor: document.getElementById('bg-color').value,
            opacity: parseInt(document.getElementById('opacity').value),
            radius: parseInt(document.getElementById('radius').value),
            paddingX: parseInt(document.getElementById('padding-x').value),
            paddingY: parseInt(document.getElementById('padding-y').value),
            marginBottom: parseInt(document.getElementById('margin-bottom').value),
            widthRatio: parseFloat(document.getElementById('width-ratio').value),
            disableCanvas: document.getElementById('disable-canvas').checked,
            verbose: document.getElementById('verbose').checked
        };
    }
    
    // Log configuration
    function logConfig(config) {
        logMessage('Configuration:', 'info');
        logMessage(`- Font: ${config.font}, Size: ${config.fontSize}px`, 'info');
        logMessage(`- Text Color: #${config.textColor}`, 'info');
        logMessage(`- Background Color: #${config.bgColor}, Opacity: ${config.opacity}/255`, 'info');
        logMessage(`- Padding: ${config.paddingX}px horizontal, ${config.paddingY}px vertical`, 'info');
        logMessage(`- Radius: ${config.radius}px`, 'info');
        logMessage(`- Width ratio: ${config.widthRatio}`, 'info');
        logMessage(`- Bottom margin: ${config.marginBottom}px`, 'info');
        
        if (config.disableCanvas) {
            logMessage('- Canvas is disabled, using empirical width calculation', 'info');
        }
        
        if (config.verbose) {
            logMessage('- Verbose logging enabled', 'info');
        }
    }
    
    // Read file as text
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    
    // Create download button
    function createDownloadButton(content, filename) {
        // Clear previous downloads
        downloadContainer.innerHTML = '';
        
        // Create a Blob with the content
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Create download button
        const downloadBtn = document.createElement('a');
        downloadBtn.href = url;
        downloadBtn.download = filename;
        downloadBtn.className = 'btn btn-success d-block mx-auto';
        downloadBtn.innerHTML = '<i class="bi bi-download me-2"></i> Download ASS Subtitle File';
        
        downloadContainer.appendChild(downloadBtn);
        
        // Auto-cleanup the created URL
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    
    // Reset video preview
    function resetVideoPreview() {
        videoPlayerWrapper.style.display = 'none';
        videoPlayer.src = '';
        
        // Show placeholder message
        const placeholder = videoPreviewContainer.querySelector('.video-placeholder');
        if (placeholder) {
            placeholder.style.display = 'block';
        } else {
            const newPlaceholder = document.createElement('p');
            newPlaceholder.className = 'video-placeholder';
            newPlaceholder.textContent = 'Generate subtitles to preview the video with ASS subtitles';
            videoPreviewContainer.appendChild(newPlaceholder);
        }
    }
    
    // Display video preview
    function displayVideoPreview(videoUrl) {
        if (!videoUrl) {
            logMessage('Cannot display video preview: No valid URL provided', 'error');
            return;
        }
        
        logMessage(`Attempting to display video preview from: ${videoUrl}`, 'info');
        
        // Hide placeholder
        const placeholder = videoPreviewContainer.querySelector('.video-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        // Set video source and show player
        videoPlayer.src = videoUrl;
        videoPlayerWrapper.style.display = 'block';
        
        // Add event listeners for debugging
        videoPlayer.addEventListener('error', function(e) {
            logMessage(`Video error: ${videoPlayer.error?.message || 'Unknown error'}`, 'error');
        });
        
        videoPlayer.addEventListener('loadeddata', function() {
            logMessage('Video loaded successfully', 'success');
        });
        
        // Scroll to video section
        videoPreviewContainer.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Process subtitles
    async function processSubtitles(srtContent, videoFile, config) {
        // For client-side processing, we'll send the data to the server
        const formData = new FormData();
        formData.append('srtFile', srtFile);
        if (videoFile) formData.append('videoFile', videoFile);
        
        // Add all configuration options
        Object.keys(config).forEach(key => {
            formData.append(key, config[key]);
        });
        
        // Send the request to the server
        const response = await fetch('/generate', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to generate subtitles');
        }
        
        // Log all messages from the server
        if (result.logs) {
            result.logs.forEach(logEntry => {
                logMessage(logEntry.message, logEntry.type);
            });
        }
        
        // Log preview URL information for debugging
        if (result.previewUrl) {
            logMessage(`Preview URL received: ${result.previewUrl}`, 'info');
        } else {
            logMessage('No preview URL was received from the server', 'warning');
        }
        
        return {
            assContent: await fetchAssContent(result.downloadUrl),
            downloadUrl: result.downloadUrl,
            previewUrl: result.previewUrl
        };
    }
    
    // Fetch ASS file content for download
    async function fetchAssContent(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            logMessage(`Error fetching ASS content: ${error.message}`, 'error');
            throw error;
        }
    }
    
    // Parse SRT content
    function parseSRT(content) {
        // Regular expression to match SRT entries
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
        
        // Fix timing to prevent flickering
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
    
    // Convert SRT time string to seconds
    function parseSrtTime(timeStr) {
        const timeComponents = timeStr.replace(',', '.').split(':');
        const hours = parseFloat(timeComponents[0]);
        const minutes = parseFloat(timeComponents[1]);
        const seconds = parseFloat(timeComponents[2]);
        
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    // Format seconds to ASS time format
    function formatAssTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
    }
    
    // Generate rounded rectangle drawing command
    function generateRoundedRectDrawing(halfWidth, halfHeight, borderRadius) {
        let drawing = '';
        
        if (borderRadius > 0 && borderRadius < Math.min(halfHeight, halfWidth)) {
            // Draw a rounded rectangle using bezier curves for corners
            drawing += `m ${-halfWidth + borderRadius} ${-halfHeight} `; // Starting point
            drawing += `l ${halfWidth - borderRadius} ${-halfHeight} `; // Top edge
            
            // Top-right corner with bezier
            drawing += `b ${halfWidth} ${-halfHeight} ${halfWidth} ${-halfHeight + borderRadius} ${halfWidth} ${-halfHeight + borderRadius} `;
            
            drawing += `l ${halfWidth} ${halfHeight - borderRadius} `; // Right edge
            
            // Bottom-right corner
            drawing += `b ${halfWidth} ${halfHeight} ${halfWidth - borderRadius} ${halfHeight} ${halfWidth - borderRadius} ${halfHeight} `;
            
            // Bottom edge
            drawing += `l ${-halfWidth + borderRadius} ${halfHeight} `;
            
            // Bottom-left corner
            drawing += `b ${-halfWidth} ${halfHeight} ${-halfWidth} ${halfHeight - borderRadius} ${-halfWidth} ${halfHeight - borderRadius} `;
            
            drawing += `l ${-halfWidth} ${-halfHeight + borderRadius} `; // Left edge
            
            // Top-left corner
            drawing += `b ${-halfWidth} ${-halfHeight} ${-halfWidth + borderRadius} ${-halfHeight} ${-halfWidth + borderRadius} ${-halfHeight} `;
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
    
    // Get video dimensions
    function getVideoDimensions(videoFile) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            video.onloadedmetadata = function() {
                URL.revokeObjectURL(video.src);
                resolve({
                    width: video.videoWidth,
                    height: video.videoHeight
                });
            };
            
            video.onerror = function() {
                URL.revokeObjectURL(video.src);
                reject(new Error('Failed to load video metadata'));
            };
            
            video.src = URL.createObjectURL(videoFile);
        });
    }
    
    // Simplified function to detect script (Latin, CJK, etc.)
    function detectScript(text) {
        // Very simplified detection - would need to be improved for production
        if (/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(text)) {
            return 'cjk';
        }
        if (/[\u0600-\u06FF]/.test(text)) {
            return 'arabic';
        }
        if (/[\u0590-\u05FF]/.test(text)) {
            return 'hebrew';
        }
        return 'latin';
    }
    
    // Simplified text dimension calculation for the browser
    function calculateTextDimensions(text, fontSize, fontName) {
        const script = detectScript(text);
        const lines = text.split('\\N');
        
        // Use rough estimation
        let charWidth;
        if (script === 'cjk') {
            charWidth = fontSize * 0.95; // CJK characters are nearly square
        } else if (script === 'arabic' || script === 'hebrew') {
            charWidth = fontSize * 0.55;
        } else {
            charWidth = fontSize * 0.48; // Latin and others
        }
        
        // Calculate width (max line width)
        let maxWidth = 0;
        for (const line of lines) {
            const lineWidth = line.length * charWidth;
            maxWidth = Math.max(maxWidth, lineWidth);
        }
        
        // Calculate height
        const lineHeight = fontSize * 1.2;
        const height = lines.length * lineHeight;
        
        return { width: maxWidth, height };
    }
    
    // Generate ASS content with rounded backgrounds
    function generateRoundedSubtitles(subtitles, videoWidth, videoHeight, options) {
        // Calculate font size based on video height
        const fontSize = options.fontSize || Math.floor(videoHeight / 20);
        
        // Determine predominant script from all subtitles
        const allText = subtitles.map(sub => sub.text).join(' ');
        const predominantScript = detectScript(allText);
        logMessage(`Detected predominant script: ${predominantScript}`, 'info');
        
        // Create ASS header
        let assContent = createAssHeader(
            videoWidth,
            videoHeight,
            predominantScript,
            options.font,
            fontSize,
            options.marginBottom,
            options.bgColor
        );
        
        // Generate event lines for each subtitle
        const events = [];
        
        for (let idx = 0; idx < subtitles.length; idx++) {
            const sub = subtitles[idx];
            const startTime = formatAssTime(sub.start);
            const endTime = formatAssTime(sub.end);
            
            // Calculate position
            const yPos = videoHeight - options.marginBottom;
            
            // Calculate box dimensions
            const { width: textWidth, height: textHeight } = calculateTextDimensions(
                sub.text,
                fontSize,
                options.font
            );
            
            // Add padding
            const boxWidth = textWidth + (options.paddingX * 2);
            const boxHeight = textHeight + (options.paddingY * 2);
            
            // Ensure box width doesn't exceed video width
            const maxWidth = videoWidth * 0.9;
            const finalBoxWidth = Math.min(boxWidth, maxWidth);
            
            // Half dimensions for drawing
            const halfWidth = finalBoxWidth / 2;
            const halfHeight = boxHeight / 2;
            
            // Background on layer 0
            const bgAlphaHex = options.opacity.toString(16).padStart(2, '0');
            let bg = `0,${startTime},${endTime},Box-BG,,0,0,0,,{\\pos(${videoWidth / 2},${yPos})\\bord0\\shad0\\1c&H${options.bgColor}\\1a&H${bgAlphaHex}\\p1}`;
            
            // Generate the rounded rectangle drawing
            bg += generateRoundedRectDrawing(halfWidth, halfHeight, options.radius);
            bg += "{\\p0}";
            
            // Text on layer 1
            const text = `1,${startTime},${endTime},Default,,0,0,0,,{\\an5\\pos(${videoWidth / 2},${yPos})\\bord0\\shad0}${sub.text}`;
            
            events.push("Dialogue: " + bg);
            events.push("Dialogue: " + text);
        }
        
        // Add events to ASS content
        assContent += events.join('\n') + '\n';
        
        return assContent;
    }
    
    // Create ASS header
    function createAssHeader(videoWidth, videoHeight, predominantScript, fontName, fontSize, marginBottom, bgColor) {
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
Style: Default,${fontName},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,10,10,${marginBottom},1
Style: Box-BG,${fontName},${fontSize / 2},&H00${bgColor},&H000000FF,&H00${bgColor},&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    }
}); 