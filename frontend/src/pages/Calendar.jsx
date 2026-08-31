import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "study-calendar-events";
const NOTIFIED_STORAGE_KEY = "momentum-planner-notified-events";
const REMINDER_WINDOW_MINUTES = 10;

const todayValue = () => new Date().toISOString().slice(0, 10);

const initialForm = {
  title: "",
  subject: "",
  date: todayValue(),
  startTime: "09:00",
  endTime: "10:00",
  notes: "",
};

const quickSubjects = ["DSA", "DBMS", "OS", "Physics"];

const sortEvents = (events) =>
  [...events].sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));

const getSavedEvents = () => {
  try {
    return sortEvents(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
};

const getSavedNotifiedIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );

const getDuration = (event) => {
  const [startHour, startMinute] = event.startTime.split(":").map(Number);
  const [endHour, endMinute] = event.endTime.split(":").map(Number);
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
};

const formatDuration = (minutes) => {
  if (!minutes) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return [hours ? `${hours}h` : "", mins ? `${mins}m` : ""].filter(Boolean).join(" ");
};

const getEventStartDate = (event) => new Date(`${event.date}T${event.startTime}:00`);

const getMinutesUntilStart = (event) =>
  Math.ceil((getEventStartDate(event).getTime() - Date.now()) / 60000);

const canSendBrowserNotification = () =>
  typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";

const getNotificationPermission = () => {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
};

const getReminderStatus = (permission) => {
  if (permission === "granted") return "Browser alerts will appear around 10 minutes before a block starts.";
  if (permission === "denied") return "Browser alerts are blocked. Allow notifications from your browser site settings.";
  if (permission === "unsupported") return "Browser alerts are not supported here, but in-page reminders still work.";
  return "In-page reminders always work while this planner is open.";
};

export default function Calendar() {
  const [events, setEvents] = useState(getSavedEvents);
  const [formData, setFormData] = useState(initialForm);
  const [filterDate, setFilterDate] = useState(todayValue());
  const [errorMessage, setErrorMessage] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission);
  const [tick, setTick] = useState(Date.now());
  const notifiedIdsRef = useRef(getSavedNotifiedIds());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    const reminderTimer = window.setInterval(() => setTick(Date.now()), 15000);

    return () => window.clearInterval(reminderTimer);
  }, []);

  const selectedDayEvents = useMemo(
    () => events.filter((event) => event.date === filterDate),
    [events, filterDate]
  );

  const upcomingEvents = useMemo(
    () => events.filter((event) => event.date >= todayValue() && !event.completed).slice(0, 5),
    [events]
  );

  const reminderEvents = useMemo(
    () =>
      events.filter((event) => {
        const minutesLeft = getMinutesUntilStart(event);
        return !event.completed && minutesLeft > 0 && minutesLeft <= REMINDER_WINDOW_MINUTES;
      }),
    [events, tick]
  );

  useEffect(() => {
    if (!canSendBrowserNotification()) return;

    reminderEvents.forEach((event) => {
      if (notifiedIdsRef.current.has(event.id)) return;

      const minutesLeft = getMinutesUntilStart(event);
      new Notification("Momentum Planner reminder", {
        body: `${event.title} starts in about ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
      });

      notifiedIdsRef.current.add(event.id);
      localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify([...notifiedIdsRef.current]));
    });
  }, [reminderEvents, notificationPermission]);

  const stats = useMemo(() => {
    const plannedMinutes = selectedDayEvents.reduce((total, event) => total + getDuration(event), 0);
    const completed = events.filter((event) => event.completed).length;
    const activeSubjects = new Set(events.map((event) => event.subject)).size;

    return {
      selectedCount: selectedDayEvents.length,
      plannedTime: formatDuration(plannedMinutes),
      completed,
      activeSubjects,
    };
  }, [events, selectedDayEvents]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrorMessage("");
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      setErrorMessage("Add a study task before saving it.");
      return;
    }

    if (formData.endTime <= formData.startTime) {
      setErrorMessage("End time must be after start time.");
      return;
    }

    const newEvent = {
      id: crypto.randomUUID(),
      ...formData,
      title: formData.title.trim(),
      subject: formData.subject.trim() || "General",
      notes: formData.notes.trim(),
      completed: false,
    };

    setEvents((prev) => sortEvents([...prev, newEvent]));
    setFilterDate(newEvent.date);
    setFormData({ ...initialForm, date: newEvent.date });

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(setNotificationPermission);
    }
  };

  const toggleDone = (id) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === id ? { ...event, completed: !event.completed } : event
      )
    );
  };

  const deleteEvent = (id) => {
    setEvents((prev) => prev.filter((event) => event.id !== id));
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-900">
              Study Planner
            </span>
            <h1 className="mt-3 text-3xl font-bold text-gray-950 dark:text-white">Momentum Planner</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Build a focused study rhythm with timed blocks, subject goals, and a clean daily queue.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={requestNotificationPermission}
                disabled={notificationPermission === "granted" || notificationPermission === "unsupported"}
                className="rounded border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-950/70 dark:disabled:border-gray-800 dark:disabled:bg-gray-950 dark:disabled:text-gray-600"
              >
                {notificationPermission === "granted" ? "Reminders Enabled" : "Enable Reminders"}
              </button>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {getReminderStatus(notificationPermission)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Today" value={stats.selectedCount} />
            <Stat label="Planned" value={stats.plannedTime} />
            <Stat label="Done" value={stats.completed} />
            <Stat label="Subjects" value={stats.activeSubjects} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Create Focus Block</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Schedule one concrete study action.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Task</span>
              <input
                value={formData.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="Revise paging, solve 10 arrays problems..."
                className="w-full rounded border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-500 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder-gray-400 dark:focus:ring-cyan-950"
              />
            </label>

            <div>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Subject</span>
                <input
                  value={formData.subject}
                  onChange={(event) => updateField("subject", event.target.value)}
                  placeholder="Operating System"
                  className="w-full rounded border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-500 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder-gray-400 dark:focus:ring-cyan-950"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {quickSubjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => updateField("subject", subject)}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-cyan-700 dark:hover:text-cyan-300"
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Date</span>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(event) => updateField("date", event.target.value)}
                  className="w-full rounded border border-gray-300 bg-white p-3 text-gray-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-cyan-950"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Start</span>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(event) => updateField("startTime", event.target.value)}
                  className="w-full rounded border border-gray-300 bg-white p-3 text-gray-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-cyan-950"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">End</span>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(event) => updateField("endTime", event.target.value)}
                  className="w-full rounded border border-gray-300 bg-white p-3 text-gray-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-cyan-950"
                />
              </label>
            </div>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Notes</span>
              <textarea
                value={formData.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Goal, resource link, reminder, or exam note"
                className="min-h-24 w-full resize-y rounded border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-500 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder-gray-400 dark:focus:ring-cyan-950"
              />
            </label>

            {errorMessage && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-700"
            >
              Add Focus Block
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
          {reminderEvents.length > 0 && (
            <div className="mb-5 rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">
              <p className="font-semibold">Starting soon</p>
              <div className="mt-2 space-y-1">
                {reminderEvents.map((event) => {
                  const minutesLeft = getMinutesUntilStart(event);

                  return (
                    <p key={event.id}>
                      {event.title} starts in about {minutesLeft} minute{minutesLeft === 1 ? "" : "s"}.
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Daily Flow</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {formatDate(filterDate)} has {selectedDayEvents.length} planned blocks.
              </p>
            </div>
            <input
              type="date"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
              className="w-full rounded border border-gray-300 bg-white p-3 text-gray-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-cyan-950 sm:w-48"
            />
          </div>

          <EventList events={selectedDayEvents} onDelete={deleteEvent} onToggleDone={toggleDone} />
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">Next Up</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{upcomingEvents.length} active blocks queued.</p>
          </div>
        </div>
        <EventList compact events={upcomingEvents} onDelete={deleteEvent} onToggleDone={toggleDone} />
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
      <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{value}</p>
    </div>
  );
}

function EventList({ events, compact = false, onDelete, onToggleDone }) {
  if (!events.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
        No focus blocks here yet.
      </div>
    );
  }

  return (
    <div className={compact ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
      {events.map((event) => (
        <article
          key={event.id}
          className={`rounded-lg border p-4 transition ${
            event.completed
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
              : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                  {event.subject}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {formatDate(event.date)} | {event.startTime}-{event.endTime}
                </span>
              </div>
              <h3 className={`mt-3 font-semibold text-gray-950 dark:text-white ${event.completed ? "line-through opacity-70" : ""}`}>
                {event.title}
              </h3>
              {!compact && event.notes && (
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">{event.notes}</p>
              )}
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onToggleDone(event.id)}
                className="rounded border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-900 dark:bg-gray-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                {event.completed ? "Undo" : "Done"}
              </button>
              <button
                type="button"
                onClick={() => onDelete(event.id)}
                className="rounded border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900 dark:bg-gray-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
              >
                Delete
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
