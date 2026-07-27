import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { migrate } from "./database/migrate.js";
import { refreshStaleEntries } from "./services/librarySyncService.js";
import { refreshStaleSeries, notifyDueSeriesEpisodes } from "./services/seriesLibrarySyncService.js";
import { refreshCollections } from "./services/collectionSyncService.js";
import { notifyDueReleases } from "./services/releaseNotifyService.js";
import { backfillGameModes } from "./services/gameModesBackfillService.js";
import { animeRoutes } from "./routes/animeRoutes.js";
import { libraryRoutes } from "./routes/libraryRoutes.js";
import { movieRoutes } from "./routes/movieRoutes.js";
import { movieLibraryRoutes } from "./routes/movieLibraryRoutes.js";
import { seriesRoutes } from "./routes/seriesRoutes.js";
import { seriesLibraryRoutes } from "./routes/seriesLibraryRoutes.js";
import { gameRoutes } from "./routes/gameRoutes.js";
import { gameLibraryRoutes } from "./routes/gameLibraryRoutes.js";
import { bookRoutes } from "./routes/bookRoutes.js";
import { bookLibraryRoutes } from "./routes/bookLibraryRoutes.js";
import { youtubeLibraryRoutes } from "./routes/youtubeLibraryRoutes.js";
import { backupRoutes } from "./routes/backupRoutes.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { notifyError } from "./services/notifyService.js";

const app = express();
const PORT = process.env.PORT || 3333;
const SYNC_INTERVAL_MS = 30 * 60 * 1000;
const COLLECTION_SYNC_HOUR = 4;
const COLLECTION_SYNC_MINUTE = 0;
const RELEASE_NOTIFY_HOUR = 9;
const RELEASE_NOTIFY_MINUTE = 0;

function scheduleDailyAt(hour: number, minute: number, task: () => void): void {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => {
    task();
    scheduleDailyAt(hour, minute, task);
  }, next.getTime() - now.getTime());
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api/anime", animeRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/movie", movieRoutes);
app.use("/api/movie-library", movieLibraryRoutes);
app.use("/api/series", seriesRoutes);
app.use("/api/series-library", seriesLibraryRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/game-library", gameLibraryRoutes);
app.use("/api/book", bookRoutes);
app.use("/api/book-library", bookLibraryRoutes);
app.use("/api/youtube-library", youtubeLibraryRoutes);
app.use("/api/backup", backupRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start(): Promise<void> {
  await migrate();
  app.listen(PORT, () => {
    process.stdout.write(`Backend rodando em http://localhost:${PORT}\n`);
  });
  notifyDueSeriesEpisodes().catch((error) => void notifyError("Job notifyDueSeriesEpisodes", error));
  backfillGameModes().catch((error) => void notifyError("Job backfillGameModes", error));

  setInterval(() => {
    refreshStaleEntries().catch((error) => void notifyError("Job refreshStaleEntries", error));
    notifyDueSeriesEpisodes()
      .then(() => refreshStaleSeries())
      .catch((error) => void notifyError("Job refreshStaleSeries", error));
  }, SYNC_INTERVAL_MS);

  const runCollectionSync = () =>
    refreshCollections().catch((error) => void notifyError("Job refreshCollections", error));
  scheduleDailyAt(COLLECTION_SYNC_HOUR, COLLECTION_SYNC_MINUTE, runCollectionSync);

  const runReleaseNotify = () =>
    notifyDueReleases().catch((error) => void notifyError("Job notifyDueReleases", error));
  runReleaseNotify();
  scheduleDailyAt(RELEASE_NOTIFY_HOUR, RELEASE_NOTIFY_MINUTE, runReleaseNotify);
}

process.on("unhandledRejection", (reason) => {
  void notifyError("unhandledRejection", reason);
});

process.on("uncaughtException", (error) => {
  void notifyError("uncaughtException", error).finally(() => process.exit(1));
});

start();
