const { GoogleGenerativeAI } = require("@google/generative-ai");
const supabase = require('../config/supabase');
const fileProcessor = require('../utils/fileProcessor');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const geminiPro = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
});

let lastRequestTime = 0;
const REQUEST_DELAY = 2000;

// helper to delay requests
async function delayIfNeeded() {
  const now = Date.now();
  if (now - lastRequestTime < REQUEST_DELAY) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY - (now - lastRequestTime)));
  }
  lastRequestTime = Date.now();
}

async function callGemini(prompt) {
  await delayIfNeeded();
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  );
  const data = await response.json();
  if (!data.candidates) throw new Error(JSON.stringify(data));
  return data.candidates[0].content.parts[0].text;
}

/* ===================== ROUTES ===================== */

exports.askGemini = async (req, res) => {
  try {
    const { prompt, subject, context } = req.body;
    const enhancedPrompt = `
      As an AI tutor specializing in ${subject || "academic subjects"}, please help with:
      Student Query: ${prompt}
      ${context ? `Additional Context: ${context}` : ""}
      Provide step-by-step explanation, examples, key takeaways, recommended resources, and practice questions.
    `;
    const responseText = await geminiPro.generateContent(enhancedPrompt).then(r => r.response.then(res => res.text()));
    res.json({ success: true, response: responseText, timestamp: new Date() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error processing request", error: err.message });
  }
};

exports.explainConcept = async (req, res) => {
  try {
    const { concept, level = 'beginner', subject } = req.body;
    const prompt = `
      Explain the concept "${concept}" in ${subject || 'general'} 
      to a ${level} student. Include definition, analogy, key points, misconceptions, practical use.
    `;
    const explanation = await callGemini(prompt);
    res.json({ success: true, explanation, concept, level, subject });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.generateStudyPlan = async (req, res) => {
  try {
    const { subjects, days, hoursPerDay, examDate, currentLevel } = req.body;
    const prompt = `
      Create a study plan:
      Subjects: ${subjects.join(', ')}
      Days: ${days}, Hours/day: ${hoursPerDay}, Exam: ${examDate}, Current level: ${currentLevel}
      Include daily schedule, topic priority, revision, mock tests, breaks, and resources.
    `;
    const studyPlan = await callGemini(prompt);
    res.json({ success: true, studyPlan, generatedAt: new Date() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.generateFlashcards = async (req, res) => {
  try {
    const { topic, numberOfCards = 10, subject } = req.body;
    const prompt = `
      Generate ${numberOfCards} flashcards for "${topic}" in ${subject || 'general'}.
      Each flashcard: question, answer, key points, difficulty, related concepts.
      Return as JSON array.
    `;
    const text = await callGemini(prompt);
    let flashcards;
    try {
      flashcards = JSON.parse(text);
    } catch {
      flashcards = text; // fallback
    }
    res.json({ success: true, flashcards, topic, count: Array.isArray(flashcards) ? flashcards.length : 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.summarizeText = async (req, res) => {
  try {
    const { text, maxLength = 300 } = req.body;
    const prompt = `
      Summarize the following text under ${maxLength} words:
      ${text}
    `;
    const summary = await callGemini(prompt);
    res.json({ success: true, summary, originalLength: text.length, summaryLength: summary.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.generateQuiz = async (req, res) => {
  try {
    const { topic, numberOfQuestions = 5, difficulty = 'medium', subject } = req.body;
    const prompt = `
      Generate a quiz with ${numberOfQuestions} questions on "${topic}" in ${subject || 'general'}.
      Include question text, 4 options (A-D), correct answer, explanation, category, difficulty.
      Return as JSON array.
    `;
    const text = await callGemini(prompt);
    let quiz;
    try { quiz = JSON.parse(text); } catch { quiz = { raw: text, questions: [] }; }
    res.json({ success: true, quiz, topic, difficulty, numberOfQuestions, subject });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error generating quiz", error: err.message });
  }
};

exports.solveProblem = async (req, res) => {
  try {
    const { problem, subject, showSteps = true } = req.body;
    const prompt = `
      Solve this ${subject || 'academic'} problem:
      Problem: ${problem}
      Provide step-by-step solution${showSteps ? " with explanations" : ""}.
    `;
    const solution = await callGemini(prompt);
    res.json({ success: true, solution, problem, subject: subject || 'general', stepsIncluded: showSteps, timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error solving problem", error: err.message });
  }
};

exports.generatePracticeQuestions = async (req, res) => {
  try {
    const { topic, type = 'mixed', count = 10, subject } = req.body;
    const prompt = `
      Generate ${count} ${type} questions for "${topic}" in ${subject || 'general'}.
      Include instructions, answers, points, difficulty variation.
    `;
    const questions = await callGemini(prompt);
    res.json({ success: true, questions, topic, type, count, subject });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.checkAnswer = async (req, res) => {
  try {
    const { question, studentAnswer, correctAnswer, subject } = req.body;
    const prompt = `
      Evaluate this answer:
      Question: ${question}
      Student Answer: ${studentAnswer}
      Correct Answer: ${correctAnswer || 'Provide correct answer'}
      Provide score (0-100%), feedback, areas of improvement.
    `;
    const evaluation = await callGemini(prompt);
    const scoreMatch = evaluation.match(/(\d+)%/);
    res.json({ success: true, evaluation, score: scoreMatch ? parseInt(scoreMatch[1]) : null, question, studentAnswer, timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ===================== FILE PROCESSING WITH SUPABASE ===================== */

exports.processUploadedFile = async (req, res) => {
  try {
    const { filePath, prompt, subject, analyzeType = 'full' } = req.body;
    if (!filePath) return res.status(400).json({ success: false, message: 'filePath is required' });

    const { data, error } = await supabase.storage.from(process.env.SUPABASE_BUCKET).download(filePath);
    if (error || !data) throw new Error('Failed to download file from Supabase');

    const buffer = Buffer.from(await data.arrayBuffer());
    const ext = filePath.split('.').pop().toLowerCase();
let mimeType;

switch(ext) {
  case 'pdf': mimeType = 'application/pdf'; break;
  case 'txt': mimeType = 'text/plain'; break;
  case 'docx': mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; break;
  case 'jpg':
  case 'jpeg': mimeType = 'image/jpeg'; break;
  case 'png': mimeType = 'image/png'; break;
  case 'gif': mimeType = 'image/gif'; break;
  case 'mp4': mimeType = 'video/mp4'; break;
  case 'mp3': mimeType = 'audio/mpeg'; break;
  // add more as needed
  default: mimeType = 'application/octet-stream';
}

    const result = await fileProcessor.processFile(buffer, mimeType, filePath, prompt || `Analyze this ${subject || 'educational'} content`);

    if (!result.success) return res.status(400).json(result);

    res.json({
      success: true,
      summary: result.summary || result.analysis || null,
      fileInfo: { path: filePath, type: mimeType, size: buffer.length, uploadedAt: new Date().toISOString() },
      ...result
    });

  } catch (err) {
    console.error('File processing error:', err);
    res.status(500).json({ success: false, message: 'Error processing file', error: err.message });
  }
};
