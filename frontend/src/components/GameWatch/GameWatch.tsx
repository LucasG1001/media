import { useEffect, useRef } from "react";
import type { GameDetail } from "../../types/game";
import type { GameLibraryEntry } from "../../types/gameLibrary";
import { GAME_LIBRARY_STATUS_LABELS } from "../../types/gameLibrary";
import type { GameGroup } from "../../utils/gameCollectionGroups";
import { collectionNav } from "../../utils/collectionNav";
import { findGroupOf } from "../../utils/gameWatch";
import { averageScore } from "../../utils/librarySort";
import { useGameDetail } from "../../hooks/useGameDetail";
import { isTyping } from "../../hooks/useDrawerKeys";
import { CoverImage } from "../CoverImage/CoverImage";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { DrawerNav } from "../DrawerNav/DrawerNav";
import { GameDetailSections } from "../GameDetailSections/GameDetailSections";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import styles from "./GameWatch.module.css";

interface GameWatchProps {
  // O jogo aberto no palco.
  entry: GameLibraryEntry;
  // As coleções da biblioteca, já filtradas e ordenadas pela página — a lista da
  // direita é a mesma sequência da grade.
  groups: GameGroup[];
  // Coleção aberta na lista: mostra só os jogos dela, com a barra de saída.
  openGroup?: GameGroup;
  onOpenGroup: (key: string) => void;
  onCloseGroup: () => void;
  onSelect: (igdbId: number) => void;
  // Só depois de alguém escolher um jogo: a tela abre num item que ninguém
  // pediu, e trailer tocando sozinho ali seria estorvo.
  autoPlay: boolean;
  // Desliga ← → enquanto há um modal por cima.
  navKeys?: boolean;
  onEdit: () => void;
  onGameLoad?: (game: GameDetail) => void;
  onNotesChange: (notes: string) => void;
}

function yearOf(entry: GameLibraryEntry): string | null {
  return entry.released ? entry.released.slice(0, 4) : null;
}

function scoreLabel(score: number): string {
  return `★ ${score.toFixed(1)}`;
}

function Cover({ src, className }: { src: string | null; className: string }) {
  return (
    <CoverImage
      className={className}
      src={src}
      alt=""
      fallback={<div className={`${className} ${styles.coverPlaceholder}`}>🎮</div>}
    />
  );
}

// Visão de detalhe da biblioteca de jogos: palco grande à esquerda (trailer, ou
// imagem quando não há) e as coleções como lista à direita. Mesmo desenho da tela
// do YouTube, mas a lista tem dois níveis — coleções e, dentro de uma, os jogos.
export function GameWatch({
  entry,
  groups,
  openGroup,
  onOpenGroup,
  onCloseGroup,
  onSelect,
  autoPlay,
  navKeys = true,
  onEdit,
  onGameLoad,
  onNotesChange,
}: GameWatchProps) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const { game, loading, error } = useGameDetail(entry.igdbId, onGameLoad);

  // Anterior/próximo andam pela coleção do jogo aberto, na ordem da tela — a
  // mesma sequência do drawer. Jogo avulso não tem para onde ir.
  const nav = collectionNav(groups, (member) => member.id === entry.id);
  const previous = nav?.prev;
  const following = nav?.next;
  const goPrev = previous ? () => onSelect(previous.igdbId) : undefined;
  const goNext = following ? () => onSelect(following.igdbId) : undefined;

  const keys = useRef({ goPrev, goNext, enabled: navKeys });
  useEffect(() => {
    keys.current = { goPrev, goNext, enabled: navKeys };
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const { goPrev: prev, goNext: next, enabled } = keys.current;
      if (!enabled || isTyping(event.target)) return;
      if (event.key === "ArrowLeft") prev?.();
      else if (event.key === "ArrowRight") next?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // No celular a lista fica abaixo do palco: escolher nela deve trazer o palco de
  // volta para a vista. Só rola se o topo já saiu da tela.
  useEffect(() => {
    const element = root.current;
    if (element && element.getBoundingClientRect().top < 0) element.scrollIntoView?.({ block: "start" });
  }, [entry.id]);

  // A lista tem rolagem própria no desktop: o destaque tem que estar à vista ao
  // navegar por anterior/próximo. Ajusta o scrollTop da lista, não a página.
  useEffect(() => {
    const container = list.current;
    const row = container?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!container || !row) return;
    const box = container.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    if (rect.top < box.top) container.scrollTop -= box.top - rect.top;
    else if (rect.bottom > box.bottom) container.scrollTop += rect.bottom - box.bottom;
  }, [entry.id, groups, openGroup]);

  const stageImage = game ? (game.bannerImage ?? game.screenshots[0] ?? null) : null;
  const currentGroup = findGroupOf(groups, entry.igdbId);

  const gameRow = (member: GameLibraryEntry) => {
    const current = member.id === entry.id;
    const year = yearOf(member);
    return (
      <li key={member.id}>
        <button
          type="button"
          className={`${styles.row} ${current ? styles.rowCurrent : ""}`}
          aria-current={current ? "true" : undefined}
          onClick={() => {
            if (!current) onSelect(member.igdbId);
          }}
        >
          <Cover className={styles.rowCover} src={member.backgroundImage} />
          <span className={styles.rowText}>
            <span className={styles.rowTitle} title={member.title}>{member.title}</span>
            <span className={styles.rowMeta}>
              {year && `${year} · `}
              {GAME_LIBRARY_STATUS_LABELS[member.status]}
            </span>
            {member.score > 0 && <span className={styles.rowScore}>{scoreLabel(member.score)}</span>}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className={styles.watch} ref={root}>
      <div className={styles.main}>
        {game?.trailer ? (
          <TrailerEmbed
            youtubeId={game.trailer.youtubeId}
            overlay={nav && <DrawerNav index={nav.index} total={nav.total} onPrev={goPrev} onNext={goNext} variant="float" />}
            autoPlay={autoPlay}
          />
        ) : (
          // Sem trailer (ou enquanto o detalhe carrega) o palco é uma imagem:
          // banner ou screenshot, e a capa quando nem isso existe.
          <div className={styles.stage} data-testid="game-stage">
            {stageImage ? (
              <CoverImage
                className={styles.stageImage}
                src={stageImage}
                alt=""
                eager
                fallback={<Cover className={styles.stageCover} src={entry.backgroundImage} />}
              />
            ) : (
              <Cover className={styles.stageCover} src={entry.backgroundImage} />
            )}
          </div>
        )}

        <div className={styles.heading}>
          <h2 className={styles.title}>{game?.title ?? entry.title}</h2>
          {game && game.developers.length > 0 && (
            <div className={styles.developers}>{game.developers.join(" · ")}</div>
          )}
        </div>

        <div className={styles.actions}>
          {nav && (
            <>
              <button
                type="button"
                className={styles.action}
                onClick={goPrev}
                disabled={!goPrev}
                aria-label="Jogo anterior"
                title="Anterior (←)"
              >
                ⏮
              </button>
              <span className={styles.position}>
                {nav.index + 1} / {nav.total}
              </span>
              <button
                type="button"
                className={styles.action}
                onClick={goNext}
                disabled={!goNext}
                aria-label="Próximo jogo"
                title="Próximo (→)"
              >
                ⏭
              </button>
            </>
          )}
          <button type="button" className={styles.action} onClick={onEdit} title="Status e nota">
            {GAME_LIBRARY_STATUS_LABELS[entry.status]}
            {entry.score > 0 && ` · ${scoreLabel(entry.score)}`}
          </button>
        </div>

        <div className={styles.detail}>
          {game ? (
            <GameDetailSections game={game} wide />
          ) : loading ? (
            <div className={styles.notice}>Carregando detalhes...</div>
          ) : (
            error && (
              <div className={styles.notice}>
                Não deu para carregar os detalhes agora — estes são os dados salvos na sua biblioteca.
              </div>
            )
          )}

          {/* key por item: o NotesBlock guarda o texto em estado interno e a
              anotação de um vazaria para o seguinte. Fica fora do ramo de sucesso
              para não sumir quando o detalhe não vem. */}
          <NotesBlock key={entry.id} value={entry.notes} onSave={onNotesChange} />
        </div>
      </div>

      <aside className={styles.queue} aria-label="Coleções">
        {openGroup && (
          <div className={styles.groupBar}>
            <button type="button" className={styles.exit} onClick={onCloseGroup}>
              ← Todas as coleções
            </button>
            <span className={styles.groupBarName} title={openGroup.representative.title}>
              {openGroup.representative.title}
            </span>
            <span className={styles.groupBarCount}>
              {openGroup.count} {openGroup.count === 1 ? "jogo" : "jogos"}
            </span>
          </div>
        )}

        <ul className={styles.queueList} ref={list}>
          {openGroup
            ? openGroup.members.map(gameRow)
            : groups.map((group) => {
                // Coleção de um item só é o próprio jogo: abre direto no palco.
                if (group.count < 2) return gameRow(group.members[0]);
                const playing = group === currentGroup;
                const average = averageScore(group.members);
                return (
                  <li key={group.key}>
                    <button
                      type="button"
                      className={`${styles.row} ${playing ? styles.rowCurrent : ""}`}
                      aria-current={playing ? "true" : undefined}
                      onClick={() => onOpenGroup(group.key)}
                    >
                      <Cover className={styles.rowCover} src={group.representative.backgroundImage} />
                      <span className={styles.rowText}>
                        <span className={styles.rowTitle} title={group.representative.title}>
                          {group.representative.title}
                        </span>
                        {/* Com filtro o numerador é quantos batem, como no selo da grade. */}
                        <span className={styles.rowMeta}>
                          Coleção ·{" "}
                          {group.completedCount === group.count
                            ? group.count
                            : `${group.completedCount}/${group.count}`}{" "}
                          jogos
                        </span>
                        {average > 0 && <span className={styles.rowScore}>{scoreLabel(average)}</span>}
                      </span>
                      <span className={styles.chevron} aria-hidden="true">›</span>
                    </button>
                  </li>
                );
              })}
        </ul>
      </aside>
    </div>
  );
}
