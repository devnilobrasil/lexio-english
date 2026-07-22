# Third-Party Notices

This product includes the following third-party software and model assets.

## Kokoro TTS (`kokoro-js`)

- Package: `kokoro-js`
- License: Apache License 2.0
- Upstream: https://github.com/hexgrad/kokoro
- Copyright: hexgrad and contributors

## Kokoro-82M ONNX model

- Model: `onnx-community/Kokoro-82M-v1.0-ONNX`
- License: Apache License 2.0
- Upstream: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
- Notes: Bundled quantized ONNX weights (`q8` / `model_quantized.onnx`) are included for offline synthesis.

## Voice asset `af_heart`

- Source: Kokoro voice pack (`voices/af_heart.bin`)
- License: Apache License 2.0 (same as Kokoro model distribution)
- Upstream: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX

## Transformers.js / ONNX Runtime Web

- Packages: `@huggingface/transformers`, `onnxruntime-web`
- Licenses: Apache License 2.0
- Notes: Local WASM binaries (`ort-wasm-simd-threaded*`) are bundled so inference does not require network access at runtime.

## Phonemizer (`phonemizer`)

- Package: `phonemizer` (eSpeak NG-based)
- License: Apache License 2.0
- Upstream: https://github.com/xenova/phonemizer.js

Full Apache License 2.0 text: https://www.apache.org/licenses/LICENSE-2.0
