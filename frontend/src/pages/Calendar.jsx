import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "study-calendar-events";

const todayValue = () => new Date().toISOString().slice(0, 10);

const initialForm = {
  title: "",
  subject: "",
  date: todayValue(),
  startTime: "09:00",
  endTime: "10:00",
  notes: "",
};

const sortEvents = (events) =>
  [...events].sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));

const getSavedEvents = () => {
  try {
    return sortEvents(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
};

export default function Calendar() {
  const [events, setEvents] = useState(getSavedEvents);
  const [formData, setFormData] = useState(initialForm);
  const [filterDate, setFilterDate] = useState(todayValue());
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  const selectedDayEvents = useMemo(
    () => events.filter((event) => event.date === filterDate),
    [events, filterDate]
  );

  const upcomingEvents = useMemo(
    () => events.filter((event) => event.date >= todayValue()).slice(0, 5),
    [events]
  );

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrorMessage("");
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Plan study sessions, revision blocks, exams, and reminders.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:grid-cols-2"
      >
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Study Task</span>
          <input
            value={formData.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Example: Revise chapter 3 formulas"
            className="w-full rounded border border-gray-300 p-3 text-gray-900 placeholder-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Subject</span>
          <input
            value={formData.subject}
            onChange={(event) => updateField("subject", event.target.value)}
            placeholder="Example: Physics"
            className="w-full rounded border border-gray-300 p-3 text-gray-900 placeholder-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Date</span>
          <input
            type="date"
            value={formData.date}
            onChange={(event) => updateField("date", event.target.value)}
            className="w-full rounded border border-gray-300 p-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Start Time</span>
          <input
            type="time"
            value={formData.startTime}
            onChange={(event) => updateField("startTime", event.target.value)}
            className="w-full rounded border border-gray-300 p-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">End Time</span>
          <input
            type="time"
            value={formData.endTime}
            onChange={(event) => updateField("endTime", event.target.value)}
            className="w-full rounded border border-gray-300 p-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>

        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Notes</span>
          <textarea
            value={formData.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Add goals, links, or reminders for this session"
            className="min-h-24 w-full rounded border border-gray-300 p-3 text-gray-900 placeholder-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
          />
        </label>

        {errorMessage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:col-span-2">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          className="rounded bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 md:col-span-2"
        >
          Add To Calendar
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Selected Day</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{selectedDayEvents.length} sessions planned</p>
            </div>
            <input
              type="date"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
              className="rounded border border-gray-300 p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>

          <EventList events={selectedDayEvents} onDelete={deleteEvent} onToggleDone={toggleDone} />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming</h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{upcomingEvents.length} next sessions</p>
          <EventList compact events={upcomingEvents} onDelete={deleteEvent} onToggleDone={toggleDone} />
        </section>
      </div>
    </div>
  );
}

function EventList({ events, compact = false, onDelete, onToggleDone }) {
  if (!events.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
        No study sessions for this view.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <article
          key={event.id}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-indigo-600 dark:text-indigo-400">
                {event.subject} | {event.date} | {event.startTime}-{event.endTime}
              </p>
              <h3 className={`mt-1 font-semibold text-gray-900 dark:text-white ${event.completed ? "line-through opacity-70" : ""}`}>
                {event.title}
              </h3>
              {!compact && event.notes && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{event.notes}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onToggleDone(event.id)}
                className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                {event.completed ? "Undo" : "Done"}
              </button>
              <button
                type="button"
                onClick={() => onDelete(event.id)}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
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
