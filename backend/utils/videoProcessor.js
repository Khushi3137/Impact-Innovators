const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// 🔥 VERY IMPORTANT (Windows fix)
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

class VideoProcessor {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
  }

  /* ===================== VIDEO INFO ===================== */
  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          return reject(new Error(`FFprobe error: ${err.message}`));
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          format: metadata.format.format_name,
          bitrate: metadata.format.bit_rate,
          video: videoStream ? {
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
            fps: eval(videoStream.r_frame_rate)
          } : null,
          audio: audioStream ? {
            codec: audioStream.codec_name,
            channels: audioStream.channels,
            sampleRate: audioStream.sample_rate
          } : null
        });
      });
    });
  }

  /* ===================== FRAME EXTRACTION ===================== */
  async extractFrames(videoPath, options = {}) {
    const {
      interval = 5,
      count = 5,
      size = '640x?',
      outputDir = path.join(this.tempDir, 'frames', Date.now().toString())
    } = options;

    await fs.mkdir(outputDir, { recursive: true });

    const duration = await this.getDuration(videoPath);
    const timemarks = this.generateTimemarks(interval, count, duration);

    return new Promise((resolve, reject) => {
      const frames = [];

      ffmpeg(videoPath)
        .on('end', async () => {
          try {
            const files = await fs.readdir(outputDir);
            for (const file of files) {
              if (file.match(/\.(jpg|jpeg|png)$/i)) {
                const framePath = path.join(outputDir, file);
                const buffer = await fs.readFile(framePath);
                frames.push({
                  filename: file,
                  path: framePath,
                  base64: buffer.toString('base64')
                });
              }
            }
            resolve(frames);
          } catch (err) {
            reject(err);
          }
        })
        .on('error', err => reject(new Error(`Frame extraction failed: ${err.message}`)))
        .screenshots({
          timemarks,
          filename: 'frame_%03d.jpg',
          folder: outputDir,
          size
        });
    });
  }

  generateTimemarks(interval, count, duration) {
    const marks = [];
    for (let t = interval; t <= duration && marks.length < count; t += interval) {
      marks.push(t);
    }
    if (marks.length === 0) {
      marks.push(Math.min(1, duration));
    }
    return marks;
  }

  /* ===================== AUDIO EXTRACTION ===================== */
  async extractAudio(videoPath, outputFormat = 'mp3') {
    const outputPath = path.join(
      this.tempDir,
      'audio',
      `${Date.now()}.${outputFormat}`
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec(outputFormat === 'mp3' ? 'libmp3lame' : 'aac')
        .audioBitrate('128k')
        .output(outputPath)
        .on('end', () => {
          resolve({
            path: outputPath,
            format: outputFormat,
            size: fsSync.statSync(outputPath).size
          });
        })
        .on('error', err => reject(new Error(`Audio extraction failed: ${err.message}`)))
        .run();
    });
  }

  /* ===================== THUMBNAIL ===================== */
  async createThumbnail(videoPath, timestamp = '00:00:01') {
    const outputPath = path.join(
      this.tempDir,
      'thumbnails',
      `${Date.now()}_thumb.jpg`
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x?'
        })
        .on('end', async () => {
          const buffer = await fs.readFile(outputPath);
          resolve({
            path: outputPath,
            base64: buffer.toString('base64')
          });
        })
        .on('error', err => reject(new Error(`Thumbnail failed: ${err.message}`)));
    });
  }

  /* ===================== FORMAT CONVERSION ===================== */
  async convertFormat(videoPath, targetFormat = 'mp4') {
    const outputPath = videoPath.replace(/\.[^/.]+$/, `_converted.${targetFormat}`);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions('-movflags +faststart')
        .output(outputPath)
        .on('end', () => {
          resolve({
            path: outputPath,
            format: targetFormat,
            size: fsSync.statSync(outputPath).size
          });
        })
        .on('error', err => reject(new Error(`Conversion failed: ${err.message}`)))
        .run();
    });
  }

  /* ===================== DURATION ===================== */
  async getDuration(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration);
      });
    });
  }

  /* ===================== CLEANUP ===================== */
  async cleanup(files = []) {
    for (const file of files) {
      try {
        if (file && file.includes('temp')) {
          await fs.unlink(file);
        }
      } catch (_) {}
    }
  }
}

module.exports = new VideoProcessor();
