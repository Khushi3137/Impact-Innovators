// import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// import { AuthProvider } from "./context/AuthContext";
// import ProtectedRoute from "./components/ProtectedRoute";
// import Navbar from "./components/Navbar";
// import Layout from "./components/Layout";

// import Login from "./pages/Auth/Login";
// import Dashboard from "./pages/Dashboard";
// import Summarizer from "./pages/Summarizer";
// import Flashcards from "./pages/Flashcards";
// import StudySession from "./pages/StudySession";
// import Groups from "./pages/Groups";
// import Calendar from "./pages/Calendar";


// function App() {
//   return (
//     <AuthProvider>
//       <Router>
//         {/* Root Tailwind container */}
//         <div className="min-h-screen bg-gray-100 text-gray-900">
//           <Layout>
//             <Navbar />

//             <Routes>
//               <Route path="/login" element={<Login />} />

//               <Route
//                 path="/dashboard"
//                 element={
//                   <ProtectedRoute>
//                     <Dashboard />
//                   </ProtectedRoute>
//                 }
//               />

//               <Route
//                 path="/summarizer"
//                 element={
//                   <ProtectedRoute>
//                     <Summarizer />
//                   </ProtectedRoute>
//                 }
//               />

//               <Route
//                 path="/flashcards"
//                 element={
//                   <ProtectedRoute>
//                     <Flashcards />
//                   </ProtectedRoute>
//                 }
//               />

//               <Route
//                 path="/study-session"
//                 element={
//                   <ProtectedRoute>
//                     <StudySession />
//                   </ProtectedRoute>
//                 }
//               />

//               <Route
//                 path="/groups"
//                 element={
//                   <ProtectedRoute>
//                     <Groups />
//                   </ProtectedRoute>
//                 }
//               />

//               <Route
//                 path="/calendar"
//                 element={
//                   <ProtectedRoute>
//                     <Calendar />
//                   </ProtectedRoute>
//                 }
//               />
//             </Routes>
//           </Layout>
//         </div>
//       </Router>
//     </AuthProvider>
//   );
// }
// export default App;


import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Layout from "./components/Layout";

import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";

import Dashboard from "./pages/Dashboard";
import Summarizer from "./pages/Summarizer";
import Flashcards from "./pages/Flashcards";
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
              <Route path="flashcards" element={<Flashcards />} />
              <Route path="study-session" element={<StudySession />} />
              <Route path="groups" element={<Groups />} />
              <Route path="calendar" element={<Calendar />} />
            </Route>
          </Routes>

        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;


