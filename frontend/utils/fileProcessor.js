const fs = require('fs').promises;
const path = require('path');
const pdfParseModule = require("pdf-parse");
const pdfParse = pdfParseModule.default || pdfParseModule;

const mammoth = require('mammoth');
const Jimp = require('jimp');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const videoProcessor = require('./videoProcessor');
const audioProcessor = require('./audioProcessor');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class FileProcessor {
  constructor() {
    this.geminiModel = genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || "gemini-2.5-pro" 
    });
    this.tempDir = path.join(__dirname, '../temp');
  }

  // Determine file type
  getFileType(mimeType, fileName) {
    const extension = path.extname(fileName || '').toLowerCase();
    
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('document') || mimeType.includes('msword') || 
        mimeType.includes('wordprocessingml') || extension === '.docx') return 'docx';
    if (mimeType.includes('presentation') || extension === '.pptx') return 'pptx';
    if (mimeType.includes('spreadsheet') || extension === '.xlsx') return 'xlsx';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('text/')) return 'text';
    
    // Fallback by extension
    if (['.txt', '.csv', '.json', '.js', '.py', '.java', '.cpp', '.html', '.css'].includes(extension)) {
      return 'text';
    }
    
    return 'unknown';
  }

  // Save buffer to temp file
  async saveToTemp(buffer, fileName) {
    const tempPath = path.join(this.tempDir, 'uploads', Date.now() + '_' + fileName);
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, buffer);
    return tempPath;
  }

  
async processPDF(buffer, fileName, prompt) {
  try {
    // CORRECT WAY: pdf-parse exports the function directly
    const pdfParse = require("pdf-parse");
    
    // Just call it directly
    const pdfData = await pdfParse(buffer);
    
    if (!pdfData || !pdfData.text) {
      throw new Error('Could not extract text from PDF');
    }
    
    const text = pdfData.text;
    const metadata = {
      numPages: pdfData.numpages || 0,
      info: pdfData.info || {},
      metadata: pdfData.metadata || {}
    };

    // Analyze with AI
    const analysis = await this.analyzeContent(text, 'PDF Document', prompt);
    const questions = await this.generateQuestions(text);
    const summary = await this.generateSummary(text);

    return {
      success: true,
      type: 'pdf',
      content: {
        text: text.substring(0, 10000),
        fullLength: text.length
      },
      metadata: metadata,
      analysis: analysis,
      questions: questions,
      summary: summary,
      processingTime: Date.now()
    };
    
  } catch (error) {
    console.error('PDF parse error details:', error);
    
    // Provide helpful error message
    let errorMsg = `PDF processing failed: ${error.message}`;
    let suggestions = [];
    
    if (error.message.includes('subpath') || error.message.includes('exports')) {
      errorMsg = 'PDF parsing library configuration issue';
      suggestions = [
        'Reinstall pdf-parse: npm uninstall pdf-parse && npm install pdf-parse@1.1.1',
        'Try converting PDF to text file first',
        'Use a different PDF library'
      ];
    }
    
    return { 
      success: false, 
      error: errorMsg,
      suggestions: suggestions,
      fallback: 'Try converting PDF to text file first'
    };
  }
}
  // DOCX Processing
  async processDOCX(buffer, fileName, prompt) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;
      
      const analysis = await this.analyzeContent(text, 'DOCX Document', prompt);
      const questions = await this.generateQuestions(text);
      const summary = await this.generateSummary(text);

      return {
        success: true,
        type: 'docx',
        content: { text: text.substring(0, 10000), fullLength: text.length },
        analysis: analysis,
        questions: questions,
        summary: summary,
        processingTime: Date.now()
      };
    } catch (error) {
      return { success: false, error: `DOCX processing failed: ${error.message}` };
    }
  }

  // Image Processing
  async processImage(buffer, mimeType, fileName, prompt) {
    try {
      const base64Image = buffer.toString('base64');
      
      // Analyze with Gemini Vision
      const visionAnalysis = await this.analyzeImageWithGemini(base64Image, mimeType, prompt);
      
      // Optional: Process with Jimp for additional info
      let imageInfo = {};
      try {
        const jimpImage = await Jimp.read(buffer);
        imageInfo = {
          width: jimpImage.bitmap.width,
          height: jimpImage.bitmap.height,
          size: buffer.length,
          format: jimpImage.getExtension()
        };
      } catch (jimpError) {
        console.warn('Jimp processing skipped:', jimpError.message);
      }

      return {
        success: true,
        type: 'image',
        analysis: visionAnalysis,
        metadata: imageInfo,
        processingTime: Date.now()
      };
    } catch (error) {
      return { success: false, error: `Image processing failed: ${error.message}` };
    }
  }

  // Video Processing
  async processVideo(buffer, mimeType, fileName, prompt) {
    try {
      const tempPath = await this.saveToTemp(buffer, fileName);
      
      // Get video info
      const videoInfo = await videoProcessor.getVideoInfo(tempPath);
      
      // Extract thumbnail
      const thumbnail = await videoProcessor.createThumbnail(tempPath);
      
      // Extract key frames (limited to 5 for performance)
      const frames = await videoProcessor.extractFrames(tempPath, { 
        interval: Math.max(30, videoInfo.duration / 5),
        count: 5 
      });
      
      // Extract audio
      const audio = await videoProcessor.extractAudio(tempPath);
      
      // Analyze frames with AI
      const frameAnalyses = [];
      for (let i = 0; i < Math.min(frames.length, 3); i++) {
        const frameAnalysis = await this.analyzeImageWithGemini(
          frames[i].base64, 
          'image/jpeg', 
          `Analyze this frame from a video: ${prompt || 'What is shown?'}`
        );
        frameAnalyses.push({
          timestamp: frames[i].timestamp,
          analysis: frameAnalysis
        });
      }
      
      // Transcribe audio if available
      let transcription = null;
      if (audio && audio.path) {
        try {
          const audioBuffer = await fs.readFile(audio.path);
          transcription = await audioProcessor.transcribeWithGemini(audioBuffer, 'audio/mp3');
        } catch (transcribeError) {
          console.warn('Audio transcription failed:', transcribeError.message);
        }
      }
      
      // Generate overall analysis
      const overallAnalysis = await this.generateVideoAnalysis(videoInfo, frameAnalyses, transcription, prompt);
      
      // Cleanup
      await videoProcessor.cleanup([tempPath, audio?.path, ...frames.map(f => f.path), thumbnail.path]);
      
      return {
        success: true,
        type: 'video',
        metadata: videoInfo,
        thumbnail: thumbnail.base64,
        frames: frameAnalyses,
        transcription: transcription,
        analysis: overallAnalysis,
        processingTime: Date.now()
      };
    } catch (error) {
      return { success: false, error: `Video processing failed: ${error.message}` };
    }
  }

  // Audio Processing
  async processAudio(buffer, mimeType, fileName, prompt) {
    try {
      const tempPath = await this.saveToTemp(buffer, fileName);
      
      // Get audio info
      const audioInfo = await audioProcessor.getAudioInfo(tempPath);
      
      // Create waveform
      const waveform = await audioProcessor.createWaveform(tempPath);
      
      // Transcribe
      const transcription = await audioProcessor.transcribeWithGemini(buffer, mimeType);
      
      // Analyze content
      const analysis = await audioProcessor.analyzeAudio(buffer, mimeType, prompt);
      
      // Generate summary from transcription
      const summary = transcription.success 
        ? await this.generateSummary(transcription.text)
        : 'Summary not available';
      
      // Cleanup
      await fs.unlink(tempPath).catch(() => {});
      await fs.unlink(waveform.path).catch(() => {});
      
      return {
        success: true,
        type: 'audio',
        metadata: audioInfo,
        transcription: transcription,
        analysis: analysis,
        summary: summary,
        waveform: waveform.base64,
        processingTime: Date.now()
      };
    } catch (error) {
      return { success: false, error: `Audio processing failed: ${error.message}` };
    }
  }

  // Text Processing
  async processText(buffer, mimeType, fileName, prompt) {
    try {
      const text = buffer.toString('utf-8');
      
      const analysis = await this.analyzeContent(text, 'Text Document', prompt);
      const questions = await this.generateQuestions(text);
      const summary = await this.generateSummary(text);
      const keyPoints = await this.extractKeyPoints(text);

      return {
        success: true,
        type: 'text',
        content: { text: text.substring(0, 10000), fullLength: text.length },
        analysis: analysis,
        questions: questions,
        summary: summary,
        keyPoints: keyPoints,
        processingTime: Date.now()
      };
    } catch (error) {
      return { success: false, error: `Text processing failed: ${error.message}` };
    }
  }

  // Main processing function
  async processFile(fileBuffer, mimeType, fileName, userPrompt = null) {
    const fileType = this.getFileType(mimeType, fileName);
    
    const defaultPrompts = {
      pdf: "Analyze this PDF document for educational content. Extract key concepts, provide a summary, and suggest study questions.",
      docx: "Analyze this document. Identify main topics, key points, and create a study guide.",
      image: "Describe this image in detail. Identify any educational content, diagrams, or information.",
      video: "Analyze this video content. Extract key concepts, provide timestamps for important sections, and create a summary.",
      audio: "Transcribe and analyze this audio. Identify main topics and key insights.",
      text: "Analyze this text content. Extract main ideas, key points, and create a summary."
    };

    const prompt = userPrompt || defaultPrompts[fileType] || "Analyze this content.";

    switch (fileType) {
      case 'pdf':
        return await this.processPDF(fileBuffer, fileName, prompt);
        
      case 'docx':
      case 'pptx':
      case 'xlsx':
        return await this.processDOCX(fileBuffer, fileName, prompt);
        
      case 'image':
        return await this.processImage(fileBuffer, mimeType, fileName, prompt);
        
      case 'video':
        return await this.processVideo(fileBuffer, mimeType, fileName, prompt);
        
      case 'audio':
        return await this.processAudio(fileBuffer, mimeType, fileName, prompt);
        
      case 'text':
        return await this.processText(fileBuffer, mimeType, fileName, prompt);
        
      default:
        return {
          success: false,
          error: `Unsupported file type: ${mimeType}. Supported: PDF, DOCX, Images, Videos, Audio, Text files.`,
          type: 'unknown'
        };
    }
  }

  // Helper methods for AI analysis
  async analyzeImageWithGemini(base64Image, mimeType, prompt) {
    try {
      const result = await this.geminiModel.generateContent([
        { text: prompt || "Analyze this image for educational content." },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Image
          }
        }
      ]);
      return result.response.text();
    } catch (error) {
      return `Image analysis failed: ${error.message}`;
    }
  }

  async analyzeContent(content, contentType, prompt) {
    try {
      const fullPrompt = `${prompt}\n\n${contentType}:\n${content.substring(0, 5000)}`;
      const result = await this.geminiModel.generateContent(fullPrompt);
      return result.response.text();
    } catch (error) {
      return `Content analysis failed: ${error.message}`;
    }
  }

  async generateSummary(content) {
    try {
      const prompt = `Summarize this content in 3-5 key points:\n\n${content.substring(0, 3000)}`;
      const result = await this.geminiModel.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      return "Summary generation failed";
    }
  }

  async generateQuestions(content) {
    try {
      const prompt = `Based on this content, generate 5 study questions with answers:\n\n${content.substring(0, 3000)}`;
      const result = await this.geminiModel.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      return "Question generation failed";
    }
  }

  async extractKeyPoints(content) {
    try {
      const prompt = `Extract 5-10 key points from this content:\n\n${content.substring(0, 3000)}`;
      const result = await this.geminiModel.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      return "Key points extraction failed";
    }
  }

  async generateVideoAnalysis(videoInfo, frames, transcription, prompt) {
    try {
      const frameText = frames.map(f => `At ${f.timestamp}s: ${f.analysis}`).join('\n');
      const transText = transcription?.text || 'No transcription available';
      
      const analysisPrompt = `
        Video Analysis Request: ${prompt || "Analyze this video"}
        
        Video Details:
        - Duration: ${videoInfo.duration} seconds
        - Resolution: ${videoInfo.video?.resolution || 'Unknown'}
        - Format: ${videoInfo.format}
        
        Key Frames Analysis:
        ${frameText}
        
        Audio Transcription:
        ${transText.substring(0, 2000)}
        
        Provide a comprehensive analysis including:
        1. Main topics covered
        2. Key concepts explained
        3. Educational value
        4. Suggested study approach
        5. Related topics to explore
      `;
      
      const result = await this.geminiModel.generateContent(analysisPrompt);
      return result.response.text();
    } catch (error) {
      return `Video analysis failed: ${error.message}`;
    }
  }
}

module.exports = new FileProcessor();