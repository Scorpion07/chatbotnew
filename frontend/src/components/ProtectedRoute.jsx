// frontend/src/components/ProtectedRoute.jsx
import React, { useEffect } from "react";

export function isLoggedIn() {
  return !!localStorage.getItem("token");
}

export default function ProtectedRoute({ children, setView }) {
  useEffect(() => {
    if (!isLoggedIn()) {
      // Redirect to login if not authenticated
      setView?.('login');
    }
  }, [setView]);

  if (!isLoggedIn()) {
    return null; // Return null while redirecting
  }
  
  return children;
}
