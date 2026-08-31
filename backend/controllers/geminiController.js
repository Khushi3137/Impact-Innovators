const fs = require('fs').promises;
const fileProcessor = require('../utils/fileProcessor');
const { callGroq } = require('../utils/groqClient');
const Quiz = require('../models/Quiz');

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

async function callAI(prompt) {
  await delayIfNeeded();
  return callGroq(prompt);
}

function createStudyNotesPrompt({ content, subject, maxLength = 700, extraInstruction }) {
  return `
You are a patient academic tutor. Turn the material below into clear, useful study notes for a student.

Rules:
- Explain the topic in simple language before listing points.
- Keep important technical terms, but define them.
- Do not only summarize; teach the idea.
- If the material is messy, infer the likely topic and organize it.
- Use Markdown headings and bullets.
- Keep it around ${maxLength} words unless the content needs less.

Format:
## Quick Overview
Give a 3-4 sentence overview.

## Explained Simply
Explain the main concept step by step.

## Key Points
List the most important points.

## Important Terms
Define key terms from the material.

## Example
Give one short example or real-world connection.

## Revision Questions
Give 5 questions students can use for revision.

${subject ? `Subject: ${subject}` : ''}
${extraInstruction ? `Extra instruction from student: ${extraInstruction}` : ''}

Material:
${content}
`;
}

function parseJsonFromText(text) {
  const cleaned = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const candidates = [
    cleaned,
    cleaned.slice(cleaned.indexOf('['), cleaned.lastIndexOf(']') + 1),
    cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)
  ].filter((candidate) => candidate && candidate.length > 1);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next likely JSON segment.
    }
  }

  return null;
}

function normalizeQuizQuestion(question, index, fallbackDifficulty) {
  const options = question.options || question.choices || [];
  const optionList = Array.isArray(options)
    ? options.map((option, optionIndex) => String(option || '').trim() || `Option ${optionIndex + 1}`)
    : Object.entries(options).map(([key, value]) => `${key}. ${value}`);

  return {
    question: String(question.question || question.text || `Question ${index + 1}`).trim(),
    options: optionList.slice(0, 4),
    correctAnswer: String(question.correctAnswer || question.correct_answer || question.answer || '').trim(),
    explanation: String(question.explanation || question.reason || '').trim(),
    category: String(question.category || '').trim(),
    difficulty: String(question.difficulty || fallbackDifficulty || 'medium').toLowerCase()
  };
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
    const responseText = await callAI(enhancedPrompt);
    res.json({ success: true, response: responseText, timestamp: new Date() });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ success: false, message: "Error processing request", error: err.message });
  }
};

exports.explainConcept = async (req, res) => {
  try {
    const { concept, level = 'beginner', subject } = req.body;
    const prompt = `
      Explain the concept "${concept}" in ${subject || 'general'} 
      to a ${level} student. Include definition, analogy, key points, misconceptions, practical use.
    `;
    const explanation = await callAI(prompt);
    res.json({ success: true, explanation, concept, level, subject });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
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
    const studyPlan = await callAI(prompt);
    res.json({ success: true, studyPlan, generatedAt: new Date() });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
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
    const text = await callAI(prompt);
    let flashcards;
    try {
      flashcards = JSON.parse(text);
    } catch {
      flashcards = text; // fallback
    }
    res.json({ success: true, flashcards, topic, count: Array.isArray(flashcards) ? flashcards.length : 0 });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};

exports.summarizeText = async (req, res) => {
  try {
    const { text, maxLength = 700, subject, prompt: extraInstruction } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const prompt = createStudyNotesPrompt({
      content: text.trim(),
      subject,
      maxLength,
      extraInstruction
    });
    const summary = await callAI(prompt);
    res.json({ success: true, summary, originalLength: text.length, summaryLength: summary.length });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};

exports.generateQuiz = async (req, res) => {
  try {
    const { topic, numberOfQuestions = 5, difficulty = 'medium', subject } = req.body;
    const prompt = `
      Generate a quiz with ${numberOfQuestions} questions on "${topic}" in ${subject || 'general'}.
      Include question text, 4 options (A-D), correct answer, explanation, category, difficulty.
      Difficulty must be ${difficulty}.
      Return only a valid JSON array. Do not include markdown, code fences, or extra text.
    `;
    const text = await callAI(prompt);
    const parsedQuiz = parseJsonFromText(text);
    const quiz = Array.isArray(parsedQuiz)
      ? parsedQuiz
      : Array.isArray(parsedQuiz?.questions)
        ? parsedQuiz.questions
        : { raw: text, questions: [] };

    const normalizedQuestions = Array.isArray(quiz)
      ? quiz.map((question, index) => normalizeQuizQuestion(question, index, difficulty))
      : [];

    let savedQuiz = null;
    if (normalizedQuestions.length) {
      savedQuiz = await Quiz.create({
        userId: req.userId,
        topic,
        subject: subject || 'General',
        difficulty,
        questions: normalizedQuestions
      });
    }

    res.json({
      success: true,
      quiz: normalizedQuestions.length ? normalizedQuestions : quiz,
      savedQuiz,
      topic,
      difficulty,
      numberOfQuestions,
      subject
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: "Error generating quiz", error: err.message });
  }
};

exports.solveProblem = async (req, res) => {
  try {
    const { problem, subject, context, showSteps = true } = req.body;
    const prompt = `
      Solve this ${subject || 'academic'} problem:
      ${context ? `Previous discussion:\n${context}\n` : ''}
      Problem: ${problem}
      If this is a follow-up, use the previous discussion for context and continue from there.
      Provide a student-friendly solution${showSteps ? " with clear steps and short explanations" : ""}.
      Use this exact structure:
      ## Short Answer
      Give the direct answer in 1-2 sentences.
      ## Step-by-Step
      Use numbered steps. Keep each step focused.
      ## Key Idea
      Explain the main concept simply.
      ## Common Mistake
      Mention one mistake students often make.
      ## Final Answer
      Restate the final result clearly.
    `;
    const solution = await callAI(prompt);
    res.json({ success: true, solution, problem, subject: subject || 'general', stepsIncluded: showSteps, timestamp: new Date() });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: "Error solving problem", error: err.message });
  }
};

exports.generatePracticeQuestions = async (req, res) => {
  try {
    const { topic, type = 'mixed', count = 10, subject } = req.body;
    const prompt = `
      Generate ${count} ${type} questions for "${topic}" in ${subject || 'general'}.
      Include instructions, answers, points, difficulty variation.
    `;
    const questions = await callAI(prompt);
    res.json({ success: true, questions, topic, type, count, subject });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
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
    const evaluation = await callAI(prompt);
    const scoreMatch = evaluation.match(/(\d+)%/);
    res.json({ success: true, evaluation, score: scoreMatch ? parseInt(scoreMatch[1]) : null, question, studentAnswer, timestamp: new Date() });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};

/* ===================== FILE PROCESSING WITH LOCAL MULTER UPLOADS ===================== */

exports.processUploadedFile = async (req, res) => {
  try {
    const { prompt, subject } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'file is required' });
    }

    const buffer = await fs.readFile(req.file.path);
    const result = await fileProcessor.processFile(
      buffer,
      req.file.mimetype,
      req.file.originalname,
      prompt || null,
      subject
    );

    if (!result.success) return res.status(400).json(result);

    res.json({
      success: true,
      summary: result.summary || result.analysis || null,
      fileInfo: {
        originalName: req.file.originalname,
        path: req.file.path,
        url: `/uploads/${req.file.filename}`,
        type: req.file.mimetype,
        size: buffer.length,
        uploadedAt: new Date().toISOString()
      },
      ...result
    });

  } catch (err) {
    console.error('File processing error:', err);
    res.status(500).json({ success: false, message: 'Error processing file', error: err.message });
  }
};
