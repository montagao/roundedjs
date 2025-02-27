/**
 * Video utilities for getting video dimensions and properties.
 */

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

/**
 * Get video dimensions using ffprobe.
 * 
 * @param {string} videoFile - Path to the video file
 * @returns {Promise<Object>} - Promise resolving to {width, height}
 */
function getVideoDimensions(videoFile) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoFile, (err, metadata) => {
      if (err) {
        console.error(`Error getting video dimensions: ${err.message}`);
        // Default dimensions if ffprobe fails
        resolve({ width: 1920, height: 1080 });
        return;
      }

      try {
        // Find the video stream
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        
        if (videoStream) {
          const width = parseInt(videoStream.width);
          const height = parseInt(videoStream.height);
          
          if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
            resolve({ width, height });
            return;
          }
        }
        
        // If no valid dimensions found, use defaults
        console.warn('Could not determine video dimensions, using defaults.');
        resolve({ width: 1920, height: 1080 });
      } catch (error) {
        console.error(`Error parsing video metadata: ${error.message}`);
        resolve({ width: 1920, height: 1080 });
      }
    });
  });
}

module.exports = {
  getVideoDimensions
}; 