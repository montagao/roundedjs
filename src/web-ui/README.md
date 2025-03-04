# RoundedJS Web UI

This is the web-based user interface for RoundedJS, a Node.js tool for converting SRT subtitles to ASS format with stylish rounded backgrounds. The web UI provides an intuitive interface for users to upload subtitle files, configure style options, and generate rounded subtitles without using the command line.

## Architecture Overview

The web UI consists of the following core components:

1. **Server (`server.js`)**: Express.js backend that handles:
   - File uploads (using Multer)
   - Server-side subtitle processing
   - File validation
   - Providing generated ASS files for download
   - Video preview functionality

2. **Client Application (`app.js`)**: Frontend JavaScript that manages:
   - File uploads via drag-and-drop or file picker
   - Form configuration
   - UI state management
   - Client-side subtitle processing (browser-based preview)
   - Video playback with subtitles
   - Real-time logging

3. **User Interface (`index.html`, `styles.css`)**: Bootstrap-based responsive UI with:
   - File upload panels
   - Configuration options
   - Video preview panel
   - Real-time logs
   - Download section

4. **File Storage**:
   - `/uploads`: Temporary storage for uploaded SRT and video files
   - `/generated`: Storage for generated ASS subtitle files

## Key Features

- **Drag-and-drop interface** for SRT and video file uploads
- **Real-time subtitle preview** with video (when provided)
- **Comprehensive styling options**:
  - Font selection and sizing
  - Background color and opacity
  - Corner radius and padding
  - Vertical positioning
- **Client-side configuration persistence** using localStorage
- **Server-side subtitle generation** for maximum compatibility
- **Detailed processing logs** for debugging

## Setup and Development

### Prerequisites

- Node.js 14.0.0 or higher
- npm or yarn
- The main RoundedJS library

### Installation

1. Install dependencies from the project root:
   ```bash
   npm install
   ```

2. Start the web UI server:
   ```bash
   node src/web-ui/server.js
   ```

3. Access the web interface at http://localhost:3000

### Code Structure

#### Server-Side (`server.js`)

The Express server handles file uploads and processing:

- **Express routes**:
  - `POST /upload/srt`: Handles SRT file uploads
  - `POST /upload/video`: Handles video file uploads
  - `POST /generate`: Processes the SRT with provided configuration
  - `GET /download/:filename`: Serves generated ASS files
  - `GET /preview/:filename`: Serves video files for preview

- **Key functions**:
  - `validateAssFile()`: Validates generated ASS files
  - `cleanupFile()`: Manages temporary file deletion

#### Client-Side (`app.js`)

The frontend application manages the user interface:

- **UI Components**:
  - File upload handlers with drag-and-drop
  - Configuration form with live updates
  - Video preview with subtitle rendering
  - Log console for status updates

- **Key functions**:
  - `processSubtitles()`: Sends subtitle processing request to server
  - `parseSRT()`: Client-side SRT parsing for preview
  - `calculateTextDimensions()`: Estimates text dimensions for backgrounds
  - `generateRoundedSubtitles()`: Client-side ASS generation for preview

## Extension Points

When modifying the code, here are the main areas to focus on:

1. **Add new styling options**:
   - Update form fields in `index.html`
   - Add corresponding options in `getFormData()` in `app.js`
   - Pass new options to backend in the `/generate` endpoint

2. **Enhance subtitle rendering**:
   - Modify the `generateRoundedSubtitles()` function in `app.js`
   - Update the client-side preview rendering

3. **Add new file format support**:
   - Create new file upload handlers in `server.js`
   - Add format conversion logic
   - Update the UI to accommodate new formats

4. **Improve video preview**:
   - Enhance the video player controls
   - Modify subtitle rendering on the video

## API Endpoints

### POST /upload/srt
Uploads an SRT subtitle file.
- **Request**: Form data with `srtFile`
- **Response**: JSON with `filename` and `path`

### POST /upload/video
Uploads a video file.
- **Request**: Form data with `videoFile`
- **Response**: JSON with `filename` and `path`

### POST /generate
Generates ASS subtitles from uploaded SRT file.
- **Request**: JSON with configuration options
- **Response**: JSON with `success`, `assFilename`, and `logs`

### GET /download/:filename
Downloads generated ASS file.

### GET /preview/:filename
Serves video file for preview.

## Common Issues and Solutions

- **File Upload Errors**: Check file permissions in the uploads directory
- **Subtitle Generation Failures**: Verify SRT format is correct
- **Video Preview Issues**: Ensure video codec is supported by the browser
- **Style Differences**: Browser-rendered preview may differ slightly from actual ASS file

## Related Components

This web UI interfaces with the core RoundedJS library found in the parent directory:
- `../subtitle.js`: Core subtitle processing functionality
- `../config.js`: Configuration management 