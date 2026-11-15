import { useEffect, useRef, type ReactNode } from "react";
import type { CollectionGroup } from "../../utils/buildCollectionGroups";
import { collectionNav } from "../../utils/collectionNav";
import { findGroupOf } from "../../utils/collectionWatch";
import { averageScore } from "../../utils/librarySort";
import { isTyping } from "../../hooks/useDrawerKeys";
import { CoverImage } from "../CoverImage/CoverImage";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { DrawerNav } from "../DrawerNav/DrawerNav";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import styles from "./CollectionWatch.module.css";

export interface WatchMember {
  id: string;
  title: string;
  score: number;
}

// O que muda de uma mídia para outra na lista e nos rótulos.
export interface WatchConfig<M> {
  getCover: (member: M) => string | null;
  // Segunda linha da linha de um item (ex.: "2009 · Zerado").
  getMeta: (member: M) => string;
  placeholder: string;
  labels: {
    // Nome da lista para leitor de tela (ex.: "Coleções").
    list: string;
    // Botão que fecha a coleção aberta (ex.: "← Todas as coleções").
    exit: string;
    // Como uma coleção se chama na linha dela (ex.: "Coleção", "Série").
    collection: string;
    // Singular e plural dos itens (ex.: "jogo", "jogos").
    one: string;
    many: string;
    previous: string;
    next: string;
  };
}

// O que a página decide, igual para todas as mídias (vem do `useLibraryWatch`).
export interface WatchListProps<M> {
  // O item aberto no palco.
  entry: M;
  // As coleções da biblioteca, já filtradas e ordenadas pela página — a lista da
  // direita é a mesma sequência da grade. Vazia quando o filtro não acha nada: o
  // palco fica com o item que já estava nele.
  groups: CollectionGroup<M>[];
  // Busca, filtros e ordenação da biblioteca, acima da lista.
  controls?: ReactNode;
  // Coleção aberta na lista: mostra só os itens dela, com a barra de saída.
  openGroup?: CollectionGroup<M>;
  onOpenGroup: (key: string) => void;
  onCloseGroup: () => void;
  onSelect: (member: M) => void;
  // Só depois de alguém escolher um item: a tela abre num item que ninguém
  // pediu, e trailer tocando sozinho ali seria estorvo.
  autoPlay: boolean;
  // Desliga ← → enquanto há um modal por cima.
  navKeys?: boolean;
  onEdit: () => void;
}

interface CollectionWatchProps<M> extends WatchListProps<M> {
  config: WatchConfig<M>;
  // Palco e cabeçalho: o invólucro da mídia busca o detalhe e entrega pronto.
  title: string;
  subtitle?: string | null;
  // Rótulo do botão de status do item aberto (ex.: "Zerado").
  statusLabel: string;
  trailerId?: string | null;
  stageImage?: string | null;
  loading: boolean;
  error: boolean;
  // As seções do detalhe, quando ele já chegou.
  children?: ReactNode;
  notes?: string | null;
  // Sem ele não há bloco de anotação (série sem temporadas).
  onNotesChange?: (notes: string) => void;
}

function scoreLabel(score: number): string {
  return `★ ${score.toFixed(1)}`;
}

function Cover({ src, className, placeholder }: { src: string | null; className: string; placeholder: string }) {
  return (
    <CoverImage
      className={className}
      src={src}
      alt=""
      fallback={<div className={`${className} ${styles.coverPlaceholder}`}>{placeholder}</div>}
    />
  );
}

// Visão de detalhe de uma biblioteca: palco grande à esquerda (trailer, ou
// imagem quando não há) e as coleções como lista à direita. Mesmo desenho da tela
// do YouTube, mas a lista tem dois níveis — coleções e, dentro de uma, os itens.
// É genérico: cada mídia tem um invólucro (`GameWatch`, `AnimeWatch`…) que busca
// o detalhe e monta o que vai no palco e abaixo dele.
export function CollectionWatch<M extends WatchMember>({
  entry,
  groups,
  openGroup,
  onOpenGroup,
  onCloseGroup,
  onSelect,
  controls,
  autoPlay,
  navKeys = true,
  onEdit,
  config,
  title,
  subtitle,
  statusLabel,
  trailerId,
  stageImage,
  loading,
  error,
  children,
  notes,
  onNotesChange,
}: CollectionWatchProps<M>) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const { labels, placeholder } = config;

  // Anterior/próximo andam pela coleção do item aberto, na ordem da tela — a
  // mesma sequência do drawer. Item avulso não tem para onde ir.
  const nav = collectionNav(groups, (member) => member.id === entry.id);
  const previous = nav?.prev;
  const following = nav?.next;
  const goPrev = previous ? () => onSelect(previous) : undefined;
  const goNext = following ? () => onSelect(following) : undefined;

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

  const currentGroup = findGroupOf(groups, entry.id);
  const entryCover = config.getCover(entry);

  const itemRow = (member: M) => {
    const current = member.id === entry.id;
    return (
      <li key={member.id}>
        <button
          type="button"
          className={`${styles.row} ${current ? styles.rowCurrent : ""}`}
          aria-current={current ? "true" : undefined}
          onClick={() => {
            if (!current) onSelect(member);
          }}
        >
          <Cover className={styles.rowCover} src={config.getCover(member)} placeholder={placeholder} />
          <span className={styles.rowText}>
            <span className={styles.rowTitle} title={member.title}>{member.title}</span>
            <span className={styles.rowMeta}>{config.getMeta(member)}</span>
            {member.score > 0 && <span className={styles.rowScore}>{scoreLabel(member.score)}</span>}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className={styles.watch} ref={root}>
      <div className={styles.main}>
        {trailerId ? (
          <TrailerEmbed
            youtubeId={trailerId}
            overlay={nav && <DrawerNav index={nav.index} total={nav.total} onPrev={goPrev} onNext={goNext} variant="float" />}
            autoPlay={autoPlay}
          />
        ) : (
          // Sem trailer (ou enquanto o detalhe carrega) o palco é uma imagem:
          // banner ou imagem de fundo, e a capa quando nem isso existe.
          <div className={styles.stage} data-testid="watch-stage">
            {stageImage ? (
              <CoverImage
                className={styles.stageImage}
                src={stageImage}
                alt=""
                eager
                fallback={<Cover className={styles.stageCover} src={entryCover} placeholder={placeholder} />}
              />
            ) : (
              <Cover className={styles.stageCover} src={entryCover} placeholder={placeholder} />
            )}
          </div>
        )}

        <div className={styles.heading}>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>

        <div className={styles.actions}>
          {nav && (
            <>
              <button
                type="button"
                className={styles.action}
                onClick={goPrev}
                disabled={!goPrev}
                aria-label={labels.previous}
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
                aria-label={labels.next}
                title="Próximo (→)"
              >
                ⏭
              </button>
            </>
          )}
          <button type="button" className={styles.action} onClick={onEdit} title="Status e nota">
            {statusLabel}
            {entry.score > 0 && ` · ${scoreLabel(entry.score)}`}
          </button>
        </div>

        <div className={styles.detail}>
          {children ??
            (loading ? (
              <div className={styles.notice}>Carregando detalhes...</div>
            ) : (
              error && (
                <div className={styles.notice}>
                  Não deu para carregar os detalhes agora — estes são os dados salvos na sua biblioteca.
                </div>
              )
            ))}

          {/* key por item: o NotesBlock guarda o texto em estado interno e a
              anotação de um vazaria para o seguinte. Fica fora do ramo de sucesso
              para não sumir quando o detalhe não vem. */}
          {onNotesChange && <NotesBlock key={entry.id} value={notes ?? null} onSave={onNotesChange} />}
        </div>
      </div>

      <aside className={styles.queue} aria-label={labels.list}>
        {controls}

        {openGroup && (
          <div className={styles.groupBar}>
            <button type="button" className={styles.exit} onClick={onCloseGroup}>
              {labels.exit}
            </button>
            <span className={styles.groupBarName} title={openGroup.representative.title}>
              {openGroup.representative.title}
            </span>
            <span className={styles.groupBarCount}>
              {openGroup.count} {openGroup.count === 1 ? labels.one : labels.many}
            </span>
          </div>
        )}

        {groups.length === 0 && <div className={styles.queueEmpty}>Nenhum resultado.</div>}

        <ul className={styles.queueList} ref={list}>
          {openGroup
            ? openGroup.members.map(itemRow)
            : groups.map((group) => {
                // Coleção de um item só é o próprio item: abre direto no palco.
                if (group.count < 2) return itemRow(group.members[0]);
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
                      <Cover
                        className={styles.rowCover}
                        src={config.getCover(group.representative)}
                        placeholder={placeholder}
                      />
                      <span className={styles.rowText}>
                        <span className={styles.rowTitle} title={group.representative.title}>
                          {group.representative.title}
                        </span>
                        {/* Com filtro o numerador é quantos batem, como no selo da grade. */}
                        <span className={styles.rowMeta}>
                          {labels.collection} ·{" "}
                          {group.completedCount === group.count
                            ? group.count
                            : `${group.completedCount}/${group.count}`}{" "}
                          {labels.many}
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
