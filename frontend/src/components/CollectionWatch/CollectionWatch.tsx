import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CollectionGroup } from "../../utils/buildCollectionGroups";
import { collectionNav } from "../../utils/collectionNav";
import { findGroupOf, isCompleted, statusTone, topGenres, yearSpan } from "../../utils/collectionWatch";
import { averageScore } from "../../utils/librarySort";
import { formatLastAccess, formatLastAccessExact, latestAccess } from "../../utils/lastAccess";
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
  status: string;
  lastAccessAt?: string | null;
}

// Quantos gêneros cabem numa linha da lista.
const GENRE_LIMIT = 3;

// O que muda de uma mídia para outra na lista e nos rótulos. Tudo sai do que já
// está salvo na biblioteca — a lista não busca nada.
export interface WatchConfig<M> {
  getCover: (member: M) => string | null;
  getYear: (member: M) => number | null;
  // O que vem depois do ano na linha de fatos de um item (ex.: "TV", "24 eps").
  getFacts: (member: M) => (string | null)[];
  getGenres?: (member: M) => readonly string[] | null | undefined;
  // Aviso de lançamento do item (ex.: "Em exibição", "Em breve").
  getBadge?: (member: M) => string | null;
  statusLabel: (member: M) => string;
  // Total da coleção somado dos itens (ex.: "148 eps", "19h 20min").
  getTotal?: (members: M[]) => string | null;
  // Gêneros e aviso da coleção quando não saem dos itens (séries: são da série,
  // não das temporadas). Sem eles os gêneros são os mais comuns entre os itens.
  getGroupGenres?: (group: CollectionGroup<M>) => readonly string[] | null | undefined;
  getGroupBadge?: (group: CollectionGroup<M>) => string | null;
  placeholder: string;
  labels: {
    // Nome da lista para leitor de tela (ex.: "Coleções").
    list: string;
    // Como uma coleção se chama na linha dela (ex.: "Coleção", "Série").
    collection: string;
    // Plural dos itens (ex.: "jogos").
    many: string;
    // Itens concluídos, no progresso da coleção (ex.: "zerados").
    completed: string;
    // Verbo do último acesso (ex.: "visto", "jogado").
    accessed: string;
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
  // Chaves das coleções abertas: os itens de cada uma entram logo abaixo dela,
  // na própria lista (sanfona — várias podem estar abertas).
  openGroups?: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
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

const NO_OPEN_GROUPS: ReadonlySet<string> = new Set();

function scoreLabel(score: number): string {
  return `★ ${score.toFixed(1)}`;
}

function joinFacts(parts: (string | number | null | undefined)[]): string {
  return parts.filter((part) => part !== null && part !== undefined && part !== "").join(" · ");
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

// Linha de fatos de um item ou de uma coleção, com o aviso de lançamento no fim.
function Facts({ text, badge }: { text: string; badge?: string | null }) {
  if (!text && !badge) return null;
  return (
    <span className={styles.rowMeta}>
      {text}
      {text && badge ? " · " : ""}
      {badge && <span className={styles.rowBadge}>{badge}</span>}
    </span>
  );
}

function LastAccess({ iso, verb }: { iso: string | null | undefined; verb: string }) {
  if (!iso) return null;
  return (
    <span className={styles.rowAccess} title={`Último acesso: ${formatLastAccessExact(iso)}`}>
      {verb} {formatLastAccess(iso)}
    </span>
  );
}

// Visão de detalhe de uma biblioteca: palco grande à esquerda (trailer, ou
// imagem quando não há) e as coleções como lista à direita. Mesmo desenho da tela
// do YouTube, mas a lista tem dois níveis — coleções e, abaixo de cada uma
// aberta, os itens dela.
// É genérico: cada mídia tem um invólucro (`GameWatch`, `AnimeWatch`…) que busca
// o detalhe e monta o que vai no palco e abaixo dele.
export function CollectionWatch<M extends WatchMember>({
  entry,
  groups,
  openGroups = NO_OPEN_GROUPS,
  onToggleGroup,
  onSelect,
  controls,
  autoPlay,
  navKeys = true,
  onEdit,
  config,
  title,
  subtitle,
  trailerId,
  stageImage,
  loading,
  error,
  children,
  notes,
  onNotesChange,
}: CollectionWatchProps<M>) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  // No celular a ficha e a anotação ficam recolhidas até alguém pedir (o CSS só
  // as esconde lá). Vale para a visita, não por item.
  const [detailsOpen, setDetailsOpen] = useState(false);
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

  // Em tela estreita a lista fica abaixo do palco: escolher nela deve trazer o
  // palco de volta para a vista. Só rola se o palco já saiu por cima — no
  // celular ele é fixo e nunca sai, então a rolagem fica onde está.
  useEffect(() => {
    const top = stage.current?.getBoundingClientRect().top ?? 0;
    if (top < -1) root.current?.scrollIntoView?.({ block: "start" });
  }, [entry.id]);

  // A lista tem rolagem própria no desktop: o destaque tem que estar à vista ao
  // navegar por anterior/próximo. Ajusta o scrollTop da lista, não a página.
  // Abrir ou fechar uma coleção não entra aqui: puxaria a lista de volta para o
  // item atual a cada toque.
  useEffect(() => {
    const container = list.current;
    const row = container?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!container || !row) return;
    const box = container.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    if (rect.top < box.top) container.scrollTop -= box.top - rect.top;
    else if (rect.bottom > box.bottom) container.scrollTop += rect.bottom - box.bottom;
  }, [entry.id, groups]);

  const currentGroup = findGroupOf(groups, entry.id);
  const entryCover = config.getCover(entry);

  const itemRow = (member: M) => {
    const current = member.id === entry.id;
    const genres = config.getGenres?.(member)?.slice(0, GENRE_LIMIT) ?? [];
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
            <Facts
              text={joinFacts([config.getYear(member), ...config.getFacts(member)])}
              badge={config.getBadge?.(member)}
            />
            {genres.length > 0 && <span className={styles.rowGenres}>{genres.join(", ")}</span>}
            <span className={styles.rowFoot}>
              <span className={styles.status} data-tone={statusTone(member.status)}>
                {config.statusLabel(member)}
              </span>
              {member.score > 0 && <span className={styles.rowScore}>{scoreLabel(member.score)}</span>}
              <LastAccess iso={member.lastAccessAt} verb={labels.accessed} />
            </span>
          </span>
        </button>
      </li>
    );
  };

  const groupRow = (group: CollectionGroup<M>) => {
    const open = openGroups.has(group.key);
    // Aberta, quem leva o destaque é o item dentro dela.
    const playing = group === currentGroup && !open;
    const average = averageScore(group.members);
    const completed = group.members.filter((member) => isCompleted(member.status)).length;
    const genres = (
      config.getGroupGenres
        ? [...(config.getGroupGenres(group) ?? [])]
        : topGenres(group.members.map((member) => config.getGenres?.(member)), GENRE_LIMIT)
    ).slice(0, GENRE_LIMIT);
    // Com filtro o numerador é quantos batem, como no selo da grade.
    const count = group.completedCount === group.count ? group.count : `${group.completedCount}/${group.count}`;
    return (
      <li key={group.key} className={open ? styles.groupOpen : undefined}>
        <button
          type="button"
          className={`${styles.row} ${playing ? styles.rowCurrent : ""}`}
          aria-current={playing ? "true" : undefined}
          aria-expanded={open}
          onClick={() => onToggleGroup(group.key)}
        >
          <Cover className={styles.rowCover} src={config.getCover(group.representative)} placeholder={placeholder} />
          <span className={styles.rowText}>
            <span className={styles.rowTitle} title={group.representative.title}>
              {group.representative.title}
            </span>
            <Facts
              text={joinFacts([
                `${labels.collection} · ${count} ${labels.many}`,
                yearSpan(group.members.map(config.getYear)),
                config.getTotal?.(group.members),
              ])}
              badge={config.getGroupBadge?.(group)}
            />
            {genres.length > 0 && <span className={styles.rowGenres}>{genres.join(", ")}</span>}
            <span className={styles.rowFoot}>
              <span className={styles.progress} aria-hidden="true">
                <span className={styles.progressFill} style={{ width: `${(completed / group.count) * 100}%` }} />
              </span>
              <span className={styles.progressLabel}>
                {completed}/{group.count} {labels.completed}
              </span>
              {average > 0 && <span className={styles.rowScore}>{scoreLabel(average)}</span>}
              <LastAccess iso={latestAccess(group.members)} verb={labels.accessed} />
            </span>
          </span>
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">›</span>
        </button>
        {open && (
          <ul className={styles.members} aria-label={group.representative.title}>
            {group.members.map(itemRow)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className={styles.watch} ref={root}>
      <div className={styles.main}>
        {/* Invólucro do palco: é ele que fica fixo no topo no celular. */}
        <div className={styles.stageSlot} ref={stage}>
          {trailerId ? (
            <TrailerEmbed
              youtubeId={trailerId}
              overlay={nav && <DrawerNav index={nav.index} total={nav.total} onPrev={goPrev} onNext={goNext} variant="float" />}
              autoPlay={autoPlay}
              externalLink={false}
            />
          ) : loading ? (
            // Enquanto o detalhe não chega não se sabe se há trailer: o palco fica
            // vazio, porque a capa aqui piscaria antes de o vídeo entrar.
            <div className={`${styles.stage} ${styles.stageLoading}`} data-testid="watch-stage-loading" />
          ) : (
            // Sem trailer o palco é uma imagem: banner ou imagem de fundo, e a capa
            // quando nem isso existe (ou quando o detalhe falhou).
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
        </div>

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
            {config.statusLabel(entry)}
            {entry.score > 0 && ` · ${scoreLabel(entry.score)}`}
          </button>
          {trailerId && (
            <a
              className={styles.action}
              href={`https://www.youtube.com/watch?v=${trailerId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Assistir no YouTube ↗
            </a>
          )}
        </div>

        <button
          type="button"
          className={styles.detailsToggle}
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {detailsOpen ? "Ocultar detalhes" : "Mostrar detalhes"}
        </button>

        <div className={`${styles.detail} ${detailsOpen ? "" : styles.detailCollapsed}`}>
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

        {groups.length === 0 && <div className={styles.queueEmpty}>Nenhum resultado.</div>}

        <ul className={styles.queueList} ref={list}>
          {/* Coleção de um item só é o próprio item: abre direto no palco. */}
          {groups.map((group) => (group.count < 2 ? itemRow(group.members[0]) : groupRow(group)))}
        </ul>
      </aside>
    </div>
  );
}
