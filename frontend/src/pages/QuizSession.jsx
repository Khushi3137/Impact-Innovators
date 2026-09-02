import { useEffect, useMemo, useRef, useState } from "react";
import { generateQuiz } from "../api/geminiApi";
import { deleteSavedQuiz, getSavedQuizzes, recordQuizAttempt } from "../api/quizApi";

const getErrorMessage = (error) =>
  error.response?.data?.error ||
  error.response?.data?.message ||
  (error.code === "ERR_NETWORK"
    ? "Cannot reach the backend server. Start it from the backend folder."
    : "Unable to generate quiz right now.");

const extractJson = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.questions) && value.questions.length) return value.questions;
  if (Array.isArray(value?.quiz) && value.quiz.length) return value.quiz;
  if (typeof value?.raw === "string") return extractJson(value.raw);
  if (typeof value?.quiz === "string") return extractJson(value.quiz);
  if (typeof value !== "string") return [];

  const cleaned = value
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const candidates = [
    cleaned,
    cleaned.slice(cleaned.indexOf("["), cleaned.lastIndexOf("]") + 1),
    cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1),
  ].filter((candidate) => candidate && candidate.length > 1);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed.questions)) return parsed.questions;
      if (Array.isArray(parsed.quiz)) return parsed.quiz;
    } catch {
      // Try the next likely JSON segment.
    }
  }

  return [];
};

const normalizeQuestion = (question, index) => {
  const options = question.options || question.choices || [];
  const optionList = Array.isArray(options)
    ? options
    : Object.entries(options).map(([key, value]) => `${key}. ${value}`);

  return {
    id: `${index}-${question.question || question.text || "question"}`,
    question: question.question || question.text || `Question ${index + 1}`,
    options: optionList.slice(0, 4),
    answer: String(question.correctAnswer || question.correct_answer || question.answer || "").trim(),
    explanation: question.explanation || question.reason || "",
    difficulty: question.difficulty || "medium",
  };
};

const getBestScore = (quiz) => {
  const attempts = quiz?.attempts || [];
  if (!attempts.length) return null;

  return attempts.reduce((best, attempt) => {
    const percent = attempt.total ? attempt.score / attempt.total : 0;
    const bestPercent = best.total ? best.score / best.total : 0;
    return percent > bestPercent ? attempt : best;
  }, attempts[0]);
};

const getLatestAttempt = (quiz) => {
  const attempts = quiz?.attempts || [];
  if (!attempts.length) return null;

  return attempts[attempts.length - 1];
};

const formatAttemptTime = (value) => {
  if (!value) return "Just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isCorrectAnswer = (selected, answer) => {
  if (!selected || !answer) return false;

  const normalize = (value) =>
    String(value)
      .replace(/^[A-D][).:-]?\s*/i, "")
      .trim()
      .toLowerCase();

  const selectedLetter = selected.match(/^\s*([A-D])/i)?.[1]?.toUpperCase();
  const answerLetter = answer.match(/^\s*([A-D])/i)?.[1]?.toUpperCase();

  return (
    normalize(selected) === normalize(answer) ||
    (!!selectedLetter && selectedLetter === answerLetter)
  );
};

export default function QuizSession() {
  const [formData, setFormData] = useState({
    topic: "",
    subject: "",
    difficulty: "medium",
    numberOfQuestions: 5,
  });
  const [questions, setQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rawQuiz, setRawQuiz] = useState("");
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [openedQuiz, setOpenedQuiz] = useState(null);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const quizDetailRef = useRef(null);

  const loadSavedQuizzes = async () => {
    try {
      const data = await getSavedQuizzes();
      setSavedQuizzes(data.quizzes || []);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  useEffect(() => {
    loadSavedQuizzes();
  }, []);

  const score = useMemo(
    () =>
      questions.reduce(
        (total, question) =>
          total + (isCorrectAnswer(selectedAnswers[question.id], question.answer) ? 1 : 0),
        0
      ),
    [questions, selectedAnswers]
  );

  const activeQuiz = useMemo(
    () => openedQuiz || savedQuizzes.find((quiz) => quiz._id === activeQuizId) || null,
    [activeQuizId, openedQuiz, savedQuizzes]
  );

  const handleGenerate = async (event) => {
    event.preventDefault();
    if (loading) return;

    try {
      setLoading(true);
      setErrorMessage("");
      setSubmitted(false);
      setSelectedAnswers({});
      setRawQuiz("");
      setActiveQuizId(null);
      setOpenedQuiz(null);
      setScoreSaved(false);
      setReviewMode(false);

      const data = await generateQuiz({
        ...formData,
        topic: formData.topic.trim(),
        subject: formData.subject.trim() || "General",
        numberOfQuestions: Number(formData.numberOfQuestions),
      });

      const normalized = extractJson(data.quiz).map(normalizeQuestion);
      setQuestions(normalized);
      setActiveQuizId(data.savedQuiz?._id || null);

      if (!normalized.length) {
        setRawQuiz(typeof data.quiz?.raw === "string" ? data.quiz.raw : JSON.stringify(data.quiz, null, 2));
      }

      await loadSavedQuizzes();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const openSavedQuiz = (quiz) => {
    const normalizedQuiz = {
      ...quiz,
      questions: Array.isArray(quiz.questions) ? quiz.questions : [],
      attempts: Array.isArray(quiz.attempts) ? quiz.attempts : [],
    };

    setFormData({
      topic: normalizedQuiz.topic || "",
      subject: normalizedQuiz.subject || "",
      difficulty: normalizedQuiz.difficulty || "medium",
      numberOfQuestions: normalizedQuiz.questions.length || 5,
    });
    setOpenedQuiz(normalizedQuiz);
    setQuestions(normalizedQuiz.questions.map(normalizeQuestion));
    setSelectedAnswers({});
    setSubmitted(true);
    setRawQuiz("");
    setErrorMessage("");
    setScoreSaved(true);
    setReviewMode(true);
    setActiveQuizId(normalizedQuiz._id || null);
    window.requestAnimationFrame(() => {
      quizDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const toggleSavedQuiz = (quiz) => {
    if (activeQuizId === quiz._id) {
      setActiveQuizId(null);
      setOpenedQuiz(null);
      setQuestions([]);
      setSelectedAnswers({});
      setSubmitted(false);
      setScoreSaved(false);
      setReviewMode(false);
      setRawQuiz("");
      setErrorMessage("");
      return;
    }

    openSavedQuiz(quiz);
  };

  const retakeQuiz = () => {
    setSelectedAnswers({});
    setSubmitted(false);
    setScoreSaved(false);
    setReviewMode(false);
    setErrorMessage("");
  };

  const handleDeleteQuiz = async (quizId) => {
    const shouldDelete = window.confirm("Delete this saved quiz? This cannot be undone.");
    if (!shouldDelete) return;

    try {
      await deleteSavedQuiz(quizId);
      setSavedQuizzes((prev) => prev.filter((quiz) => quiz._id !== quizId));

      if (activeQuizId === quizId) {
        setActiveQuizId(null);
        setOpenedQuiz(null);
        setQuestions([]);
        setSelectedAnswers({});
        setSubmitted(false);
        setScoreSaved(false);
        setReviewMode(false);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleSubmitAnswers = async () => {
    setSubmitted(true);

    if (!activeQuizId || scoreSaved) return;

    try {
      const data = await recordQuizAttempt(activeQuizId, {
        score,
        total: questions.length,
        answers: selectedAnswers,
      });
      setScoreSaved(true);
      setOpenedQuiz((prev) =>
        prev && prev._id === activeQuizId
          ? {
              ...data.quiz,
              questions: Array.isArray(data.quiz?.questions) ? data.quiz.questions : prev.questions,
              attempts: Array.isArray(data.quiz?.attempts) ? data.quiz.attempts : prev.attempts,
            }
          : prev
      );
      setSavedQuizzes((prev) =>
        prev.map((quiz) => (quiz._id === activeQuizId ? data.quiz : quiz))
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5 xl:grid-cols-[0.78fr_1.22fr]">
      <div className="space-y-5">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
              AI Quiz
            </span>
            <h1 className="mt-3 text-3xl font-bold text-gray-950 dark:text-white">Quiz Session</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Enter the topic you want to study and get a focused quiz with answers and explanations.
            </p>
          </div>
          {questions.length > 0 && (
            <div className="rounded-lg border border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
              <p className="font-semibold text-gray-950 dark:text-white">
                {reviewMode ? `${questions.length} questions` : submitted ? `${score}/${questions.length}` : `${questions.length} questions`}
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                {reviewMode ? "Reviewing answers" : submitted ? "Current score" : "Ready to answer"}
              </p>
            </div>
          )}
        </div>
      </section>

      <form
        onSubmit={handleGenerate}
        className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:grid-cols-[1.2fr_0.8fr_0.7fr_0.5fr]"
      >
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Topic</span>
          <input
            value={formData.topic}
            onChange={(event) => setFormData((prev) => ({ ...prev, topic: event.target.value }))}
            placeholder="Operating systems, DBMS indexing, photosynthesis..."
            className="w-full rounded border border-gray-300 p-3 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Subject</span>
          <input
            value={formData.subject}
            onChange={(event) => setFormData((prev) => ({ ...prev, subject: event.target.value }))}
            placeholder="Optional"
            className="w-full rounded border border-gray-300 p-3 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Difficulty</span>
          <select
            value={formData.difficulty}
            onChange={(event) => setFormData((prev) => ({ ...prev, difficulty: event.target.value }))}
            className="w-full rounded border border-gray-300 p-3 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Questions</span>
          <input
            type="number"
            min="3"
            max="10"
            value={formData.numberOfQuestions}
            onChange={(event) => setFormData((prev) => ({ ...prev, numberOfQuestions: event.target.value }))}
            className="w-full rounded border border-gray-300 p-3 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400 md:col-span-4"
        >
          {loading ? "Generating Quiz..." : "Generate Quiz"}
        </button>

      </form>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-950 dark:text-white">Saved Quizzes</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{savedQuizzes.length} saved</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {savedQuizzes.length ? (
            savedQuizzes.map((quiz) => {
              const bestScore = getBestScore(quiz);
              const latestAttempt = getLatestAttempt(quiz);
              const isActive = activeQuizId === quiz._id;

              return (
                <div
                  key={quiz._id}
                  className={`rounded-lg border p-3 transition ${
                    isActive
                      ? "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30"
                      : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => toggleSavedQuiz(quiz)} className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold text-gray-950 dark:text-white">{quiz.topic}</p>
                      <p className="mt-1 text-xs capitalize text-gray-500 dark:text-gray-400">
                        {quiz.subject || "General"} | {quiz.difficulty || "medium"} | {quiz.questions?.length || 0} questions
                      </p>
                      <p className="mt-2 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        {latestAttempt
                          ? `Latest score: ${latestAttempt.score}/${latestAttempt.total}`
                          : "Not attempted yet"}
                      </p>
                      {bestScore && (
                        <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Best score: {bestScore.score}/{bestScore.total}
                        </p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuiz(quiz._id)}
                      className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
              Generated quizzes will stay here until you delete them.
            </div>
          )}
        </div>
      </section>
      </div>

      <div ref={quizDetailRef} className="space-y-5">
      {errorMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {errorMessage}
        </div>
      )}

      {rawQuiz && (
        <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
          {rawQuiz}
        </pre>
      )}

      {questions.length > 0 && (
        <section className="space-y-4">
          {activeQuiz?.attempts?.length ? (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold">Attempts history</h3>
            <span className="text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              {activeQuiz.attempts.length} total
            </span>
          </div>
              <div className="mt-3 rounded-md bg-white px-3 py-2 ring-1 ring-indigo-100 dark:bg-gray-900 dark:ring-indigo-900">
                {(() => {
                  const latestAttempt = getLatestAttempt(activeQuiz);
                  return latestAttempt ? (
                    <p className="font-medium text-gray-900 dark:text-white">
                      Latest score: {latestAttempt.score}/{latestAttempt.total}
                    </p>
                  ) : (
                    <p className="font-medium text-gray-900 dark:text-white">No attempts yet</p>
                  );
                })()}
              </div>
              <div className="mt-3 space-y-2">
                {activeQuiz.attempts
                  .slice()
                  .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
                  .map((attempt, index) => {
                    const percent = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;

                    return (
                      <div
                        key={`${attempt.submittedAt || "attempt"}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 ring-1 ring-indigo-100 dark:bg-gray-900 dark:ring-indigo-900"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white">
                            Attempt {activeQuiz.attempts.length - index}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatAttemptTime(attempt.submittedAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {attempt.score}/{attempt.total}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{percent}%</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}

          {reviewMode && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              This saved quiz is open in review mode, so questions, answers, and explanations are visible.
            </div>
          )}

          {questions.map((question, index) => (
            <article
              key={question.id}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-lg font-bold text-gray-950 dark:text-white">
                  {index + 1}. {question.question}
                </h2>
                <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold capitalize text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900">
                  {question.difficulty}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {question.options.map((option) => {
                  const selected = selectedAnswers[question.id] === option;
                  const correct = submitted && isCorrectAnswer(option, question.answer);
                  const wrong = submitted && selected && !correct;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        !submitted &&
                        setSelectedAnswers((prev) => ({
                          ...prev,
                          [question.id]: option,
                        }))
                      }
                      className={`rounded-lg border p-3 text-left text-sm transition ${
                        correct
                          ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : wrong
                            ? "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                            : selected
                              ? "border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200"
                              : "border-gray-200 bg-gray-50 text-gray-700 hover:border-indigo-300 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                  <p className="font-semibold">Answer: {question.answer || "Not provided"}</p>
                  {question.explanation && <p className="mt-2 leading-6">{question.explanation}</p>}
                </div>
              )}
            </article>
          ))}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={retakeQuiz}
              disabled={!submitted}
              className="rounded border border-indigo-200 bg-indigo-50 px-4 py-3 font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200 dark:hover:bg-indigo-950/50 dark:disabled:border-gray-800 dark:disabled:bg-gray-900 dark:disabled:text-gray-600"
            >
              Retake Quiz
            </button>
            <button
              type="button"
              onClick={handleSubmitAnswers}
              disabled={submitted || Object.keys(selectedAnswers).length !== questions.length}
              className="rounded bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
            >
              {submitted ? `Score saved: ${score}/${questions.length}` : "Submit Answers"}
            </button>
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
