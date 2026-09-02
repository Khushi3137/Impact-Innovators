import { NavLink, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { ThemeContext } from "../context/ThemeContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { dark, setDark } = useContext(ThemeContext);

  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">

        {/* Logo */}
        <div
          onClick={() => navigate("/dashboard")}
          className="text-xl font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
        >
          Student Assistant
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex gap-4 text-sm font-medium">
          <NavItem to="/dashboard" label="Dashboard" />
          <NavItem to="/summarizer" label="Summarizer" />
          <NavItem to="/flashcards" label="Flashcards" />
          <NavItem to="/study-session" label="Study Session" />
          <NavItem to="/groups" label="Groups" />
          <NavItem to="/calendar" label="Calendar" />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDark(prev => !prev)}
            className="text-xl"
            title="Toggle Theme"
          >
            {dark ? "🌙" : "☀️"}
          </button>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm">
                {user?.name?.[0] || "S"}
              </div>
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow">
                <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                  {user?.name}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-xl"
            onClick={() => setMenu(!menu)}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menu && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-t dark:border-gray-700">
          <MobileItem to="/dashboard" label="Dashboard" />
          <MobileItem to="/summarizer" label="Summarizer" />
          <MobileItem to="/flashcards" label="Flashcards" />
          <MobileItem to="/study-session" label="Study Session" />
          <MobileItem to="/groups" label="Groups" />
          <MobileItem to="/calendar" label="Calendar" />
        </div>
      )}
    </nav>
  );
}

/* Desktop Nav Item */
function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-1 rounded-md ${
          isActive
            ? "bg-indigo-100 text-indigo-600 dark:bg-gray-800 dark:text-indigo-400"
            : "text-gray-600 dark:text-gray-300 hover:text-indigo-600"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

/* Mobile Nav Item */
function MobileItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className="block px-4 py-3 border-b dark:border-gray-700"
    >
      {label}
    </NavLink>
  );
}


// import { Link } from "react-router-dom";

// export default function Navbar() {
//   return (
//     <nav className="bg-white shadow-md">
//       <div className="max-w-7xl mx-auto px-6 py-4 flex gap-6">
//         <Link to="/dashboard" className="font-medium text-gray-700 hover:text-indigo-600">
//           Dashboard
//         </Link>
//         <Link to="/summarizer" className="font-medium text-gray-700 hover:text-indigo-600">
//           Summarizer
//         </Link>
//         <Link to="/flashcards" className="font-medium text-gray-700 hover:text-indigo-600">
//           Flashcards
//         </Link>
//         <Link to="/study-session" className="font-medium text-gray-700 hover:text-indigo-600">
//           Study
//         </Link>
//         <Link to="/calendar" className="font-medium text-gray-700 hover:text-indigo-600">
//           Calendar
//         </Link>
//       </div>
//     </nav>
//   );
// }


