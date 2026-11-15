import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { LibraryProvider } from "./context/LibraryContext";
import { ConnectivityProvider } from "./context/ConnectivityProvider";
import { TopbarSlotProvider } from "./context/TopbarSlotProvider";
import { OfflineBanner } from "./components/OfflineBanner/OfflineBanner";
import { DashboardPage } from "./pages/DashboardPage/DashboardPage";
import { AnimePage } from "./pages/AnimePage/AnimePage";
import { MoviesPage } from "./pages/MoviesPage/MoviesPage";
import { SeriesPage } from "./pages/SeriesPage/SeriesPage";
import { BooksPage } from "./pages/BooksPage/BooksPage";
import { GamesPage } from "./pages/GamesPage/GamesPage";
import { YouTubePage } from "./pages/YouTubePage/YouTubePage";
import { SettingsPage } from "./pages/SettingsPage/SettingsPage";
import { TierListPage } from "./pages/TierListPage/TierListPage";
import styles from "./App.module.css";

function App() {
  return (
    <BrowserRouter>
      <ConnectivityProvider>
        <LibraryProvider>
          <TopbarSlotProvider>
            <div className={styles.layout}>
              <Sidebar />
              <main className={styles.content}>
                <OfflineBanner />
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/tierlist" element={<TierListPage />} />
                  <Route path="/anime" element={<AnimePage />} />
                  <Route path="/filmes" element={<MoviesPage />} />
                  <Route path="/series" element={<SeriesPage />} />
                  <Route path="/livros" element={<BooksPage />} />
                  <Route path="/jogos" element={<GamesPage />} />
                  <Route path="/youtube/:videoId?" element={<YouTubePage />} />
                  {/* A mídia Música foi fundida no YouTube; links antigos caem lá. */}
                  <Route path="/musica/*" element={<Navigate to="/youtube" replace />} />
                  <Route path="/config" element={<SettingsPage />} />
                </Routes>
              </main>
            </div>
          </TopbarSlotProvider>
        </LibraryProvider>
      </ConnectivityProvider>
    </BrowserRouter>
  );
}

export default App;
