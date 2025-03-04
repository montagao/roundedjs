/**
 * @file ass_measure.c
 * @brief Implementation of the ass-measure library
 */

#include "../include/ass_measure.h"
#include <ass/ass.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>

/**
 * @brief Measures the dimensions of all subtitle lines in an ASS file
 * 
 * @param ass_filepath Path to the ASS subtitle file
 * @param video_width Width of the video in pixels
 * @param video_height Height of the video in pixels
 * @return SubtitleRenderInfo Structure containing information about all subtitle lines
 */
SubtitleRenderInfo measure_subtitle_dimensions(
    const char *ass_filepath,
    int video_width,
    int video_height
) {
    SubtitleRenderInfo result = {NULL, 0};
    
    // Initialize libass
    ASS_Library *library = ass_library_init();
    if (!library) {
        fprintf(stderr, "Failed to initialize libass library\n");
        return result;
    }
    
    // Set libass message handler (optional)
    ass_set_message_cb(library, NULL, NULL);
    
    // Initialize renderer
    ASS_Renderer *renderer = ass_renderer_init(library);
    if (!renderer) {
        fprintf(stderr, "Failed to initialize libass renderer\n");
        ass_library_done(library);
        return result;
    }
    
    // Set frame size (video dimensions)
    ass_set_frame_size(renderer, video_width, video_height);
    
    // Set font configurations
    ass_set_fonts(renderer, NULL, "Sans", ASS_FONTPROVIDER_AUTODETECT, NULL, 1);
    
    // Load .ass subtitle file
    ASS_Track *track = ass_read_file(library, ass_filepath, NULL);
    if (!track) {
        fprintf(stderr, "Failed to load .ass file: %s\n", ass_filepath);
        ass_renderer_done(renderer);
        ass_library_done(library);
        return result;
    }
    
    // Allocate memory for subtitle line information
    result.count = track->n_events;
    result.lines = calloc(result.count, sizeof(SubtitleLineInfo));
    if (!result.lines) {
        fprintf(stderr, "Memory allocation failed\n");
        ass_free_track(track);
        ass_renderer_done(renderer);
        ass_library_done(library);
        result.count = 0;
        return result;
    }
    
    // Process each subtitle event
    for (int i = 0; i < track->n_events; i++) {
        ASS_Event *event = &track->events[i];
        
        // Fill in time information
        result.lines[i].start_time = event->Start;
        result.lines[i].end_time = event->Start + event->Duration;
        
        // Copy subtitle text
        result.lines[i].text = strdup(event->Text);
        if (!result.lines[i].text) {
            fprintf(stderr, "Memory allocation failed for event text\n");
            // Clean up already processed lines
            for (int j = 0; j < i; j++) {
                free(result.lines[j].text);
            }
            free(result.lines);
            ass_free_track(track);
            ass_renderer_done(renderer);
            ass_library_done(library);
            result.lines = NULL;
            result.count = 0;
            return result;
        }
        
        // Render subtitle at its start time
        long long render_timestamp_ms = event->Start;
        int detect_change = 0;
        ASS_Image *img = ass_render_frame(renderer, track, render_timestamp_ms, &detect_change);
        
        // Initialize bounds
        int x_min = INT_MAX, y_min = INT_MAX;
        int x_max = INT_MIN, y_max = INT_MIN;
        
        // Iterate over linked list of ASS_Images
        for (ASS_Image *cur_img = img; cur_img != NULL; cur_img = cur_img->next) {
            if (!cur_img->w || !cur_img->h) continue;
            
            int x0 = cur_img->dst_x;
            int y0 = cur_img->dst_y;
            int x1 = x0 + cur_img->w;
            int y1 = y0 + cur_img->h;
            
            // Update bounds
            if (x0 < x_min) x_min = x0;
            if (y0 < y_min) y_min = y0;
            if (x1 > x_max) x_max = x1;
            if (y1 > y_max) y_max = y1;
        }
        
        // Calculate width and height
        if (x_max > x_min && y_max > y_min) {
            result.lines[i].dimensions.width = x_max - x_min;
            result.lines[i].dimensions.height = y_max - y_min;
        } else {
            // No valid image bounds found
            result.lines[i].dimensions.width = 0;
            result.lines[i].dimensions.height = 0;
        }
    }
    
    // Clean up libass resources
    ass_free_track(track);
    ass_renderer_done(renderer);
    ass_library_done(library);
    
    return result;
}

/**
 * @brief Frees resources allocated for SubtitleRenderInfo
 * 
 * @param info SubtitleRenderInfo structure to be freed
 */
void free_subtitle_render_info(SubtitleRenderInfo info) {
    if (info.lines) {
        for (size_t i = 0; i < info.count; ++i) {
            free(info.lines[i].text);
        }
        free(info.lines);
    }
} 