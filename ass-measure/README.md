# ass-measure

A C-based library that measures the exact rendered dimensions (width and height in pixels) of subtitle lines in ASS files using libass.

## Overview

`ass-measure` takes an input ASS subtitle file and video dimensions, then predicts the exact rendered width and height of each subtitle line. This is useful for:

- Subtitle positioning and layout optimization
- Ensuring subtitles fit within designated screen areas
- Analyzing subtitle styling and formatting

The library uses libass directly to render each subtitle line and measure its bounding box.

## Dependencies

- [libass](https://github.com/libass/libass) - Library for ASS/SSA subtitle rendering
- pkg-config - For detecting libass installation
- C compiler (GCC or Clang)
- POSIX-compliant OS (Linux/macOS)

## Building

1. Make sure you have libass and pkg-config installed on your system:

   **Ubuntu/Debian:**
   ```bash
   sudo apt-get install libass-dev pkg-config
   ```

   **macOS (using Homebrew):**
   ```bash
   brew install libass pkg-config
   ```

   You can verify libass is properly installed by running:
   ```bash
   pkg-config --modversion libass
   ```
   This should output the installed version of libass.

2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/ass-measure.git
   cd ass-measure
   ```

3. Build the library and example:
   ```bash
   make
   ```

4. (Optional) Install the library system-wide:
   ```bash
   sudo make install
   ```

## Troubleshooting

### Header File Not Found

If you encounter an error like:
```
fatal error: 'ass/ass.h' file not found
```

This means either:
- libass is not installed
- pkg-config cannot find libass

Solutions:
1. Install libass development package as shown above
2. If you installed libass in a non-standard location, set the `PKG_CONFIG_PATH` environment variable:
   ```bash
   export PKG_CONFIG_PATH=/path/to/libass/pkgconfig:$PKG_CONFIG_PATH
   ```

### Linking Errors

If you encounter linking errors like undefined symbols for libass functions, make sure both the development headers and libraries are properly installed.

## Usage

### Example Code

```c
#include <ass_measure/ass_measure.h>
#include <stdio.h>

int main() {
    const char *ass_filepath = "subtitles.ass";
    int video_width = 1920;
    int video_height = 1080;
    
    // Measure subtitle dimensions
    SubtitleRenderInfo info = measure_subtitle_dimensions(
        ass_filepath, 
        video_width, 
        video_height
    );
    
    // Process the results
    for (size_t i = 0; i < info.count; i++) {
        printf("Line %zu: \"%s\"\n", i, info.lines[i].text);
        printf("Dimensions: %d x %d pixels\n\n", 
            info.lines[i].dimensions.width, 
            info.lines[i].dimensions.height);
    }
    
    // Free resources
    free_subtitle_render_info(info);
    
    return 0;
}
```

### Compiling Your Program

```bash
# Using pkg-config for proper linking
gcc your_program.c -o your_program -lass_measure $(pkg-config --libs libass)
```

### Running the Example

The provided example program measures dimensions for all subtitle lines in an ASS file:

```bash
./bin/measure_example subtitles.ass 1920 1080
```

## API Documentation

### Structures

#### `SubtitleDimensions`
Holds the width and height measurements of a subtitle.

```c
typedef struct {
    int width;      // Width in pixels
    int height;     // Height in pixels
} SubtitleDimensions;
```

#### `SubtitleLineInfo`
Contains information about a single subtitle line.

```c
typedef struct {
    char *text;                     // The text content of the subtitle
    SubtitleDimensions dimensions;  // The rendered dimensions
    long long start_time;           // Start time in milliseconds
    long long end_time;             // End time in milliseconds
} SubtitleLineInfo;
```

#### `SubtitleRenderInfo`
Contains information about all subtitle lines in an ASS file.

```c
typedef struct {
    SubtitleLineInfo *lines;        // Array of subtitle line information
    size_t count;                   // Number of subtitle lines
} SubtitleRenderInfo;
```

### Functions

#### `measure_subtitle_dimensions`
Measures the dimensions of all subtitle lines in an ASS file.

```c
SubtitleRenderInfo measure_subtitle_dimensions(
    const char *ass_filepath,
    int video_width,
    int video_height
);
```

Parameters:
- `ass_filepath`: Path to the ASS subtitle file
- `video_width`: Width of the video in pixels
- `video_height`: Height of the video in pixels

Returns:
- `SubtitleRenderInfo`: Structure containing information about all subtitle lines

#### `free_subtitle_render_info`
Frees resources allocated for SubtitleRenderInfo.

```c
void free_subtitle_render_info(SubtitleRenderInfo info);
```

Parameters:
- `info`: SubtitleRenderInfo structure to be freed

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [libass](https://github.com/libass/libass) - For providing the underlying subtitle rendering functionality 