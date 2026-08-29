
// import { useContext } from "react";
// import { Navigate } from "react-router-dom";
// import { AuthContext } from "../context/AuthContext";

// function ProtectedRoute({ children }) {
//   const { isAuthenticated, loading } = useContext(AuthContext);

//   if (loading) {
//     return <div className="p-6">Loading...</div>;
//   }

//   if (!isAuthenticated) {
//     return <Navigate to="/login" replace />;
//   }

//   return children;
// }

// export default ProtectedRoute;

import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/authContextValue";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) return <div>Loading...</div>;

  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
}
