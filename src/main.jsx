import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import ResearchPortfolio from "./ResearchPortfolio";
import Admin from "./Admin";

const isAdminHash = () => /^#\/?admin/.test(window.location.hash);

function Root() {
  const [isAdmin, setIsAdmin] = useState(isAdminHash);

  useEffect(() => {
    const onHash = () => setIsAdmin(isAdminHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return isAdmin ? <Admin /> : <ResearchPortfolio />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);