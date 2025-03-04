#include <napi.h>
extern "C" {
    #include "../include/ass_measure.h"
}

/**
 * @brief Node.js binding for measuring subtitle dimensions
 * 
 * @param info Function arguments: [assFilePath, videoWidth, videoHeight]
 * @return Napi::Value JavaScript array of subtitle line information
 */
Napi::Value MeasureSubtitleLines(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Validate arguments
    if (info.Length() < 3 ||
        !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
        Napi::TypeError::New(env, "Expected (assFilePath, videoWidth, videoHeight)").ThrowAsJavaScriptException();
        return Napi::Array::New(env);
    }

    // Parse arguments
    std::string assFilePath = info[0].As<Napi::String>().Utf8Value();
    int videoWidth = info[1].As<Napi::Number>().Int32Value();
    int videoHeight = info[2].As<Napi::Number>().Int32Value();

    // Call the C function to measure subtitle dimensions
    SubtitleRenderInfo renderInfo = measure_subtitle_dimensions(
        assFilePath.c_str(), videoWidth, videoHeight);

    // Create JavaScript array to hold results
    Napi::Array result = Napi::Array::New(env, renderInfo.count);
    
    // Convert C struct to JavaScript objects
    for (size_t i = 0; i < renderInfo.count; i++) {
        Napi::Object line = Napi::Object::New(env);
        
        // Add text content
        if (renderInfo.lines[i].text) {
            line.Set("text", Napi::String::New(env, renderInfo.lines[i].text));
        } else {
            line.Set("text", Napi::String::New(env, ""));
        }
        
        // Add dimensions
        line.Set("width", Napi::Number::New(env, renderInfo.lines[i].dimensions.width));
        line.Set("height", Napi::Number::New(env, renderInfo.lines[i].dimensions.height));
        
        // Add timing information
        line.Set("startTime", Napi::Number::New(env, renderInfo.lines[i].start_time));
        line.Set("endTime", Napi::Number::New(env, renderInfo.lines[i].end_time));
        
        // Add to result array
        result.Set(i, line);
    }

    // Free memory allocated by the C library
    free_subtitle_render_info(renderInfo);

    return result;
}

/**
 * @brief Initializes the module
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(
        Napi::String::New(env, "measureLines"),
        Napi::Function::New(env, MeasureSubtitleLines)
    );
    return exports;
}

NODE_API_MODULE(ass_measure_native, Init) 