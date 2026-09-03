import { useEffect, useState, useContext } from "react";
import { summarizeFile, summarizeText } from "../api/geminiApi";
import { AuthContext } from "../context/authContextValue";

const STORAGE_PREFIX = "summarizer-state-v1";

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  (error.code === "ERR_NETWORK"
    ? "Cannot reach the backend server. Start it from the backend folder."
    : "Unable to generate summary.");

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-bold text-gray-950 dark:text-white">{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-gray-200 px-1.5 py-0.5 text-[0.9em] text-indigo-700 dark:bg-gray-800 dark:text-indigo-300">{part.slice(1, -1)}</code>;
    }

    return <span key={index}>{part}</span>;
  });
}

function SummaryContent({ content }) {
  const lines = content.split(/\r?\n/);

  return (
    <article className="space-y-3 text-sm leading-7 text-gray-700 dark:text-gray-200">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();

        if (!trimmedLine) return <div key={index} className="h-1" aria-hidden="true" />;
        if (/^-{3,}$/.test(trimmedLine)) return <hr key={index} className="my-6 border-gray-200 dark:border-gray-700" />;

        const heading = trimmedLine.match(/^#{1,3}\s+(.+)$/);
        if (heading) {
          return <h2 key={index} className="pt-2 text-xl font-bold text-gray-950 dark:text-white">{renderInline(heading[1])}</h2>;
        }

        const orderedItem = trimmedLine.match(/^\d+\.\s+(.+)$/);
        if (orderedItem) {
          return (
            <div key={index} className="flex gap-3 rounded-lg bg-white px-3 py-2 dark:bg-gray-800/70">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{trimmedLine.match(/^\d+/)[0]}.</span>
              <span>{renderInline(orderedItem[1])}</span>
            </div>
          );
        }

        const bulletItem = trimmedLine.match(/^[-*]\s+(.+)$/);
        if (bulletItem) {
          return (
            <div key={index} className="flex gap-3 px-2">
              <span className="text-indigo-600 dark:text-indigo-400">•</span>
              <span>{renderInline(bulletItem[1])}</span>
            </div>
          );
        }

        return <p key={index}>{renderInline(trimmedLine)}</p>;
      })}
    </article>
  );
}

export default function Summarizer() {
  const { user } = useContext(AuthContext);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const userId = user?._id?.toString();

    setLoading(false);
    setErrorMessage("");

    if (!userId) {
      setFile(null);
      setFileName("");
      setText("");
      setSummary("");
      return;
    }

    try {
      const stored = sessionStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
      if (!stored) {
        setFile(null);
        setFileName("");
        setText("");
        setSummary("");
        return;
      }

      const parsed = JSON.parse(stored);
      setFile(null);
      setFileName(parsed.fileName || "");
      setText(parsed.text || "");
      setSummary(parsed.summary || "");
    } catch {
      setFile(null);
      setFileName("");
      setText("");
      setSummary("");
    }
  }, [user?._id]);

  useEffect(() => {
    const userId = user?._id?.toString();
    if (!userId) return;

    sessionStorage.setItem(
      `${STORAGE_PREFIX}:${userId}`,
      JSON.stringify({
        text,
        summary,
        fileName,
      })
    );
  }, [fileName, summary, text, user?._id]);

  const clearSummary = () => {
    setFile(null);
    setFileName("");
    setText("");
    setSummary("");
    setErrorMessage("");

    const userId = user?._id?.toString();
    if (userId) {
      sessionStorage.removeItem(`${STORAGE_PREFIX}:${userId}`);
    }
  };

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
          accept=".pdf,.doc,.docx,.txt,.md,.csv,.mp3,.wav,.ogg,.m4a,.aac,.flac,.mp4,.mkv,.avi,.mov,.webm,.flv,.wmv,application/pdf,application/x-pdf,audio/*,video/*"
          className="hidden"
          onChange={(e) => {
            const nextFile = e.target.files[0] || null;
            setFile(nextFile);
            setFileName(nextFile?.name || "");
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

      {!file && fileName && summary && (
        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
          Restored summary from this session for: {fileName}
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

      <button
        type="button"
        onClick={clearSummary}
        className="ml-0 w-full md:ml-3 md:w-auto bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all shadow-sm"
      >
        Clear
      </button>

      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        {summary ? (
          <SummaryContent content={summary} />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            AI-generated study notes will appear here...
          </p>
        )}
      </div>
    </div>
  );
}
