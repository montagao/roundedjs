/**
 * @file measure_example.c
 * @brief Example program demonstrating the use of ass-measure library
 */

#include "../include/ass_measure.h"
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    // Check command-line arguments
    if (argc != 4) {
        fprintf(stderr, "Usage: %s <subtitle.ass> <video_width> <video_height>\n", argv[0]);
        return 1;
    }
    
    const char *ass_filepath = argv[1];
    int video_width = atoi(argv[2]);
    int video_height = atoi(argv[3]);
    
    // Validate parameters
    if (video_width <= 0 || video_height <= 0) {
        fprintf(stderr, "Error: Video dimensions must be positive integers\n");
        return 1;
    }
    
    printf("Measuring subtitle dimensions for: %s\n", ass_filepath);
    printf("Video dimensions: %d x %d pixels\n\n", video_width, video_height);
    
    // Measure subtitle dimensions
    SubtitleRenderInfo info = measure_subtitle_dimensions(ass_filepath, video_width, video_height);
    
    // Check if measurement was successful
    if (info.count == 0 || info.lines == NULL) {
        fprintf(stderr, "Error: Failed to measure subtitle dimensions\n");
        return 1;
    }
    
    // Print the results
    printf("Found %zu subtitle lines:\n\n", info.count);
    
    for (size_t i = 0; i < info.count; i++) {
        SubtitleLineInfo *line = &info.lines[i];
        
        printf("Line %zu:\n", i + 1);
        printf("  Time: %lld ms -> %lld ms\n", line->start_time, line->end_time);
        printf("  Text: \"%s\"\n", line->text);
        printf("  Dimensions: %d x %d pixels\n\n", 
               line->dimensions.width, 
               line->dimensions.height);
    }
    
    // Free resources
    free_subtitle_render_info(info);
    
    return 0;
} 