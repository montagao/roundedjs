# RoundedJS

A Node.js tool for converting SRT subtitles to ASS format with stylish rounded backgrounds. RoundedJS is a JavaScript rewrite of the Python [RoundedSSA](https://github.com/montabogota/roundedass) subtitle processing system.

## Features

- Convert SRT subtitle files to ASS format with rounded rectangle backgrounds
- Calculate text dimensions for proper background sizing using Canvas or empirical estimation
- Support for various font styles and character width calculation
- Multi-script support including Latin, Cyrillic, Arabic, Hebrew, CJK, and more
- Configurable background color, opacity, corner radius, padding, and positioning
- Video dimensions detection for proper subtitle scaling

## Installation

### Prerequisites

- Node.js 14.0.0 or higher
- npm or yarn
- (Optional) FFmpeg/FFprobe for video dimension detection

### Global Installation

```bash
npm install -g roundedjs
```

### Local Installation

```bash
# Clone the repository
git clone https://github.com/your-username/roundedjs.git
cd roundedjs

# Install dependencies
npm install

# Link for development
npm link
```

## Usage

### Command-Line Interface

```bash
roundedjs [options] <srt-file> [video-file]
```

#### Arguments:

- `<srt-file>`: Input SRT subtitle file (required)
- `[video-file]`: Optional video file for dimensions detection

#### Options:

- `-o, --output <file>`: Output ASS file (defaults to input file with .ass extension)
- `-f, --font <name>`: Font name (default: Arial)
- `-s, --font-size <size>`: Font size in pixels (default: 48)
- `--text-color <color>`: Text color in hex without # (default: FFFFFF)
- `--bg-color <color>`: Background color in hex without # (default: 000000)
- `--opacity <value>`: Background opacity (0-255, where 0 is opaque, 255 is transparent)
- `--padding-x <pixels>`: Horizontal padding in pixels (default: 20)
- `--padding-y <pixels>`: Vertical padding in pixels (default: 10)
- `--radius <pixels>`: Corner radius in pixels (default: 10)
- `--width-ratio <ratio>`: Width adjustment ratio (default: 1.0)
- `--position <value>`: Vertical position ratio (0-1, default: 0.85)
- `--disable-canvas`: Disable Canvas and use empirical width calculation for consistency
- `--verbose`: Enable verbose logging for debugging
- `--node-info`: Display Node.js version and environment information
- `-h, --help`: Display help information
- `-V, --version`: Display version information

### Examples

Basic usage:
```bash
roundedjs subtitles.srt video.mp4
```

Customized styling:
```bash
roundedjs subtitles.srt video.mp4 --font "Arial" --font-size 42 --bg-color "1A1A1A" --opacity 32 --radius 15
```

Fixed position with custom dimensions:
```bash
roundedjs subtitles.srt --position 0.9 --padding-x 30 --padding-y 15
```

Using empirical width calculation for consistent results:
```bash
roundedjs subtitles.srt --disable-canvas
```

## API Usage

You can also use RoundedJS programmatically in your Node.js projects:

```javascript
const { generateRoundedSubtitles } = require('roundedjs/src/subtitle');

async function createSubtitles() {
  const options = {
    videoPath: 'video.mp4',
    font: 'Arial',
    fontSize: 48,
    textColor: 'FFFFFF',
    bgColor: '000000',
    alphaHex: '00',
    paddingX: 20,
    paddingY: 10,
    radius: 10,
    widthRatio: 1.0,
    basePositionY: 0.85
  };

  try {
    const outputPath = await generateRoundedSubtitles('subtitles.srt', 'output.ass', options);
    console.log(`Subtitles generated: ${outputPath}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

createSubtitles();
```

## How It Works

RoundedJS:

1. Parses the SRT subtitle file
2. Calculates text dimensions using Canvas or empirical estimation
3. Generates ASS subtitle file with drawing commands for rounded backgrounds
4. Positions text on the background with proper alignment
5. Handles various scripts and font styles

## License

MIT 