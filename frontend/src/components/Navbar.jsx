import { NavLink, useNavigate } from "react-router-dom";
import { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../context/authContextValue";
import { ThemeContext } from "../context/themeContextValue";

const getInitials = (name = "", email = "") => {
  const source = name.trim() || email.trim();
  if (!source) return "S";

  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { dark, setDark } = useContext(ThemeContext);

  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const profileRef = useRef(null);

  const avatarUrl = user?.avatar || user?.picture || user?.photoURL;
  const initials = getInitials(user?.name, user?.email);
  const course =
    user?.major && !["major", "not specified"].includes(String(user.major).trim().toLowerCase())
      ? user.major
      : null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="shrink-0 text-left text-xl font-bold text-indigo-600 dark:text-indigo-400"
        >
          Student Assistant
        </button>

        <div className="hidden gap-4 text-sm font-medium md:flex">
          <NavItem to="/dashboard" label="Dashboard" />
          <NavItem to="/summarizer" label="Summarizer" />
          <NavItem to="/quiz-session" label="Quiz Session" />
          <NavItem to="/doubt-solver" label="Doubt Solver" />
          <NavItem to="/study-session" label="Study Session" />
          <NavItem to="/groups" label="Study Groups" />
          <NavItem to="/momentum-planner" label="Momentum Planner" />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDark((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {dark ? <MoonIcon /> : <SunIcon />}
          </button>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="flex items-center rounded-full border border-transparent p-1 transition hover:border-indigo-200 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:border-gray-700 dark:hover:bg-gray-800"
              aria-label="Open profile menu"
              aria-expanded={open}
            >
              <Avatar avatarUrl={avatarUrl} initials={initials} size="sm" />
            </button>

            {open && (
              <div className="absolute right-0 z-50 mt-3 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-100 p-4 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <Avatar avatarUrl={avatarUrl} initials={initials} size="md" />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {user?.name || "Student"}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {user?.email || "No email added"}
                      </p>
                    </div>
                  </div>

                  {(user?.college || course || user?.year) && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      {user?.college && <ProfileField label="College" value={user.college} />}
                      {course && <ProfileField label="Course / Branch" value={course} />}
                      {user?.year && <ProfileField label="Year" value={`Year ${user.year}`} />}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 md:hidden"
            onClick={() => setMenu((prev) => !prev)}
            aria-label="Open navigation menu"
            aria-expanded={menu}
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {menu && (
        <div className="border-t border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-900 md:hidden">
          <MobileItem to="/dashboard" label="Dashboard" />
          <MobileItem to="/summarizer" label="Summarizer" />
          <MobileItem to="/quiz-session" label="Quiz Session" />
          <MobileItem to="/doubt-solver" label="Doubt Solver" />
          <MobileItem to="/study-session" label="Study Session" />
          <MobileItem to="/groups" label="Study Groups" />
          <MobileItem to="/momentum-planner" label="Momentum Planner" />
        </div>
      )}
    </nav>
  );
}

function Avatar({ avatarUrl, initials, size }) {
  const sizeClasses = size === "md" ? "h-12 w-12 text-base" : "h-9 w-9 text-sm";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClasses} rounded-full object-cover ring-2 ring-indigo-100 dark:ring-gray-700`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} flex shrink-0 items-center justify-center rounded-full bg-indigo-600 font-semibold text-white ring-2 ring-indigo-100 dark:ring-gray-700`}
    >
      {initials}
    </div>
  );
}

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-md px-3 py-1 transition ${
          isActive
            ? "bg-indigo-100 text-indigo-600 dark:bg-gray-800 dark:text-indigo-400"
            : "text-gray-600 hover:text-indigo-600 dark:text-gray-300"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function MobileItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className="block border-b border-gray-100 px-4 py-3 text-gray-700 dark:border-gray-700 dark:text-gray-200"
    >
      {label}
    </NavLink>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
      <p className="text-[11px] font-medium uppercase text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p className="mt-0.5 truncate font-medium text-gray-700 dark:text-gray-200">{value}</p>
    </div>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m0-12.72 1.42 1.42m9.88 9.88 1.42 1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
