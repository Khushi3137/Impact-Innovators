import api from "./axios";

export const summarizeText = async ({ text, maxLength = 300 }) => {
  const res = await api.post("/gemini/summarize", { text, maxLength });
  return res.data;
};

export const summarizeFile = async ({ file, prompt, subject }) => {
  const formData = new FormData();
  formData.append("file", file);

  if (prompt) formData.append("prompt", prompt);
  if (subject) formData.append("subject", subject);

  const res = await api.post("/gemini/process-file", formData);

  return res.data;
};

export const generateFlashcards = async ({ topic, subject, numberOfCards = 6 }) => {
  const res = await api.post("/gemini/flashcards", {
    topic,
    subject,
    numberOfCards,
  });
  return res.data;
};

export const generateQuiz = async ({ topic, subject, numberOfQuestions = 5, difficulty = "medium" }) => {
  const res = await api.post("/gemini/quiz", {
    topic,
    subject,
    numberOfQuestions,
    difficulty,
  });

  return res.data;
};

export const solveDoubt = async ({ problem, subject, context }) => {
  const res = await api.post("/gemini/solve", {
    problem,
    subject,
    context,
    showSteps: true,
  });

  return res.data;
};
