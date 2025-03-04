document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const inputText = document.getElementById('inputText');
    const fontSelect = document.getElementById('fontSelect');
    const fontSize = document.getElementById('fontSize');
    const widthCorrection = document.getElementById('widthCorrection');
    const lineSpacing = document.getElementById('lineSpacing');
    const showBoundingBox = document.getElementById('showBoundingBox');
    const renderButton = document.getElementById('renderButton');
    const canvas = document.getElementById('debug-canvas');
    const ctx = canvas.getContext('2d');
    const measurementBox = document.getElementById('measurement-box');
    const widthLabel = document.getElementById('width-label');
    const heightLabel = document.getElementById('height-label');
    const dimensionInfo = document.getElementById('dimension-info');
    const detailedMetrics = document.getElementById('detailed-metrics');
    const fontInfo = document.getElementById('font-info');
    const galleryText = document.getElementById('galleryText');
    const refreshGallery = document.getElementById('refreshGallery');
    const fontGallery = document.getElementById('font-gallery');
    const serverText = document.getElementById('serverText');
    const serverFontSelect = document.getElementById('serverFontSelect');
    const serverFontSize = document.getElementById('serverFontSize');
    const showDebugInfo = document.getElementById('showDebugInfo');
    const renderServerButton = document.getElementById('renderServerButton');
    const serverRenderingLoader = document.getElementById('serverRenderingLoader');
    const serverRenderingResult = document.getElementById('serverRenderingResult');
    const serverInfo = document.getElementById('server-info');
    
    // Popular fonts to display in the gallery
    const popularFonts = [
        'Arial', 'Times New Roman', 'Courier New', 'Georgia', 
        'Verdana', 'Comic Sans MS', 'Impact', 'Tahoma', 
        'Trebuchet MS', 'Garamond', 'Palatino', 'Bookman', 
        'Helvetica', 'Calibri', 'Cambria', 'Consolas'
    ];
    
    // Initialize the canvas
    function initCanvas() {
        const pixelRatio = window.devicePixelRatio || 1;
        const width = canvas.clientWidth * pixelRatio;
        const height = canvas.clientHeight * pixelRatio;
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.scale(pixelRatio, pixelRatio);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        clearCanvas();
    }
    
    // Clear the canvas
    function clearCanvas() {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Reset measurement box
        measurementBox.style.display = 'none';
        widthLabel.style.display = 'none';
        heightLabel.style.display = 'none';
    }
    
    // Get text dimensions from backend
    async function getTextDimensionsFromBackend(text, fontSize, fontName, widthCorrection, lineSpacing, tightFit) {
        try {
            const response = await fetch('/api/font-dimensions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    fontSize,
                    fontName,
                    widthCorrection,
                    lineSpacing,
                    tightFit
                }),
            });
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Unknown error from server');
            }
            
            return {
                dimensions: data.dimensions,
                fontInfo: data.fontInfo
            };
        } catch (error) {
            console.error('Error fetching dimensions from backend:', error);
            // Fall back to frontend calculation
            return {
                dimensions: calculateTextDimensionsClient(text, fontSize, fontName, widthCorrection, lineSpacing, tightFit),
                fontInfo: {
                    category: getFontCategory(fontName),
                    factor: getFontFactor(fontName)
                }
            };
        }
    }
    
    // Render text on canvas
    async function renderText() {
        clearCanvas();
        
        const text = inputText.value;
        const font = fontSelect.value;
        const size = parseInt(fontSize.value);
        const correction = parseFloat(widthCorrection.value);
        const spacing = parseFloat(lineSpacing.value);
        
        // Show loading state
        dimensionInfo.textContent = 'Calculating dimensions...';
        
        // Get dimensions from backend
        const result = await getTextDimensionsFromBackend(
            text.replace(/\n/g, '\\N'), // Convert newlines to ASS format
            size,
            font,
            correction,
            spacing,
            true
        );
        
        const dimensions = result.dimensions;
        
        // Set font
        ctx.font = `${size}px "${font}"`;
        ctx.fillStyle = 'black';
        
        // Convert ASS newlines back to normal newlines for display
        const lines = text.split('\n');
        
        // Position for text rendering
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;
        const x = canvasWidth / 2;
        const y = canvasHeight / 2 - dimensions.height / 2 + size / 2;
        
        // Render text - each line with proper spacing
        let currentY = y;
        for (const line of lines) {
            ctx.fillText(line, x, currentY);
            currentY += size * spacing;
        }
        
        // Show bounding box if checked
        if (showBoundingBox.checked) {
            const boxX = x - dimensions.width / 2;
            const boxY = canvasHeight / 2 - dimensions.height / 2;
            
            // Draw bounding box on canvas for more accurate representation
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(boxX, boxY, dimensions.width, dimensions.height);
            ctx.setLineDash([]);
            
            // Absolute positioned element for exact pixel dimensions
            measurementBox.style.display = 'block';
            measurementBox.style.left = `${boxX}px`;
            measurementBox.style.top = `${boxY}px`;
            measurementBox.style.width = `${dimensions.width}px`;
            measurementBox.style.height = `${dimensions.height}px`;
            
            // Width label
            widthLabel.style.display = 'block';
            widthLabel.style.left = `${boxX + dimensions.width / 2 - 20}px`;
            widthLabel.style.top = `${boxY + dimensions.height + 5}px`;
            widthLabel.textContent = `${Math.round(dimensions.width)}px`;
            
            // Height label
            heightLabel.style.display = 'block';
            heightLabel.style.left = `${boxX + dimensions.width + 5}px`;
            heightLabel.style.top = `${boxY + dimensions.height / 2 - 10}px`;
            heightLabel.textContent = `${Math.round(dimensions.height)}px`;
        }
        
        // Update info displays
        dimensionInfo.textContent = `Width: ${dimensions.width.toFixed(2)}px, Height: ${dimensions.height.toFixed(2)}px`;
        updateDetailedMetrics(text, font, size, correction, spacing, dimensions);
        updateFontInfo(font, result.fontInfo);
    }
    
    // Update detailed metrics display
    function updateDetailedMetrics(text, font, size, correction, spacing, dimensions) {
        const charCount = text.replace(/\n/g, '').length; // Don't count newlines
        const charWidth = charCount > 0 ? dimensions.width / charCount : 0;
        const lines = text.split('\n');
        
        let metrics = `Text: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"\n`;
        metrics += `Font: ${font}, Size: ${size}px\n`;
        metrics += `Width Correction: ${correction}, Line Spacing: ${spacing}\n`;
        metrics += `----------------------------------------\n`;
        metrics += `Total Width: ${dimensions.width.toFixed(2)}px\n`;
        metrics += `Total Height: ${dimensions.height.toFixed(2)}px\n`;
        metrics += `Character Count: ${charCount}\n`;
        metrics += `Line Count: ${lines.length}\n`;
        metrics += `Average Character Width: ${charWidth.toFixed(2)}px\n`;
        metrics += `Width/Size Ratio: ${(dimensions.width / (size * charCount)).toFixed(3)}\n`;
        metrics += `Height/Size Ratio: ${(dimensions.height / (size * lines.length)).toFixed(3)}\n`;
        
        detailedMetrics.textContent = metrics;
    }
    
    // Update font information display
    function updateFontInfo(fontName, fontInfoData = null) {
        const category = fontInfoData ? fontInfoData.category : getFontCategory(fontName);
        const factor = fontInfoData ? fontInfoData.factor : getFontFactor(fontName);
        const script = detectScript(inputText.value);
        
        let info = `Font Name: ${fontName}\n`;
        info += `Category: ${category}\n`;
        info += `Width Factor: ${factor}\n`;
        
        if (fontInfoData) {
            if (fontInfoData.script) {
                info += `Script Override: ${fontInfoData.script}\n`;
            }
            info += `Source: Backend Font Library\n`;
        } else {
            info += `Source: Frontend Fallback\n`;
        }
        
        info += `----------------------------------------\n`;
        info += `Detected Script: ${script}\n`;
        info += `----------------------------------------\n`;
        
        // Font characteristic estimates
        info += 'Font Characteristics (estimates):\n';
        if (category === 'monospace') {
            info += '- Monospaced font (all characters have the same width)\n';
        } else {
            info += '- Proportional font (characters have variable widths)\n';
        }
        
        if (category === 'narrow') {
            info += '- Narrow/condensed character shapes\n';
        } else if (category === 'wide') {
            info += '- Wide/expanded character shapes\n';
        }
        
        fontInfo.textContent = info;
    }
    
    // Create font gallery
    async function createFontGallery() {
        fontGallery.innerHTML = '';
        const text = galleryText.value;
        
        // Create progress indicator
        const progress = document.createElement('div');
        progress.className = 'alert alert-info';
        progress.textContent = 'Loading font gallery...';
        fontGallery.appendChild(progress);
        
        // Process fonts in batches to avoid overwhelming the server
        const batchSize = 4;
        const batches = [];
        
        for (let i = 0; i < popularFonts.length; i += batchSize) {
            batches.push(popularFonts.slice(i, i + batchSize));
        }
        
        let completedFonts = 0;
        
        for (const batch of batches) {
            // Process each batch in parallel
            await Promise.all(batch.map(async (font) => {
                try {
                    const result = await getTextDimensionsFromBackend(
                        text, 16, font, 1.0, 1.2, true
                    );
                    
                    const col = document.createElement('div');
                    col.className = 'col-md-6 mb-3';
                    
                    const preview = document.createElement('div');
                    preview.className = 'font-preview';
                    
                    const heading = document.createElement('h6');
                    heading.textContent = `${font} (${result.fontInfo.category})`;
                    
                    const sample = document.createElement('p');
                    sample.style.fontFamily = font;
                    sample.style.fontSize = '16px';
                    sample.textContent = text;
                    
                    const metrics = document.createElement('small');
                    metrics.className = 'text-muted';
                    metrics.textContent = `Width: ${result.dimensions.width.toFixed(0)}px`;
                    
                    preview.appendChild(heading);
                    preview.appendChild(sample);
                    preview.appendChild(metrics);
                    col.appendChild(preview);
                    fontGallery.appendChild(col);
                    
                    // Update progress
                    completedFonts++;
                    progress.textContent = `Loading font gallery... ${completedFonts}/${popularFonts.length} complete`;
                    
                } catch (error) {
                    console.error(`Error processing font ${font}:`, error);
                }
            }));
        }
        
        // Remove progress indicator
        fontGallery.removeChild(progress);
    }
    
    // Detect script (simplified version)
    function detectScript(text) {
        // This is a simplified version - in production, use the full implementation from fonts.js
        const scripts = {
            latin: /[a-zA-Z]/,
            cyrillic: /[А-Яа-я]/,
            greek: /[Α-Ωα-ω]/,
            arabic: /[\u0600-\u06FF]/,
            hebrew: /[\u0590-\u05FF]/,
            cjk: /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/,
            thai: /[\u0E00-\u0E7F]/,
            devanagari: /[\u0900-\u097F]/
        };
        
        for (const [script, regex] of Object.entries(scripts)) {
            if (regex.test(text)) {
                return script;
            }
        }
        
        return 'latin'; // Default script
    }
    
    // The following functions are FALLBACKS only used if the backend request fails
    
    // Get font category (simplified version)
    function getFontCategory(fontName) {
        const fontCategories = {
            'Arial': 'default',
            'Helvetica': 'default',
            'Verdana': 'default',
            'Tahoma': 'default',
            'Calibri': 'default',
            
            'Times New Roman': 'narrow',
            'Georgia': 'narrow',
            'Garamond': 'narrow',
            'Cambria': 'narrow',
            'Palatino': 'narrow',
            
            'Comic Sans MS': 'wide',
            'Trebuchet MS': 'wide',
            'Segoe UI': 'wide',
            'Lucida Grande': 'wide',
            
            'Courier New': 'monospace',
            'Consolas': 'monospace',
            'Courier': 'monospace',
            'Monaco': 'monospace',
            'Menlo': 'monospace',
            'Lucida Console': 'monospace'
        };
        
        return fontCategories[fontName] || 'default';
    }
    
    // Get font factor (simplified version)
    function getFontFactor(fontName) {
        const fontFactors = {
            'Arial': 1.0,
            'Helvetica': 1.0,
            'Verdana': 1.05,
            'Tahoma': 1.0,
            'Calibri': 0.98,
            
            'Times New Roman': 0.95,
            'Georgia': 0.98,
            'Garamond': 0.93,
            'Cambria': 0.96,
            'Palatino': 0.97,
            
            'Comic Sans MS': 1.1,
            'Trebuchet MS': 1.05,
            'Segoe UI': 1.02,
            'Lucida Grande': 1.08,
            
            'Courier New': 1.0,
            'Consolas': 1.0,
            'Courier': 1.0,
            'Monaco': 1.0,
            'Menlo': 1.0,
            'Lucida Console': 1.0
        };
        
        return fontFactors[fontName] || 1.0;
    }
    
    // Calculate text dimensions (simplified version - FALLBACK)
    function calculateTextDimensionsClient(text, fontSize, fontName, widthCorrection, lineSpacing, tightFit) {
        // This is a simplified frontend version - in production, this would be calculated by the backend
        const lines = text.split('\\N');
        const script = detectScript(text);
        const fontCategory = getFontCategory(fontName);
        const fontFactor = getFontFactor(fontName);
        
        // Character width data by script and font category - INCREASED TO MATCH BROWSER RENDERING BETTER
        const widthData = {
            latin: {
                default: 0.65,  // Increased from 0.48
                narrow: 0.58,   // Increased from 0.42
                wide: 0.70,     // Increased from 0.53
                monospace: 0.75 // Increased from 0.60
            },
            cjk: {
                default: 1.0,   // Increased from 0.95
                narrow: 0.95,   // Increased from 0.85
                wide: 1.1,      // Increased from 1.0
                monospace: 1.0  // Increased from 0.95
            },
            other: {
                default: 0.70,  // Increased from 0.55
                narrow: 0.65,   // Increased from 0.50
                wide: 0.75,     // Increased from 0.60
                monospace: 0.75 // Increased from 0.60
            }
        };
        
        // Get width multiplier
        const scriptData = widthData[script] || widthData.other;
        const baseMultiplier = (scriptData[fontCategory] || scriptData.default) * fontFactor;
        
        // Calculate width
        let maxWidth = 0;
        for (const line of lines) {
            const lineWidth = line.length * baseMultiplier * fontSize;
            maxWidth = Math.max(maxWidth, lineWidth);
        }
        
        // Apply width correction
        maxWidth *= widthCorrection;
        
        // Calculate height
        let totalHeight = 0;
        for (let i = 0; i < lines.length; i++) {
            let lineHeight = fontSize;
            if (i < lines.length - 1) {
                lineHeight *= lineSpacing;
            }
            totalHeight += lineHeight;
        }
        
        // Browser rendering adjustment - add a small additional factor for better match with actual rendering
        maxWidth *= 1.05;
        
        return { width: maxWidth, height: totalHeight };
    }
    
    // Handle server-side rendering
    async function renderServerText() {
        try {
            // Show loading state
            serverRenderingLoader.style.display = 'block';
            serverRenderingResult.innerHTML = '';
            serverInfo.textContent = 'Generating server rendering...';
            
            // Get form values
            const text = serverText.value;
            const fontName = serverFontSelect.value;
            const fontSize = parseInt(serverFontSize.value);
            const debug = showDebugInfo.checked;
            
            console.log("Sending request to server for rendering:", {
                text, fontName, fontSize, showDebugInfo: debug
            });
            
            // Call server API
            const response = await fetch('/api/render-font', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    fontName,
                    fontSize,
                    showDebugInfo: debug
                }),
            });
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Unknown error from server');
            }
            
            console.log("Received server response:", data);
            
            // Display the rendered image
            const img = document.createElement('img');
            img.src = data.imageData;
            img.style.maxWidth = '100%';
            img.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.1)';
            img.alt = 'Server rendered text';
            img.style.backgroundColor = 'white';
            
            // Add load event handler
            img.onload = function() {
                console.log("Image loaded successfully with dimensions:", img.width, "x", img.height);
            };
            
            img.onerror = function() {
                console.error("Failed to load the image");
                serverRenderingResult.innerHTML = `
                    <div class="alert alert-danger">
                        Failed to load the rendered image. Check console for details.
                    </div>
                `;
            };
            
            serverRenderingResult.innerHTML = '';
            serverRenderingResult.appendChild(img);
            
            // Update info
            let info = `Text: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"\n`;
            info += `Font: ${fontName}, Size: ${fontSize}px\n`;
            info += `Rendered with node-canvas on server\n`;
            info += `----------------------------------------\n`;
            info += `Width: ${data.dimensions.width.toFixed(2)}px\n`;
            info += `Height: ${data.dimensions.height.toFixed(2)}px\n`;
            info += `Font Category: ${data.fontInfo.category}\n`;
            info += `Font Factor: ${data.fontInfo.factor}\n`;
            
            if (data.fontInfo.script) {
                info += `Script Override: ${data.fontInfo.script}\n`;
            }
            
            serverInfo.textContent = info;
        } catch (error) {
            console.error('Error rendering server text:', error);
            serverRenderingResult.innerHTML = `
                <div class="alert alert-danger">
                    Error: ${error.message}
                </div>
            `;
            serverInfo.textContent = `Error: ${error.message}`;
        } finally {
            serverRenderingLoader.style.display = 'none';
        }
    }
    
    // Event listeners
    renderButton.addEventListener('click', renderText);
    refreshGallery.addEventListener('click', createFontGallery);
    renderServerButton.addEventListener('click', renderServerText);
    
    // Auto-render when input changes (with debounce)
    let renderTimeout;
    const autoRenderInputs = [inputText, fontSelect, fontSize, widthCorrection, lineSpacing, showBoundingBox];
    
    autoRenderInputs.forEach(input => {
        input.addEventListener('input', function() {
            clearTimeout(renderTimeout);
            renderTimeout = setTimeout(renderText, 500);
        });
    });
    
    // Sync text areas between tabs
    serverText.value = inputText.value;
    inputText.addEventListener('input', () => {
        serverText.value = inputText.value;
    });
    serverText.addEventListener('input', () => {
        inputText.value = serverText.value;
    });
    
    // Sync font selects between tabs
    serverFontSelect.value = fontSelect.value;
    fontSelect.addEventListener('change', () => {
        serverFontSelect.value = fontSelect.value;
    });
    serverFontSelect.addEventListener('change', () => {
        fontSelect.value = serverFontSelect.value;
    });
    
    // Initialize
    initCanvas();
    //createFontGallery();
    renderText();
}); 