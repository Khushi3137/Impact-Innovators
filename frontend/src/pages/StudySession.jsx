import { useEffect, useState } from "react";
import { endPomodoro, startPomodoro } from "../api/studyApi";

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  (error.code === "ERR_NETWORK"
    ? "Cannot reach the backend server. Start it from the backend folder."
    : "Unable to update study session.");

export default function StudySession() {
  const [duration, setDuration] = useState({
    hours: "0",
    minutes: "25",
    seconds: "0",
  });
  const [remaining, setRemaining] = useState(25 * 60);
  const [active, setActive] = useState(false);
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [focusMode, setFocusMode] = useState("Deep work");
  const [focusGoal, setFocusGoal] = useState("");
  const [sessionNote, setSessionNote] = useState("");

  const durationSeconds =
    (Number(duration.hours) || 0) * 3600 +
    (Number(duration.minutes) || 0) * 60 +
    (Number(duration.seconds) || 0);

  const progress = durationSeconds ? Math.max(0, Math.min(100, (remaining / durationSeconds) * 100)) : 0;
  const sessionState = active ? "In focus" : remaining === 0 ? "Complete" : "Ready when you are";

  const applyPreset = (minutes) => {
    if (active) return;

    const nextDuration = { hours: "0", minutes: String(minutes), seconds: "0" };
    setDuration(nextDuration);
    setRemaining(minutes * 60);
    setMessage("");
    setErrorMessage("");
  };

  const formatSeconds = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  };

  const durationText = [
    Number(duration.hours) ? `${Number(duration.hours)} hr` : null,
    Number(duration.minutes) ? `${Number(duration.minutes)} min` : null,
    Number(duration.seconds) ? `${Number(duration.seconds)} sec` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const inputClasses =
    "h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-center text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400 dark:[color-scheme:dark]";

  const updateDuration = (field, maxValue) => (event) => {
    const rawValue = event.target.value;

    if (rawValue !== "" && !/^\d+$/.test(rawValue)) return;

    const nextValue =
      rawValue === "" ? "" : String(Math.min(maxValue, Math.max(0, Number(rawValue))));
    const nextDuration = { ...duration, [field]: nextValue };
    const nextTotalSeconds =
      (Number(nextDuration.hours) || 0) * 3600 +
      (Number(nextDuration.minutes) || 0) * 60 +
      (Number(nextDuration.seconds) || 0);

    setDuration(nextDuration);
    if (!active) setRemaining(nextTotalSeconds);
  };

  const normalizeDuration = () => {
    setDuration((current) => ({
      hours: String(Number(current.hours) || 0),
      minutes: String(Number(current.minutes) || 0),
      seconds: String(Number(current.seconds) || 0),
    }));
  };

  useEffect(() => {
    if (!active) return undefined;

    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value > 1) return value - 1;

        setActive(false);
        endPomodoro({ sessionId: session?.id, completed: true })
          .then((data) => setMessage(data.message || "Study session completed."))
          .catch((error) => setErrorMessage(getErrorMessage(error)));

        return 0;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [active, session]);

  const formattedTime = formatSeconds(remaining);

  const handleStart = async () => {
    if (durationSeconds < 1) {
      setErrorMessage("Set a duration before starting.");
      return;
    }

    try {
      setErrorMessage("");
      normalizeDuration();
      const data = await startPomodoro({
        duration: Math.max(1, Math.ceil(durationSeconds / 60)),
        subject: "General",
      });
      setSession(data.session);
      setRemaining(durationSeconds);
      setActive(true);
      setMessage(data.message || "Study session started.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleEnd = async (completed = false) => {
    try {
      setActive(false);
      const data = await endPomodoro({
        sessionId: session?.id,
        completed,
      });
      setMessage(data.message || "Study session ended.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleReset = () => {
    setActive(false);
    setRemaining(durationSeconds);
    setMessage("");
  };

  return (
    <div className="mx-auto min-h-full w-full max-w-6xl space-y-6 pb-8">
      <header className="rounded-2xl border border-indigo-100 bg-white px-5 py-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Focus workspace</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-950 dark:text-white">Study Session</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Set a rhythm, protect your attention, and make one small block of progress.
            </p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" : remaining === 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
            {sessionState}
          </span>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          <div className="flex flex-col items-center">
            <div
              className="grid h-64 w-64 place-items-center rounded-full p-3 sm:h-72 sm:w-72"
              style={{ background: `conic-gradient(#4f46e5 ${progress}%, #e5e7eb ${progress}% 100%)` }}
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-white text-center dark:bg-gray-900">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Time remaining</p>
                  <p className="mt-2 text-5xl font-bold tracking-tight text-indigo-600 sm:text-6xl">{formattedTime}</p>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{durationText || "Set a duration"}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid w-full max-w-md grid-cols-3 gap-3">
              {[['hours', 'Hours', 23], ['minutes', 'Minutes', 59], ['seconds', 'Seconds', 59]].map(([field, label, maxValue]) => (
                <label key={field} className="space-y-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    max={maxValue}
                    inputMode="numeric"
                    value={duration[field]}
                    disabled={active}
                    onBlur={normalizeDuration}
                    onChange={updateDuration(field, maxValue)}
                    className={inputClasses}
                  />
                </label>
              ))}
            </div>

            {errorMessage && <div className="mt-5 w-full max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorMessage}</div>}
            {message && <p className="mt-5 text-sm text-green-600 dark:text-green-400">{message}</p>}

            <div className="mt-6 flex w-full max-w-md gap-3">
              <button
                onClick={active ? () => handleEnd(false) : handleStart}
                className="flex-1 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                {active ? "End session" : "Start focusing"}
              </button>
              <button onClick={handleReset} className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                Reset
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
            <h2 className="text-lg font-bold text-gray-950 dark:text-white">Quick durations</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose a starting point, then adjust it above.</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[15, 25, 50].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => applyPreset(minutes)}
                  disabled={active}
                  className={`rounded-xl border px-2 py-3 text-sm font-bold transition ${duration.minutes === String(minutes) && duration.hours === "0" && duration.seconds === "0" ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-gray-700 dark:text-gray-300"} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Session plan</p>
            <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">What do you want to move forward?</h2>
            <input
              value={focusGoal}
              onChange={(event) => setFocusGoal(event.target.value)}
              placeholder="e.g. Finish chapter 3 notes"
              aria-label="Session goal"
              className="mt-5 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />

            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Study mode</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["Deep work", "Review", "Practice"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFocusMode(mode)}
                  className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition ${focusMode === mode ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"}`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <textarea
              value={sessionNote}
              onChange={(event) => setSessionNote(event.target.value)}
              placeholder="Optional note for this session"
              aria-label="Session note"
              rows="3"
              className="mt-4 w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
