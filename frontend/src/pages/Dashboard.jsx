import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getDashboardData,
} from "../api/studyApi";
import { ThemeContext } from "../context/themeContextValue";

const CALENDAR_STORAGE_KEY = "study-calendar-events";
const POLL_MS = 10000;
const WEEK_DAYS = 7;

const cardClasses =
  "rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  (error?.code === "ERR_NETWORK"
    ? "Cannot reach the backend server. Start it from the backend folder."
    : "Some live dashboard data could not be loaded.");

const minutesValue = (value) => Math.max(0, Math.round(Number(value || 0)));

const formatDuration = (minutes = 0) => {
  const total = minutesValue(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
};

const formatDateTime = (value) => {
  if (!value) return "No date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStartOfDay = (date = new Date()) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getTodayCalendarCount = () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const events = JSON.parse(localStorage.getItem(CALENDAR_STORAGE_KEY) || "[]");
    return events.filter((event) => event.date === today && !event.completed).length;
  } catch {
    return 0;
  }
};

const makeEmptyWeek = () => {
  const today = getStartOfDay();

  return Array.from({ length: WEEK_DAYS }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (WEEK_DAYS - 1 - index));

    return {
      key: date.toISOString().slice(0, 10),
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      minutes: 0,
      sessions: 0,
    };
  });
};

const buildSubjectRows = (bySubject = {}, sessions = []) => {
  const rows = Object.entries(bySubject).map(([subject, value]) => ({
    subject,
    minutes: minutesValue(value?.totalTime),
    sessions: value?.sessions || 0,
  }));

  if (rows.length) {
    return rows.sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  }

  const grouped = sessions.reduce((acc, session) => {
    const subject = session.subject || "General";
    acc[subject] = acc[subject] || { subject, minutes: 0, sessions: 0 };
    acc[subject].minutes += minutesValue(session.duration);
    acc[subject].sessions += 1;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.minutes - a.minutes).slice(0, 5);
};

export default function Dashboard() {
  const { dark } = useContext(ThemeContext);
  const [dashboard, setDashboard] = useState({
    studyStats: {},
    sessions: [],
    tasks: [],
    taskStats: {},
    streak: {},
    today: {},
    calendarToday: 0,
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isLoadingRef = useRef(false);

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getDashboardData();

      setDashboard({
        studyStats: data.studyStats || {},
        sessions: data.sessions || [],
        tasks: data.tasks || [],
        taskStats: data.taskStats || data.studyStats?.tasks || {},
        streak: data.streak || {},
        today: data.today || {},
        calendarToday: getTodayCalendarCount(),
      });
      setErrors([]);
      setLastUpdated(new Date());
    } catch (error) {
      setErrors([getErrorMessage(error)]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      loadDashboard();
    }, 0);

    const intervalId = window.setInterval(() => {
      if (!document.hidden) loadDashboard({ silent: true });
    }, POLL_MS);

    const handleFocus = () => loadDashboard({ silent: true });
    const handleStorage = (event) => {
      if (!event.key || event.key === CALENDAR_STORAGE_KEY) {
        setDashboard((prev) => ({ ...prev, calendarToday: getTodayCalendarCount() }));
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadDashboard]);

  const weekData = useMemo(() => {
    const rows = makeEmptyWeek();
    const byKey = new Map(rows.map((item) => [item.key, item]));

    dashboard.sessions.forEach((session) => {
      const date = new Date(session.startTime);
      if (Number.isNaN(date.getTime())) return;

      const key = date.toISOString().slice(0, 10);
      const row = byKey.get(key);
      if (!row) return;

      row.minutes += minutesValue(session.duration);
      row.sessions += 1;
    });

    return rows;
  }, [dashboard.sessions]);

  const subjectRows = useMemo(
    () => buildSubjectRows(dashboard.studyStats.bySubject, dashboard.sessions),
    [dashboard.studyStats.bySubject, dashboard.sessions]
  );

  const upcomingTasks = useMemo(() => {
    const now = new Date();
    return dashboard.tasks
      .filter((task) => task.status !== "completed")
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5)
      .map((task) => ({
        ...task,
        overdue: task.dueDate && new Date(task.dueDate) < now,
      }));
  }, [dashboard.tasks]);

  const totalStudyMinutes = minutesValue(dashboard.studyStats.totalStudyTime);
  const todayMinutes = minutesValue(dashboard.today.studyTime);
  const weeklyGoal = 10 * 60;
  const dailyGoal = 4 * 60;
  const weeklyGoalPercent = Math.min(100, Math.round((totalStudyMinutes / weeklyGoal) * 100));
  const todayGoalPercent = Math.min(100, Math.round((todayMinutes / dailyGoal) * 100));
  const completionRate = Math.round(dashboard.taskStats.completionRate || 0);

  const axisColor = dark ? "#9ca3af" : "#64748b";
  const gridColor = dark ? "#1f2937" : "#e5e7eb";
  const tooltipBg = dark ? "#111827" : "#ffffff";
  const tooltipText = dark ? "#f9fafb" : "#111827";

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-5 px-1">
      <section className={`${cardClasses} p-5 sm:p-6`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
                Live data
              </span>
              {refreshing && (
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900">
                  Refreshing
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-bold text-gray-950 dark:text-white">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Your study sessions, tasks, quiz practice, and calendar activity update automatically from your account data.
            </p>
            <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Preparing your dashboard"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadDashboard({ silent: true })}
            disabled={loading || refreshing}
            className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
          >
            Refresh
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {errors[0]}
          </div>
        )}
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="This Week"
          value={formatDuration(totalStudyMinutes)}
          helper={`${dashboard.studyStats.totalSessions || 0} sessions`}
          accent="indigo"
        />
        <MetricCard
          label="Today"
          value={formatDuration(todayMinutes)}
          helper={`${todayGoalPercent}% of 4h goal`}
          accent="emerald"
        />
        <MetricCard
          label="Tasks Done"
          value={`${completionRate}%`}
          helper={`${dashboard.taskStats.completed || 0}/${dashboard.taskStats.total || 0} completed`}
          accent="amber"
        />
        <MetricCard
          label="AI Practice"
          value="Quiz"
          helper="Generate from any topic"
          accent="sky"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.55fr]">
        <div className={`${cardClasses} min-w-0 p-5 sm:p-6`}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-950 dark:text-white">Study Time</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last 7 days from completed sessions</p>
            </div>
            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              {weeklyGoalPercent}% weekly goal
            </span>
          </div>

          <div className="mt-5 h-72 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekData} margin={{ left: -18, right: 6, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="studyMinutes" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="day" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke={axisColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}m`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: gridColor,
                    borderRadius: "8px",
                    color: tooltipText,
                  }}
                  formatter={(value, name) =>
                    name === "minutes" ? [formatDuration(value), "Study time"] : [value, "Sessions"]
                  }
                  labelStyle={{ color: tooltipText }}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  fill="url(#studyMinutes)"
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${cardClasses} p-5 sm:p-6`}>
          <h2 className="text-lg font-bold text-gray-950 dark:text-white">Today</h2>
          <div className="mt-5 space-y-5">
            <ProgressBar label="Study goal" value={todayGoalPercent} detail={`${formatDuration(todayMinutes)} / 4h`} />
            <ProgressBar label="Task completion" value={completionRate} detail={`${completionRate}%`} />
            <ProgressBar label="Weekly goal" value={weeklyGoalPercent} detail={`${formatDuration(totalStudyMinutes)} / 10h`} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <SmallStat label="Streak" value={`${dashboard.streak.streak || 0} days`} />
            <SmallStat label="Calendar" value={dashboard.calendarToday} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className={`${cardClasses} min-w-0 p-5 sm:p-6`}>
          <h2 className="text-lg font-bold text-gray-950 dark:text-white">Subject Focus</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Where your study minutes went this week</p>

          {subjectRows.length ? (
            <div className="mt-5 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectRows} layout="vertical" margin={{ left: 8, right: 8, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="subject"
                    width={90}
                    stroke={axisColor}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: gridColor,
                      borderRadius: "8px",
                      color: tooltipText,
                    }}
                    formatter={(value) => [formatDuration(value), "Study time"]}
                    labelStyle={{ color: tooltipText }}
                  />
                  <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
                    {subjectRows.map((_, index) => (
                      <Cell key={index} fill={["#4f46e5", "#059669", "#d97706", "#0284c7", "#be123c"][index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text="Complete a study session to see subject focus here." />
          )}
        </div>

        <div className={`${cardClasses} p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950 dark:text-white">Upcoming Tasks</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {dashboard.taskStats.overdue || 0} overdue, {dashboard.taskStats.inProgress || 0} in progress
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {upcomingTasks.length ? (
              upcomingTasks.map((task) => <TaskRow key={task._id} task={task} />)
            ) : (
              <EmptyState text="No open tasks. Add tasks from your study tools and they will appear here." />
            )}
          </div>
        </div>
      </section>

      <section className={`${cardClasses} p-5 sm:p-6`}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-950 dark:text-white">Recent Study Sessions</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Newest activity from your account</p>
          </div>
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            {dashboard.sessions.length} loaded
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {dashboard.sessions.length ? (
            dashboard.sessions.slice(0, 6).map((session) => <SessionRow key={session._id} session={session} />)
          ) : (
            <EmptyState text={loading ? "Loading study sessions..." : "No sessions yet. Start a Study Session and this will update automatically."} />
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, helper, accent }) {
  const accents = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
    amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    sky: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
  };

  return (
    <article className={`${cardClasses} min-w-0 p-5`}>
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ring-1 ${accents[accent]}`}>
        {label}
      </span>
      <p className="mt-4 break-words text-3xl font-bold text-gray-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helper}</p>
    </article>
  );
}

function ProgressBar({ label, value, detail }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-200">{label}</span>
        <span className="text-gray-500 dark:text-gray-400">{detail}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-2 rounded-full bg-indigo-600 transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-950">
      <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-950 dark:text-white">{value}</p>
    </div>
  );
}

function TaskRow({ task }) {
  const priorityClasses = {
    urgent: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
    high: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    medium: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
    low: "bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
  };

  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-gray-950 dark:text-white">{task.title}</h3>
          <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
            {task.subject || "General"} | Due {formatDateTime(task.dueDate)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${priorityClasses[task.priority] || priorityClasses.medium}`}>
          {task.overdue ? "Overdue" : task.priority || "medium"}
        </span>
      </div>
    </article>
  );
}

function SessionRow({ session }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-gray-950 dark:text-white">
            {session.subject || "General"} - {session.topic || "Study session"}
          </h3>
          <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
            {formatDateTime(session.startTime)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 dark:bg-gray-900 dark:text-indigo-300 dark:ring-indigo-900">
          {session.duration ? formatDuration(session.duration) : "Active"}
        </span>
      </div>
      {session.productivityScore && (
        <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">
          Focus score: {session.productivityScore}/10
        </p>
      )}
    </article>
  );
}

function EmptyState({ text }) {
  return (
    <p className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
      {text}
    </p>
  );
}
