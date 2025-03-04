/**
 * @file ass_measure.h
 * @brief Library for measuring rendered dimensions of ASS subtitle lines
 * 
 * This library uses libass to predict the exact rendered dimensions
 * (width and height in pixels) of each subtitle line in an ASS file.
 */

#ifndef ASS_MEASURE_H
#define ASS_MEASURE_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Structure to hold dimensions of a subtitle
 */
typedef struct {
    int width;      /**< Width in pixels */
    int height;     /**< Height in pixels */
} SubtitleDimensions;

/**
 * @brief Structure to hold information about a subtitle line
 */
typedef struct {
    char *text;                 /**< The text content of the subtitle */
    SubtitleDimensions dimensions; /**< The rendered dimensions */
    long long start_time;       /**< Start time in milliseconds */
    long long end_time;         /**< End time in milliseconds */
} SubtitleLineInfo;

/**
 * @brief Structure to hold information about all subtitle lines
 */
typedef struct {
    SubtitleLineInfo *lines;    /**< Array of subtitle line information */
    size_t count;               /**< Number of subtitle lines */
} SubtitleRenderInfo;

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
);

/**
 * @brief Frees resources allocated for SubtitleRenderInfo
 * 
 * @param info SubtitleRenderInfo structure to be freed
 */
void free_subtitle_render_info(SubtitleRenderInfo info);

#ifdef __cplusplus
}
#endif

#endif /* ASS_MEASURE_H */ 