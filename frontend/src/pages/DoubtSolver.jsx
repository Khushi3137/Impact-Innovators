import { useState } from "react";
import { solveDoubt } from "../api/geminiApi";

const getErrorMessage = (error) =>
  error.response?.data?.error ||
  error.response?.data?.message ||
  (error.code === "ERR_NETWORK"
    ? "Cannot reach the backend server. Start it from the backend folder."
    : "Unable to solve this doubt right now.");

const stripMarkdown = (text) =>
  String(text || "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

const splitInlineBold = (text) =>
  String(text || "").split(/(\*\*.*?\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-gray-950 dark:text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );

const SolutionRenderer = ({ text }) => {
  const blocks = [];
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  let codeLines = [];
  let inCode = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCode) {
        blocks.push({ type: "code", content: codeLines.join("\n") });
        codeLines = [];
      }
      inCode = !inCode;
      return;
    }

    if (inCode) {
      codeLines.push(line);
      return;
    }

    if (!trimmed) {
      blocks.push({ type: "space", key: index });
      return;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      blocks.push({ type: "heading", content: stripMarkdown(trimmed) });
      return;
    }

    if (/^(\*\*)?(short answer|final answer|answer)(\*\*)?\s*:/i.test(trimmed)) {
      const [, , label] = trimmed.match(/^(\*\*)?(short answer|final answer|answer)(\*\*)?\s*:/i) || [];
      blocks.push({
        type: "callout",
        label: stripMarkdown(label || "Answer"),
        content: stripMarkdown(trimmed.replace(/^(\*\*)?(short answer|final answer|answer)(\*\*)?\s*:/i, "")),
      });
      return;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      blocks.push({
        type: "step",
        number: trimmed.match(/^(\d+)/)?.[1],
        content: trimmed.replace(/^\d+[.)]\s+/, ""),
      });
      return;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      blocks.push({ type: "bullet", content: trimmed.replace(/^[-*]\s+/, "") });
      return;
    }

    blocks.push({ type: "paragraph", content: trimmed });
  });

  if (codeLines.length) {
    blocks.push({ type: "code", content: codeLines.join("\n") });
  }

  const compactBlocks = blocks.filter((block, index, all) => {
    if (block.type !== "space") return true;
    return all[index - 1]?.type !== "space" && all[index + 1]?.type !== "space";
  });

  return (
    <div className="space-y-4">
      {compactBlocks.map((block, index) => {
        if (block.type === "space") return <div key={index} className="h-1" />;

        if (block.type === "heading") {
          return (
            <h3 key={index} className="border-b border-gray-200 pb-2 text-base font-bold text-gray-950 dark:border-gray-800 dark:text-white">
              {block.content}
            </h3>
          );
        }

        if (block.type === "callout") {
          return (
            <div key={index} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">{block.label}</p>
              <p className="mt-2 leading-7 text-gray-800 dark:text-gray-100">{splitInlineBold(block.content)}</p>
            </div>
          );
        }

        if (block.type === "step") {
          return (
            <div key={index} className="flex gap-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-950">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {block.number}
              </span>
              <p className="pt-0.5 text-sm leading-7 text-gray-800 dark:text-gray-100">{splitInlineBold(block.content)}</p>
            </div>
          );
        }

        if (block.type === "bullet") {
          return (
            <div key={index} className="flex gap-3 text-sm leading-7 text-gray-800 dark:text-gray-100">
              <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
              <p>{splitInlineBold(block.content)}</p>
            </div>
          );
        }

        if (block.type === "code") {
          return (
            <pre key={index} className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-sm leading-6 text-gray-100">
              <code>{block.content}</code>
            </pre>
          );
        }

        return (
          <p key={index} className="text-sm leading-7 text-gray-800 dark:text-gray-100">
            {splitInlineBold(block.content)}
          </p>
        );
      })}
    </div>
  );
};

export default function DoubtSolver() {
  const [formData, setFormData] = useState({
    subject: "",
    problem: "",
  });
  const [discussion, setDiscussion] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const latestSolution = discussion.at(-1)?.answer || "";
  const hasDiscussion = discussion.length > 0;

  const copySolution = async () => {
    if (!latestSolution) return;
    await navigator.clipboard.writeText(latestSolution);
  };

  const copyDiscussion = async () => {
    if (!hasDiscussion) return;

    const text = discussion
      .map((item, index) => `Question ${index + 1}: ${item.question}\n\nAnswer:\n${item.answer}`)
      .join("\n\n---\n\n");

    await navigator.clipboard.writeText(text);
  };

  const startNewDiscussion = () => {
    setDiscussion([]);
    setFormData((prev) => ({ ...prev, problem: "" }));
    setErrorMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const nextQuestion = formData.problem.trim();
    if (!nextQuestion) return;

    try {
      setLoading(true);
      setErrorMessage("");

      const context = discussion
        .slice(-4)
        .map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`)
        .join("\n\n");

      const data = await solveDoubt({
        problem: nextQuestion,
        subject: formData.subject.trim() || "General",
        context,
      });

      setDiscussion((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          question: nextQuestion,
          answer: data.solution || data.response || "",
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setFormData((prev) => ({ ...prev, problem: "" }));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const openGfgReferences = () => {
    const query = [formData.subject, formData.problem].filter(Boolean).join(" ").trim();
    if (!query) return;

    window.open(
      `https://www.geeksforgeeks.org/search/?gq=${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900">
          AI Tutor
        </span>
        <h1 className="mt-3 text-3xl font-bold text-gray-950 dark:text-white">Doubt Solver</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
          Ask a question, then continue with follow-ups without losing the earlier explanation.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Subject</span>
            <input
              value={formData.subject}
              onChange={(event) => setFormData((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Maths, Physics, DSA, DBMS..."
              className="w-full rounded border border-gray-300 p-3 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Your Doubt</span>
            <textarea
              value={formData.problem}
              onChange={(event) => setFormData((prev) => ({ ...prev, problem: event.target.value }))}
              placeholder={hasDiscussion ? "Ask a follow-up on this discussion..." : "Type the question or topic you want explained..."}
              className="min-h-72 w-full resize-y rounded border border-gray-300 p-3 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
          >
            {loading ? "Solving..." : hasDiscussion ? "Ask Follow-up" : "Solve Doubt"}
          </button>

          {hasDiscussion && (
            <button
              type="button"
              onClick={startNewDiscussion}
              className="w-full rounded border border-gray-200 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              New Discussion
            </button>
          )}

          <button
            type="button"
            onClick={openGfgReferences}
            disabled={!formData.problem.trim() && !formData.subject.trim()}
            className="w-full rounded border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/70 dark:disabled:border-gray-800 dark:disabled:bg-gray-900 dark:disabled:text-gray-600"
          >
            View GFG References
          </button>
        </form>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {errorMessage}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">Discussion</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {hasDiscussion ? `${discussion.length} message${discussion.length === 1 ? "" : "s"}` : "Step-by-step explanation from AI"}
            </p>
          </div>
          {hasDiscussion && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copySolution}
                className="rounded border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Copy Last
              </button>
              <button
                type="button"
                onClick={copyDiscussion}
                className="rounded border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Copy All
              </button>
            </div>
          )}
        </div>

        {hasDiscussion ? (
          <div className="mt-5 space-y-5">
            {discussion.map((item, index) => (
              <article key={item.id} className="space-y-3">
                <div className="ml-auto max-w-[88%] rounded-lg bg-indigo-600 p-4 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase text-indigo-100">You</p>
                    <p className="text-xs text-indigo-100">{item.createdAt}</p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.question}</p>
                </div>

                <div className="max-w-[94%] rounded-lg border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <p className="mb-4 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                    AI Tutor {index === discussion.length - 1 ? "Latest" : ""}
                  </p>
                  <SolutionRenderer text={item.answer} />
                </div>
              </article>
            ))}

            {loading && (
              <div className="max-w-[94%] rounded-lg border border-gray-100 bg-gray-50 p-5 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
                Thinking through your follow-up...
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
            Your solved explanation will appear here.
          </div>
        )}
      </section>
    </div>
  );
}
