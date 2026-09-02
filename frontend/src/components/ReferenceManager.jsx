import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/authContextValue";
import {
  createCustomReference,
  loadCustomReferences,
  saveCustomReferences,
} from "../utils/customReferences";

export default function ReferenceManager() {
  const { user } = useContext(AuthContext);
  const [referenceForm, setReferenceForm] = useState({
    title: "",
    target: "",
    note: "",
  });
  const [customReferences, setCustomReferences] = useState([]);

  const referenceStorageKey = useMemo(() => user?._id || user?.id || "guest", [user]);

  useEffect(() => {
    setCustomReferences(loadCustomReferences(referenceStorageKey));
  }, [referenceStorageKey]);

  useEffect(() => {
    saveCustomReferences(referenceStorageKey, customReferences);
  }, [referenceStorageKey, customReferences]);

  const addCustomReference = (event) => {
    event.preventDefault();

    const title = referenceForm.title.trim();
    const target = referenceForm.target.trim();
    const note = referenceForm.note.trim();

    if (!title || !target) return;

    setCustomReferences((prev) =>
      [{ ...createCustomReference(title, target), note }, ...prev].slice(0, 20)
    );
    setReferenceForm({ title: "", target: "", note: "" });
  };

  const deleteCustomReference = (referenceId) => {
    setCustomReferences((prev) => prev.filter((reference) => reference.id !== referenceId));
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900">
            Personal Library
          </span>
          <h1 className="mt-3 text-3xl font-bold text-gray-950 dark:text-white">My References</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Save links, playlists, videos, or any topic note you want to revisit later.
          </p>
        </div>

        <span className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-gray-500 ring-1 ring-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:ring-gray-700">
          {customReferences.length}
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
        <div className="grid gap-3 md:grid-cols-[0.9fr_1.15fr_1.35fr]">
          <input
            value={referenceForm.title}
            onChange={(event) => setReferenceForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Reference title"
            className="w-full rounded border border-gray-300 bg-white p-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <input
            value={referenceForm.target}
            onChange={(event) => setReferenceForm((prev) => ({ ...prev, target: event.target.value }))}
            placeholder="Paste a link"
            className="w-full rounded border border-gray-300 bg-white p-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <input
            value={referenceForm.note}
            onChange={(event) => setReferenceForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="What is this reference for? (optional)"
            className="w-full rounded border border-gray-300 bg-white p-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={addCustomReference}
            className="w-full rounded bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white md:w-32"
          >
            Add
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {customReferences.length ? (
          customReferences.map((reference) => (
            <div
              key={reference.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{reference.title}</p>
                {reference.note && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{reference.note}</p>}
              </div>

              <button
                type="button"
                onClick={() => window.open(reference.target, "_blank", "noopener,noreferrer")}
                className="shrink-0 rounded border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Open
              </button>

              <button
                type="button"
                onClick={() => deleteCustomReference(reference.id)}
                className="shrink-0 rounded border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                Delete
              </button>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm font-medium text-gray-900 dark:text-white">No references saved yet.</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add a title, link, and optional note to build your own quick-access library.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
