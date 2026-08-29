import { useState } from "react";
import { summarizeFile, summarizeText } from "../api/geminiApi";

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  (error.code === "ERR_NETWORK"
    ? "Cannot reach the backend server. Start it from the backend folder."
    : "Unable to generate summary.");

export default function Summarizer() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async () => {
    if (!file && !text.trim()) {
      setErrorMessage("Upload a file or paste lecture text before generating a summary.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSummary("");
      const data = file
        ? await summarizeFile({
            file,
            prompt: text.trim() || undefined,
          })
        : await summarizeText({ text, maxLength: 700 });

      setSummary(data.summary || data.analysis || data.extractedText || "Summary generated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-6 border border-transparent dark:border-gray-700 transition-colors">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Summarizer</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Upload a lecture file or paste text to get explained study notes.
        </p>
      </div>

      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-all bg-gray-50/50 dark:bg-gray-900/30">
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md,.csv,.mp3,.wav,.ogg,.m4a,.mp4,.mkv,.avi,.mov,.webm,application/pdf,application/x-pdf"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files[0] || null);
            setErrorMessage("");
          }}
        />
        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
          Click to upload file
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          PDF, Word, text, audio, or video
        </span>
      </label>

      {file && (
        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
          Selected file: {file.name}. Ready to generate a summary.
        </p>
      )}

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setErrorMessage("");
        }}
        placeholder="Paste lecture text here, or add an instruction for the uploaded file..."
        className="w-full h-40 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
      />

      {errorMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="w-full md:w-auto bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all shadow-sm disabled:cursor-not-allowed disabled:bg-indigo-400"
      >
        {loading ? "Generating..." : "Generate Study Notes"}
      </button>

      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        {summary ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800 dark:text-gray-100">
            {summary}
          </p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            AI-generated study notes will appear here...
          </p>
        )}
      </div>
    </div>
  );
}
