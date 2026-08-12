import { Route, Routes, Link } from "react-router-dom";
import PoolListPage from "./pages/PoolListPage";
import PoolDetailPage from "./pages/PoolDetailPage";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          🏊 SD Pool Tracker
        </Link>
        <span className="tagline">City of San Diego public pools</span>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<PoolListPage />} />
          <Route path="/pools/:slug" element={<PoolDetailPage />} />
        </Routes>
      </main>
      <footer className="app-footer">
        Data sourced from{" "}
        <a href="https://www.sandiego.gov/pools" target="_blank" rel="noreferrer">
          sandiego.gov/pools
        </a>
        . Hours change without notice — call ahead to confirm.
      </footer>
    </div>
  );
}
