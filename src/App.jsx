import React, { useState, useEffect } from "react";
import ResearchPortfolio from "./ResearchPortfolio";
import Admin from "./Admin";

const isAdminHash = () => /^#\/?admin/.test(window.location.hash);

export default function App() {
  const [isAdmin, setIsAdmin] = useState(isAdminHash);

  useEffect(() => {
    const onHash = () => setIsAdmin(isAdminHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return isAdmin ? <Admin /> : <ResearchPortfolio />;
}