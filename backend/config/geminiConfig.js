const { GoogleGenerativeAI } = require("@google/generative-ai");

const configureGemini = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // Configure different models for different use cases
  const models = {
    geminiPro: genAI.getGenerativeModel({ 
      model: genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL }),
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      }
    }),
    geminiProVision: genAI.getGenerativeModel({ 
      model: "gemini-pro-vision",
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        topK: 32,
        maxOutputTokens: 1024,
      }
    })
  };
  
  return models;
};

module.exports = configureGemini;