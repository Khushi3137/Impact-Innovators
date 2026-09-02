import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Layout from "./components/Layout";

import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";

import Dashboard from "./pages/Dashboard";
import Summarizer from "./pages/Summarizer";
import QuizSession from "./pages/QuizSession";
import DoubtSolver from "./pages/DoubtSolver";
import References from "./pages/References";
import StudySession from "./pages/StudySession";
import Groups from "./pages/Groups";
import Calendar from "./pages/Calendar";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen">
          <Routes>
            {/* ================= PUBLIC ROUTES ================= */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* ================= PROTECTED ROUTES ================= */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Navbar />
                  </Layout>
                </ProtectedRoute>
              }
            >
              {/* Default redirect */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              <Route path="dashboard" element={<Dashboard />} />
              <Route path="summarizer" element={<Summarizer />} />
              <Route path="quiz-session" element={<QuizSession />} />
              <Route path="doubt-solver" element={<DoubtSolver />} />
              <Route path="references" element={<References />} />
              <Route path="flashcards" element={<Navigate to="/quiz-session" replace />} />
              <Route path="study-session" element={<StudySession />} />
              <Route path="groups" element={<Groups />} />
              <Route path="momentum-planner" element={<Calendar />} />
              <Route path="calendar" element={<Navigate to="/momentum-planner" replace />} />
            </Route>
          </Routes>

        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;


