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

  const durationSeconds =
    (Number(duration.hours) || 0) * 3600 +
    (Number(duration.minutes) || 0) * 60 +
    (Number(duration.seconds) || 0);

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
    <div className="mx-auto w-full max-w-md space-y-6 rounded-xl bg-white p-5 text-center shadow-sm dark:bg-gray-800 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Study Session</h1>

      <div className="text-5xl font-bold text-indigo-600 sm:text-6xl">{formattedTime}</div>

      <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
        <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <span>Hours</span>
          <input
            type="number"
            min="0"
            max="23"
            inputMode="numeric"
            value={duration.hours}
            disabled={active}
            onBlur={normalizeDuration}
            onChange={updateDuration("hours", 23)}
            className={inputClasses}
          />
        </label>
        <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <span>Minutes</span>
          <input
            type="number"
            min="0"
            max="59"
            inputMode="numeric"
            value={duration.minutes}
            disabled={active}
            onBlur={normalizeDuration}
            onChange={updateDuration("minutes", 59)}
            className={inputClasses}
          />
        </label>
        <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <span>Seconds</span>
          <input
            type="number"
            min="0"
            max="59"
            inputMode="numeric"
            value={duration.seconds}
            disabled={active}
            onBlur={normalizeDuration}
            onChange={updateDuration("seconds", 59)}
            className={inputClasses}
          />
        </label>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      )}

      {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}

      <div className="flex justify-center gap-4">
        <button
          onClick={active ? () => handleEnd(false) : handleStart}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
        >
          {active ? "Stop" : "Start"}
        </button>
        <button onClick={handleReset} className="px-4 py-2 bg-gray-200 rounded-lg dark:bg-gray-700">
          Reset
        </button>
      </div>

      <p className="mx-auto max-w-full text-balance text-gray-500 dark:text-gray-400">
        Focus for {durationText || "0 sec"}. Stay distraction-free.
      </p>
    </div>
  );
}
