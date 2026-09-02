import { useEffect, useState } from "react";
import { createFlashcard, deleteFlashcard, getFlashcards, reviewFlashcard } from "../api/flashcardApi";

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  (error.code === "ERR_NETWORK"
    ? "Cannot reach the backend server. Start it from the backend folder."
    : "Unable to load flashcards.");

export default function Flashcards() {
  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyCardId, setBusyCardId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState({
    subject: "",
    question: "",
    answer: "",
    difficulty: "medium",
  });

  const loadFlashcards = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const data = await getFlashcards();
      setCards(data.flashcards || []);
      setStats(data.stats || null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlashcards();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setErrorMessage("");
      await createFlashcard({
        ...formData,
        subject: formData.subject.trim() || "General",
      });
      setFormData({ subject: "", question: "", answer: "", difficulty: "medium" });
      await loadFlashcards();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (id, performance) => {
    try {
      setBusyCardId(id);
      setErrorMessage("");
      await reviewFlashcard(id, performance);
      await loadFlashcards();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyCardId("");
    }
  };

  const handleDelete = async (id) => {
    try {
      setBusyCardId(id);
      setErrorMessage("");
      await deleteFlashcard(id);
      await loadFlashcards();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyCardId("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Flashcards</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {loading ? "Loading saved flashcards..." : `${stats?.total || cards.length} cards saved`}
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:grid-cols-2"
      >
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Topic / Subject</span>
          <input
            value={formData.subject}
            onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
            placeholder="Add the subject for this flashcard"
            className="w-full rounded border border-gray-300 p-3 text-gray-900 placeholder-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Card Difficulty</span>
          <select
            value={formData.difficulty}
            onChange={(e) => setFormData((prev) => ({ ...prev, difficulty: e.target.value }))}
            className="w-full rounded border border-gray-300 p-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Card Front</span>
          <textarea
            value={formData.question}
            onChange={(e) => setFormData((prev) => ({ ...prev, question: e.target.value }))}
            placeholder="Add the question or term to remember"
            className="min-h-28 w-full rounded border border-gray-300 p-3 text-gray-900 placeholder-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Card Back</span>
          <textarea
            value={formData.answer}
            onChange={(e) => setFormData((prev) => ({ ...prev, answer: e.target.value }))}
            placeholder="Add the answer, definition, or key points"
            className="min-h-28 w-full rounded border border-gray-300 p-3 text-gray-900 placeholder-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
            required
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400 md:col-span-2"
        >
          {saving ? "Saving..." : "Create Flashcard"}
        </button>
      </form>

      {!loading && cards.length === 0 && !errorMessage && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          No flashcards yet. Add your first one above.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <Flashcard
            key={card._id || card.id || i}
            card={card}
            busy={busyCardId === (card._id || card.id)}
            onDelete={handleDelete}
            onReview={handleReview}
          />
        ))}
      </div>
    </div>
  );
}
function Flashcard({ card, busy, onDelete, onReview }) {
  const [flipped, setFlipped] = useState(false);
  const cardId = card._id || card.id;

  return (
    <div className="space-y-3">
    <div className="h-56 w-full cursor-pointer perspective" onClick={() => setFlipped(!flipped)}>
      <div
        className={`relative h-full w-full rounded-xl transition-transform duration-500 transform-3d ${
          flipped ? "rotate-y-180" : ""
        }`}
      >
        {/* FRONT SIDE */}
        <div className="absolute inset-0 bg-white rounded-xl shadow-md p-5 backface-hidden flex items-center justify-center border border-gray-100">
          <p className="text-center font-medium text-gray-800">
            {card.question}
          </p>
        </div>

        {/* BACK SIDE */}
        <div 
          className="absolute inset-0 bg-indigo-600 text-white rounded-xl shadow-md p-5 backface-hidden flex items-center justify-center"
          style={{ transform: "rotateY(180deg)" }} // Explicitly set rotation for the back face
        >
          <p className="text-center leading-relaxed">
            {card.answer}
          </p>
        </div>
      </div>
    </div>
    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <span>{card.subject} - {card.difficulty}</span>
      {cardId && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onReview(cardId, 5);
            }}
            className="rounded bg-green-600 px-2 py-1 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
          >
            {busy ? "Saving..." : "Mark Known"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(cardId);
            }}
            className="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
          >
            Delete
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
// function Flashcard({ q, a }) {
//   const [flipped, setFlipped] = useState(false);

//   return (
//     <div
//       className="h-56 w-full cursor-pointer perspective"
//       onClick={() => setFlipped(!flipped)}
//     >
//       <div
//         className={`relative h-full w-full rounded-xl transition-transform duration-500 transform-style-preserve-3d ${
//           flipped ? "rotate-y-180" : ""
//         }`}
//       >
//         {/* FRONT */}
//         <div className="absolute inset-0 bg-white rounded-xl shadow-md p-5 backface-hidden flex items-center justify-center">
//           <p className="text-center font-medium text-gray-800 leading-relaxed">
//             {q}
//           </p>
//         </div>

//         {/* BACK */}
//         <div className="absolute inset-0 bg-indigo-600 text-white rounded-xl shadow-md p-5 backface-hidden rotate-y-180 flex items-center justify-center">
//           <p className="text-center leading-relaxed">
//             {a}
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }

// import { useState } from "react";

// export default function Flashcards() {
//   const cards = [
//     { q: "What is React?", a: "A UI library" },
//     { q: "What is Tailwind?", a: "Utility-first CSS" },
//   ];

//   return (
//     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//       {cards.map((card, i) => (
//         <div
//           key={i}
//           className="bg-white rounded-lg shadow p-4"
//         >
//           <h3 className="font-semibold text-lg mb-2">
//             {card.q}
//           </h3>
//           <p className="text-gray-600">
//             {card.a}
//           </p>
//         </div>
//       ))}
//     </div>
//   );
// }
