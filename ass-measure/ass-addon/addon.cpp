#include <napi.h>
#include "include/ass_measure.h"
#include <string>
#include <vector>

/**
 * Measure dimensions of subtitle lines in an ASS file
 * 
 * @param filePath - Path to the ASS subtitle file
 * @param videoWidth - Width of the video in pixels
 * @param videoHeight - Height of the video in pixels
 * @returns Array of objects containing subtitle line information
 */
Napi::Value MeasureDimensions(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // Validate arguments
    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Parse arguments
    std::string filePath = info[0].As<Napi::String>().Utf8Value();
    int videoWidth = info[1].As<Napi::Number>().Int32Value();
    int videoHeight = info[2].As<Napi::Number>().Int32Value();
    
    // Call the C library function
    SubtitleRenderInfo result = measure_subtitle_dimensions(
        filePath.c_str(),
        videoWidth,
        videoHeight
    );
    
    // Check if measurement was successful
    if (result.count == 0 || result.lines == NULL) {
        Napi::Error::New(env, "Failed to measure subtitle dimensions").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Create result array
    Napi::Array outputArray = Napi::Array::New(env, result.count);
    
    // Convert C structs to JavaScript objects
    for (size_t i = 0; i < result.count; i++) {
        SubtitleLineInfo* line = &result.lines[i];
        
        Napi::Object lineObj = Napi::Object::New(env);
        
        lineObj.Set("text", Napi::String::New(env, line->text ? line->text : ""));
        lineObj.Set("width", Napi::Number::New(env, line->dimensions.width));
        lineObj.Set("height", Napi::Number::New(env, line->dimensions.height));
        lineObj.Set("startTime", Napi::Number::New(env, line->start_time));
        lineObj.Set("endTime", Napi::Number::New(env, line->end_time));
        
        outputArray.Set(i, lineObj);
    }
    
    // Free C resources
    free_subtitle_render_info(result);
    
    return outputArray;
}

// Initialize the addon
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(
        Napi::String::New(env, "measureLines"),
        Napi::Function::New(env, MeasureDimensions)
    );
    
    return exports;
}

NODE_API_MODULE(assaddon, Init) 