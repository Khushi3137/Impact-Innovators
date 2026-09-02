const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');

class AudioProcessor {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
  }

  // Get audio metadata
  async getAudioInfo(audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Audio probe error: ${err.message}`));
          return;
        }

        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          format: metadata.format.format_name,
          bitrate: metadata.format.bit_rate,
          audio: audioStream ? {
            codec: audioStream.codec_name,
            channels: audioStream.channels,
            sampleRate: audioStream.sample_rate,
            bitrate: audioStream.bit_rate
          } : null
        });
      });
    });
  }

  // Convert audio format
  async convertFormat(audioPath, targetFormat = 'mp3', bitrate = '128k') {
    const outputPath = path.join(
      this.tempDir,
      'converted',
      `${Date.now()}.${targetFormat}`
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .output(outputPath)
        .audioCodec(targetFormat === 'mp3' ? 'libmp3lame' : 'aac')
        .audioBitrate(bitrate)
        .on('end', () => resolve({
          path: outputPath,
          format: targetFormat,
          size: fs.statSync(outputPath).size
        }))
        .on('error', reject)
        .run();
    });
  }

  // Extract audio segment
  async extractSegment(audioPath, startTime, duration) {
    const outputPath = path.join(
      this.tempDir,
      'segments',
      `${Date.now()}_segment.mp3`
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .output(outputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .audioCodec('libmp3lame')
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async transcribeAudio() {
    return {
      text: 'Transcription not available with the current Groq text model.',
      success: false,
      method: 'fallback'
    };
  }

  // Analyze audio content with AI
  async analyzeAudio(audioBuffer, mimeType, prompt = "Analyze this audio content") {
    return 'Audio analysis is not available with the current Groq text model.';
  }

  // Normalize audio volume
  async normalizeAudio(audioPath) {
    const outputPath = path.join(
      this.tempDir,
      'normalized',
      `${Date.now()}_normalized.mp3`
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .output(outputPath)
        .audioFilters('loudnorm')
        .audioCodec('libmp3lame')
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  // Create waveform image
  async createWaveform(audioPath, width = 800, height = 200) {
    const outputPath = path.join(
      this.tempDir,
      'waveforms',
      `${Date.now()}_waveform.png`
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .output(outputPath)
        .complexFilter([
          `aformat=channel_layouts=mono`,
          `compand=gain=-6`,
          `showwavespic=s=${width}x${height}:colors=#4A90E2`
        ])
        .frames(1)
        .on('end', async () => {
          const buffer = await fs.readFile(outputPath);
          resolve({
            path: outputPath,
            buffer: buffer,
            base64: buffer.toString('base64')
          });
        })
        .on('error', reject)
        .run();
    });
  }
}

module.exports = new AudioProcessor();
