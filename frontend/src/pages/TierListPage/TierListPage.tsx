import { useMemo, useState, type CSSProperties } from "react";
import { useLibrary } from "../../hooks/useLibrary";
import { useMovieLibrary } from "../../hooks/useMovieLibrary";
import { useSeriesLibrary } from "../../hooks/useSeriesLibrary";
import { useBookLibrary } from "../../hooks/useBookLibrary";
import { useGameLibrary } from "../../hooks/useGameLibrary";
import { useTierStyles } from "../../hooks/useTierStyles";
import { AnimeDrawer } from "../../components/AnimeDrawer/AnimeDrawer";
import { MovieDrawer } from "../../components/MovieDrawer/MovieDrawer";
import { SeriesDrawer } from "../../components/SeriesDrawer/SeriesDrawer";
import { GameDrawer } from "../../components/GameDrawer/GameDrawer";
import { BookDrawer } from "../../components/BookDrawer/BookDrawer";
import { CoverImage } from "../../components/CoverImage/CoverImage";
import { TierSettingsModal } from "../../components/TierSettingsModal/TierSettingsModal";
import type { DrawerNavProps } from "../../components/DrawerNav/DrawerNav";
import { AnimeIcon, MovieIcon, SeriesIcon, BookIcon, GameIcon } from "../../components/Sidebar/Sidebar.icons";
import { buildFranchiseGroups } from "../../utils/franchiseGroups";
import { buildMovieCollectionGroups } from "../../utils/movieCollectionGroups";
import { buildSeasonGroups } from "../../utils/seasonGroups";
import { buildGameCollectionGroups } from "../../utils/gameCollectionGroups";
import { buildBookCollectionGroups } from "../../utils/bookCollectionGroups";
import { collectionNav, type CollectionNav } from "../../utils/collectionNav";
import { cssVar } from "../../utils/cssVar";
import {
  ANIME_TIER,
  BOOK_TIER,
  GAME_TIER,
  MOVIE_TIER,
  SERIES_TIER,
  TIER_BANDS,
  bandRangeLabel,
  buildTierTiles,
  countUnrated,
  groupTierRows,
  tierYears,
  type TierMedia,
  type TierRowId,
  type TierTile,
} from "../../utils/tierList";
import { downloadBlob, renderTierListImage } from "../../utils/tierListImage";
import styles from "./TierListPage.module.css";

const MEDIA: readonly { id: TierMedia; label: string; icon: typeof AnimeIcon; color: string; slug: string }[] = [
  { id: "anime", label: "Anime", icon: AnimeIcon, color: "var(--color-media-anime)", slug: "anime" },
  { id: "movie", label: "Filmes", icon: MovieIcon, color: "var(--color-media-movie)", slug: "filmes" },
  { id: "series", label: "Séries", icon: SeriesIcon, color: "var(--color-media-series)", slug: "series" },
  { id: "book", label: "Livros", icon: BookIcon, color: "var(--color-media-book)", slug: "livros" },
  { id: "game", label: "Jogos", icon: GameIcon, color: "var(--color-media-game)", slug: "jogos" },
];

const MEDIA_STORAGE_KEY = "tier-list-media";

function readStoredMedia(): TierMedia {
  try {
    const stored = localStorage.getItem(MEDIA_STORAGE_KEY);
    return MEDIA.find((m) => m.id === stored)?.id ?? "anime";
  } catch {
    return "anime";
  }
}

function toDrawerNav<T>(nav: CollectionNav<T> | null, go: (member: T) => void): DrawerNavProps | undefined {
  if (!nav) return undefined;
  const { prev, next } = nav;
  return {
    index: nav.index,
    total: nav.total,
    onPrev: prev ? () => go(prev) : undefined,
    onNext: next ? () => go(next) : undefined,
  };
}

interface Selection {
  media: TierMedia;
  externalId: number;
}

export function TierListPage() {
  const { entries: animes, update: updateAnime, findByAnilistId, loading: animeLoading } = useLibrary();
  const { entries: movies, update: updateMovie, findByTmdbId: findMovie, loading: movieLoading } = useMovieLibrary();
  const { entries: series, findByTmdbId: findSeries, loading: seriesLoading } = useSeriesLibrary();
  const { entries: books, update: updateBook, findByHardcoverId, loading: bookLoading } = useBookLibrary();
  const { entries: games, update: updateGame, findByIgdbId, loading: gameLoading } = useGameLibrary();
  const { styles: tierStyles, defaults: tierDefaults, save: saveTierStyles } = useTierStyles();

  const [media, setMedia] = useState<TierMedia>(readStoredMedia);
  const [year, setYear] = useState<number | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const animeGroups = useMemo(() => buildFranchiseGroups(animes), [animes]);
  const movieGroups = useMemo(() => buildMovieCollectionGroups(movies), [movies]);
  const seriesGroups = useMemo(() => buildSeasonGroups(series).groups, [series]);
  const gameGroups = useMemo(() => buildGameCollectionGroups(games), [games]);
  const bookGroups = useMemo(() => buildBookCollectionGroups(books), [books]);

  const tilesByMedia = useMemo<Record<TierMedia, TierTile[]>>(
    () => ({
      anime: buildTierTiles("anime", animeGroups, ANIME_TIER),
      movie: buildTierTiles("movie", movieGroups, MOVIE_TIER),
      series: buildTierTiles("series", seriesGroups, SERIES_TIER),
      game: buildTierTiles("game", gameGroups, GAME_TIER),
      book: buildTierTiles("book", bookGroups, BOOK_TIER),
    }),
    [animeGroups, movieGroups, seriesGroups, gameGroups, bookGroups]
  );

  const loadingByMedia: Record<TierMedia, boolean> = {
    anime: animeLoading,
    movie: movieLoading,
    series: seriesLoading,
    game: gameLoading,
    book: bookLoading,
  };

  const tiles = tilesByMedia[media];
  const years = useMemo(() => tierYears(tiles), [tiles]);
  // O ano escolhido pode não existir na mídia para a qual se trocou: cai em "todos"
  // por derivação, sem efeito para "consertar" o estado.
  const activeYear = year !== null && years.includes(year) ? year : null;
  const rows = useMemo(() => groupTierRows(tiles, activeYear), [tiles, activeYear]);

  const current = MEDIA.find((m) => m.id === media) ?? MEDIA[0];
  const isLoading = loadingByMedia[media] && tiles.length === 0;
  const rankedCount = TIER_BANDS.reduce((sum, band) => sum + rows[band.id].length, 0);
  const isEmpty = rankedCount + rows.dropped.length + rows.unrated.length === 0;

  const selectMedia = (id: TierMedia) => {
    setMedia(id);
    setExportError(null);
    try {
      localStorage.setItem(MEDIA_STORAGE_KEY, id);
    } catch {
      // Sem armazenamento: a escolha vale só nesta sessão.
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const exportRows: TierRowId[] = TIER_BANDS.map((band) => band.id);
      if (rows.dropped.length > 0) exportRows.push("dropped");
      const blob = await renderTierListImage({
        title: `Tier List · ${current.label}`,
        subtitle: activeYear !== null ? String(activeYear) : "Todos os anos",
        rows: exportRows.map((id) => ({
          label: tierStyles[id].label,
          color: tierStyles[id].color,
          textColor: tierStyles[id].textColor,
          tiles: rows[id].map((tile) => ({ title: tile.title, cover: tile.cover })),
        })),
        theme: {
          background: cssVar("--color-bg-primary"),
          surface: cssVar("--color-bg-secondary"),
          placeholder: cssVar("--color-surface"),
          text: cssVar("--color-text-primary"),
          muted: cssVar("--color-text-secondary"),
          fontFamily: cssVar("--font-family"),
        },
      });
      downloadBlob(blob, `tierlist-${current.slug}-${activeYear ?? "todos"}.png`);
    } catch {
      setExportError("Não foi possível gerar a imagem.");
    } finally {
      setExporting(false);
    }
  };

  const selectedId = (target: TierMedia) => (selected?.media === target ? selected.externalId : null);
  const animeId = selectedId("anime");
  const movieId = selectedId("movie");
  const seriesId = selectedId("series");
  const gameId = selectedId("game");
  const bookId = selectedId("book");

  const animeEntry = animeId !== null ? findByAnilistId(animeId) : undefined;
  const movieEntry = movieId !== null ? findMovie(movieId) : undefined;
  const seriesEntry = seriesId !== null ? findSeries(seriesId) : undefined;
  const gameEntry = gameId !== null ? findByIgdbId(gameId) : undefined;
  const bookEntry = bookId !== null ? findByHardcoverId(bookId) : undefined;

  // A peça abre no item-capa; daqui a navegação percorre a coleção inteira, na
  // mesma ordem da expansão da biblioteca.
  const animeNav = useMemo(
    () => (animeId !== null ? collectionNav(animeGroups, (m) => m.anilistId === animeId) : null),
    [animeGroups, animeId]
  );
  const movieNav = useMemo(
    () => (movieId !== null ? collectionNav(movieGroups, (m) => m.tmdbId === movieId) : null),
    [movieGroups, movieId]
  );
  const gameNav = useMemo(
    () => (gameId !== null ? collectionNav(gameGroups, (m) => m.igdbId === gameId) : null),
    [gameGroups, gameId]
  );
  const bookNav = useMemo(
    () => (bookId !== null ? collectionNav(bookGroups, (m) => m.hardcoverId === bookId) : null),
    [bookGroups, bookId]
  );

  const close = () => setSelected(null);

  const renderTile = (tile: TierTile) => {
    const score = tile.score > 0 ? tile.score.toFixed(1) : null;
    return (
      <button
        type="button"
        className={styles.tile}
        key={tile.key}
        title={score ? `${tile.title} · ${score}` : tile.title}
        onClick={() => setSelected({ media: tile.media, externalId: tile.externalId })}
      >
        <CoverImage
          className={styles.tileImage}
          src={tile.cover}
          alt={tile.title}
          fallback={<span className={styles.tilePlaceholder}>{tile.title}</span>}
        />
        <span className={styles.tileInfo}>
          <span className={styles.tileTitle}>{tile.title}</span>
          {score && <span className={styles.tileScore}>{score}</span>}
        </span>
      </button>
    );
  };

  const renderRow = (id: TierRowId, hint: string) => (
    <div className={styles.row} key={id}>
      <div
        className={styles.rowLabel}
        title={hint}
        style={{ "--tier-color": tierStyles[id].color, "--tier-text": tierStyles[id].textColor } as CSSProperties}
      >
        <span className={styles.rowName}>{tierStyles[id].label}</span>
        <span className={styles.rowCount}>{rows[id].length}</span>
      </div>
      <div className={styles.rowTiles}>{rows[id].map(renderTile)}</div>
    </div>
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.mediaTabs} role="radiogroup" aria-label="Mídia">
          {MEDIA.map((m) => {
            const Icon = m.icon;
            const unrated = countUnrated(tilesByMedia[m.id]);
            return (
              <button
                type="button"
                role="radio"
                aria-checked={media === m.id}
                key={m.id}
                className={`${styles.mediaTab} ${media === m.id ? styles.mediaTabActive : ""}`}
                style={{ "--media-color": m.color } as CSSProperties}
                onClick={() => selectMedia(m.id)}
              >
                <Icon className={styles.mediaIcon} />
                <span>{m.label}</span>
                {unrated > 0 && (
                  <span className={styles.mediaBadge} title={`${unrated} sem nota`} aria-label={`${unrated} sem nota`}>
                    {unrated}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className={styles.actions}>
          <select
            className={styles.select}
            aria-label="Ano de conclusão"
            value={activeYear ?? ""}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Todos os anos</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="button" className={styles.button} onClick={() => setSettingsOpen(true)}>
            Editar faixas
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={() => { void handleExport(); }}
            disabled={exporting || isEmpty}
          >
            {exporting ? "Gerando…" : "Exportar imagem"}
          </button>
        </div>
      </header>

      {exportError && <div className={styles.error}>{exportError}</div>}

      {isLoading ? (
        <div className={styles.empty}>Carregando…</div>
      ) : isEmpty ? (
        <div className={styles.empty}>
          {activeYear !== null
            ? `Nada concluído em ${current.label} em ${activeYear}.`
            : `Nada concluído em ${current.label} ainda.`}
        </div>
      ) : (
        <>
          <section className={styles.board} aria-label={`Tier list de ${current.label}`}>
            {TIER_BANDS.map((band) => renderRow(band.id, bandRangeLabel(band.id)))}
            {activeYear === null && rows.dropped.length > 0 && renderRow("dropped", "Status abandonado")}
          </section>

          {activeYear !== null && (
            <p className={styles.note}>
              {tierStyles.dropped.label} só aparece em “Todos os anos”: o abandono não tem data registrada.
            </p>
          )}

          {rows.unrated.length > 0 && (
            <section className={styles.tray}>
              <div className={styles.trayTitle}>
                {tierStyles.unrated.label} <span className={styles.trayCount}>{rows.unrated.length}</span>
              </div>
              <div className={styles.trayTiles}>{rows.unrated.map(renderTile)}</div>
            </section>
          )}
        </>
      )}

      {animeId !== null && (
        <AnimeDrawer
          animeId={animeId}
          nav={toDrawerNav(animeNav, (m) => setSelected({ media: "anime", externalId: m.anilistId }))}
          fallback={
            animeEntry ? { title: animeEntry.title, coverImage: animeEntry.coverImage, placeholder: "🎬" } : undefined
          }
          onClose={close}
          notes={animeEntry?.notes}
          onNotesChange={animeEntry ? (notes) => { void updateAnime(animeEntry.id, { notes }); } : undefined}
        />
      )}
      {movieId !== null && (
        <MovieDrawer
          movieId={movieId}
          nav={toDrawerNav(movieNav, (m) => setSelected({ media: "movie", externalId: m.tmdbId }))}
          fallback={
            movieEntry ? { title: movieEntry.title, coverImage: movieEntry.posterImage, placeholder: "🎬" } : undefined
          }
          onClose={close}
          notes={movieEntry?.notes}
          onNotesChange={movieEntry ? (notes) => { void updateMovie(movieEntry.id, { notes }); } : undefined}
        />
      )}
      {seriesId !== null && (
        <SeriesDrawer
          seriesId={seriesId}
          fallback={
            seriesEntry
              ? { title: seriesEntry.title, coverImage: seriesEntry.posterImage, placeholder: "📺" }
              : undefined
          }
          onClose={close}
        />
      )}
      {gameId !== null && (
        <GameDrawer
          gameId={gameId}
          nav={toDrawerNav(gameNav, (m) => setSelected({ media: "game", externalId: m.igdbId }))}
          fallback={
            gameEntry ? { title: gameEntry.title, coverImage: gameEntry.backgroundImage, placeholder: "🎮" } : undefined
          }
          onClose={close}
          notes={gameEntry?.notes}
          onNotesChange={gameEntry ? (notes) => { void updateGame(gameEntry.id, { notes }); } : undefined}
        />
      )}
      {bookId !== null && (
        <BookDrawer
          bookId={bookId}
          nav={toDrawerNav(bookNav, (m) => setSelected({ media: "book", externalId: m.hardcoverId }))}
          fallback={
            bookEntry ? { title: bookEntry.title, coverImage: bookEntry.coverImage, placeholder: "📚" } : undefined
          }
          onClose={close}
          notes={bookEntry?.notes}
          onNotesChange={bookEntry ? (notes) => { void updateBook(bookEntry.id, { notes }); } : undefined}
        />
      )}

      {settingsOpen && (
        <TierSettingsModal
          current={tierStyles}
          defaults={tierDefaults}
          onSave={saveTierStyles}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
