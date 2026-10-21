# build-audio

收集所有需发音的文本，按 `sha256(voiceId + voiceVersion + 规范化文本 + 参数)` 命名；缓存未命中时调用 Piper 合成并编码为单声道 48 kbps MP3；`content/assets/audio-overrides/` 中的真人录音优先。

**是否上服务器**：否（生成的音频随课程包上服务器）。
