import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { LibraryProvider } from "./context/LibraryContext";
import { ConnectivityProvider } from "./context/ConnectivityProvider";
import { OfflineBanner } from "./components/OfflineBanner/OfflineBanner";
import { DashboardPage } from "./pages/DashboardPage/DashboardPage";
import { AnimePage } from "./pages/AnimePage/AnimePage";
import { MoviesPage } from "./pages/MoviesPage/MoviesPage";
import { SeriesPage } from "./pages/SeriesPage/SeriesPage";
import { BooksPage } from "./pages/BooksPage/BooksPage";
import { GamesPage } from "./pages/GamesPage/GamesPage";
import { YouTubePage } from "./pages/YouTubePage/YouTubePage";
import { SettingsPage } from "./pages/SettingsPage/SettingsPage";
import styles from "./App.module.css";

const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";

function App() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
  );

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <BrowserRouter>
      <ConnectivityProvider>
        <LibraryProvider>
          <div className={styles.layout}>
            <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
            <main
              className={`${styles.content} ${collapsed ? styles.contentCollapsed : ""}`}
            >
              <OfflineBanner />
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/anime" element={<AnimePage />} />
                <Route path="/filmes" element={<MoviesPage />} />
                <Route path="/series" element={<SeriesPage />} />
                <Route path="/livros" element={<BooksPage />} />
                <Route path="/jogos" element={<GamesPage />} />
                <Route path="/youtube" element={<YouTubePage />} />
                <Route path="/config" element={<SettingsPage />} />
              </Routes>
            </main>
          </div>
        </LibraryProvider>
      </ConnectivityProvider>
    </BrowserRouter>
  );
}

export default App;
