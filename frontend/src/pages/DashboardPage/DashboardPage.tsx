import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useLibrary } from "../../hooks/useLibrary";
import { useMovieLibrary } from "../../hooks/useMovieLibrary";
import { useSeriesLibrary } from "../../hooks/useSeriesLibrary";
import { useBookLibrary } from "../../hooks/useBookLibrary";
import { useGameLibrary } from "../../hooks/useGameLibrary";
import { AnimeDrawer } from "../../components/AnimeDrawer/AnimeDrawer";
import { MovieDrawer } from "../../components/MovieDrawer/MovieDrawer";
import { SeriesDrawer } from "../../components/SeriesDrawer/SeriesDrawer";
import { GameDrawer } from "../../components/GameDrawer/GameDrawer";
import { BookDrawer } from "../../components/BookDrawer/BookDrawer";
import { AnimeIcon, MovieIcon, SeriesIcon, BookIcon, GameIcon } from "../../components/Sidebar/Sidebar.icons";
import { buildAgenda, splitAgenda, groupByDay, groupByMonth, type AgendaItem, type AgendaGroup } from "../../utils/agenda";
import styles from "./DashboardPage.module.css";

const MEDIA_ICON: Record<AgendaItem["media"], typeof AnimeIcon> = {
  anime: AnimeIcon,
  movie: MovieIcon,
  series: SeriesIcon,
  game: GameIcon,
  book: BookIcon,
};

function itemWhen(item: AgendaItem, withDate: boolean): string {
  const d = new Date(item.when);
  const time = item.hasTime ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  if (!withDate) return time || "—";
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return time ? `${date} ${time}` : date;
}

function countByStatus<T extends { status: string }>(entries: T[], status: string): number {
  return entries.filter((entry) => entry.status === status).length;
}

function countThisYear<T>(entries: T[], getDate: (entry: T) => string | null): number {
  const year = new Date().getFullYear();
  return entries.filter((entry) => {
    const date = getDate(entry);
    return date !== null && new Date(date).getFullYear() === year;
  }).length;
}

function contextLine(inProgress: number | null, backlog: number): string {
  const segments: string[] = [];
  if (inProgress !== null && inProgress > 0) segments.push(`${inProgress} em andamento`);
  if (backlog > 0) segments.push(`${backlog} na pilha`);
  return segments.join(" · ");
}

export function DashboardPage() {
  const { entries: animes, update: updateAnime, findByAnilistId } = useLibrary();
  const { entries: movies, update: updateMovie, findByTmdbId: findMovieByTmdbId } = useMovieLibrary();
  const { entries: series } = useSeriesLibrary();
  const { entries: books, update: updateBook, findByHardcoverId } = useBookLibrary();
  const { entries: games, update: updateGame, findByIgdbId } = useGameLibrary();

  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);

  const counters = useMemo(() => [
    {
      label: "Anime", path: "/anime", icon: AnimeIcon, color: "var(--color-media-anime)",
      completed: countByStatus(animes, "watched"),
      inProgress: null,
      backlog: countByStatus(animes, "plan_to_watch"),
      thisYear: countThisYear(animes, (e) => e.watchedAt),
    },
    {
      label: "Filmes", path: "/filmes", icon: MovieIcon, color: "var(--color-media-movie)",
      completed: countByStatus(movies, "watched"),
      inProgress: null,
      backlog: countByStatus(movies, "plan_to_watch"),
      thisYear: countThisYear(movies, (e) => e.watchedAt),
    },
    {
      label: "Séries", path: "/series", icon: SeriesIcon, color: "var(--color-media-series)",
      completed: countByStatus(series, "watched"),
      inProgress: null,
      backlog: countByStatus(series, "plan_to_watch"),
      thisYear: countThisYear(series, (e) => e.watchedAt),
    },
    {
      label: "Livros", path: "/livros", icon: BookIcon, color: "var(--color-media-book)",
      completed: countByStatus(books, "read"),
      inProgress: null,
      backlog: countByStatus(books, "plan_to_read"),
      thisYear: countThisYear(books, (e) => e.readAt),
    },
    {
      label: "Jogos", path: "/jogos", icon: GameIcon, color: "var(--color-media-game)",
      completed: countByStatus(games, "beaten"),
      inProgress: null,
      backlog: countByStatus(games, "plan_to_play"),
      thisYear: countThisYear(games, (e) => e.finishedAt),
    },
  ], [animes, movies, series, books, games]);

  const agenda = useMemo(
    () => buildAgenda(animes, movies, series, games, books),
    [animes, movies, series, games, books]
  );
  const { weekGroups, laterGroups } = useMemo(() => {
    const { week, later } = splitAgenda(agenda);
    return { weekGroups: groupByDay(week), laterGroups: groupByMonth(later) };
  }, [agenda]);

  const openItem = (item: AgendaItem) => {
    if (item.media === "anime") setSelectedAnimeId(item.externalId as number);
    else if (item.media === "movie") setSelectedMovieId(item.externalId as number);
    else if (item.media === "series") setSelectedSeriesId(item.externalId as number);
    else if (item.media === "game") setSelectedGameId(item.externalId as number);
    else setSelectedBookId(item.externalId as number);
  };

  const renderGroups = (groups: AgendaGroup[], withDate: boolean) =>
    groups.map((group) => (
      <div className={styles.group} key={group.key}>
        <div className={styles.groupHeader}>{group.label}</div>
        <div className={styles.groupItems}>
          {group.items.map((item) => {
            const Icon = MEDIA_ICON[item.media];
            return (
              <button
                type="button"
                className={styles.item}
                key={`${item.media}-${item.externalId}`}
                onClick={() => openItem(item)}
              >
                <Icon className={styles.itemIcon} />
                <span className={styles.itemTime}>{itemWhen(item, withDate)}</span>
                <span className={styles.itemTitle}>{item.title}</span>
                <span className={styles.itemDetail}>{item.detail}</span>
              </button>
            );
          })}
        </div>
      </div>
    ));

  const animeDrawerEntry = selectedAnimeId !== null ? findByAnilistId(selectedAnimeId) : undefined;
  const movieDrawerEntry = selectedMovieId !== null ? findMovieByTmdbId(selectedMovieId) : undefined;
  const gameDrawerEntry = selectedGameId !== null ? findByIgdbId(selectedGameId) : undefined;
  const bookDrawerEntry = selectedBookId !== null ? findByHardcoverId(selectedBookId) : undefined;

  return (
    <div className={styles.page}>
      <section className={styles.counters}>
        {counters.map((c) => {
          const Icon = c.icon;
          const context = contextLine(c.inProgress, c.backlog);
          return (
            <Link
              to={c.path}
              className={styles.counter}
              key={c.path}
              style={{ "--media-color": c.color } as CSSProperties}
            >
              <Icon className={styles.watermark} />
              <span className={styles.counterValue}>{c.completed}</span>
              <span className={styles.counterLabel}>{c.label}</span>
              {c.thisYear > 0 && <span className={styles.delta}>+{c.thisYear} este ano</span>}
              {context && <span className={styles.context}>{context}</span>}
            </Link>
          );
        })}
      </section>

      <section className={styles.agenda}>
        {agenda.length === 0 ? (
          <div className={styles.empty}>Nada agendado nos próximos dias.</div>
        ) : (
          <>
            {weekGroups.length > 0 && (
              <div className={styles.block}>
                <div className={styles.blockTitle}>Esta semana</div>
                {renderGroups(weekGroups, false)}
              </div>
            )}
            {laterGroups.length > 0 && (
              <div className={styles.block}>
                <div className={styles.blockTitle}>Mais adiante</div>
                {renderGroups(laterGroups, true)}
              </div>
            )}
          </>
        )}
      </section>

      {selectedAnimeId !== null && (
        <AnimeDrawer
          animeId={selectedAnimeId}
          onClose={() => setSelectedAnimeId(null)}
          notes={animeDrawerEntry?.notes}
          onNotesChange={
            animeDrawerEntry ? (notes) => { void updateAnime(animeDrawerEntry.id, { notes }); } : undefined
          }
        />
      )}
      {selectedMovieId !== null && (
        <MovieDrawer
          movieId={selectedMovieId}
          onClose={() => setSelectedMovieId(null)}
          notes={movieDrawerEntry?.notes}
          onNotesChange={
            movieDrawerEntry ? (notes) => { void updateMovie(movieDrawerEntry.id, { notes }); } : undefined
          }
        />
      )}
      {selectedSeriesId !== null && (
        <SeriesDrawer seriesId={selectedSeriesId} onClose={() => setSelectedSeriesId(null)} />
      )}
      {selectedGameId !== null && (
        <GameDrawer
          gameId={selectedGameId}
          onClose={() => setSelectedGameId(null)}
          notes={gameDrawerEntry?.notes}
          onNotesChange={
            gameDrawerEntry ? (notes) => { void updateGame(gameDrawerEntry.id, { notes }); } : undefined
          }
        />
      )}
      {selectedBookId !== null && (
        <BookDrawer
          bookId={selectedBookId}
          onClose={() => setSelectedBookId(null)}
          notes={bookDrawerEntry?.notes}
          onNotesChange={
            bookDrawerEntry ? (notes) => { void updateBook(bookDrawerEntry.id, { notes }); } : undefined
          }
        />
      )}
    </div>
  );
}
