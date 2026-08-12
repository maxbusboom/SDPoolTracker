import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

// HashRouter (not BrowserRouter) because GitHub Pages serves static files
// with no server-side rewrites, so a real path like /pools/foo would 404 on
// a hard refresh or direct link. Hash routes (/#/pools/foo) always resolve
// to index.html.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
