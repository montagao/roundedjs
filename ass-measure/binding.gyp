{
  "targets": [
    {
      "target_name": "ass_measure_native",
      "sources": [
        "src/ass_measure_binding.cpp",
        "src/ass_measure.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "./include",
        "<!@(pkg-config --cflags libass)"
      ],
      "libraries": [
        "<!@(pkg-config --libs libass)"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"]
    }
  ]
} 