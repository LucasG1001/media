import { useState, useEffect, useCallback, useRef } from "react";
import type { BookDetail } from "../../types/book";
import { fetchBookById } from "../../services/bookService";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import styles from "./BookDrawer.module.css";

// notes/onNotesChange só vêm quando o item está na biblioteca — no catálogo o
// bloco de anotação não aparece.
interface BookDrawerProps {
  bookId: number;
  onClose: () => void;
  onBookLoad?: (book: BookDetail) => void;
  notes?: string | null;
  onNotesChange?: (notes: string) => void;
}

// A descrição da Hardcover é texto puro — não há HTML para limpar aqui, ao contrário do
// que vinha do Google Books.
function formatPublishedDate(date: string | null, fallbackYear: number | null): string {
  if (!date) return fallbackYear != null ? String(fallbackYear) : "N/A";
  const parsed = new Date(`${date}T00:00:00`);
  if (isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function BookDrawer({ bookId, onClose, onBookLoad, notes, onNotesChange }: BookDrawerProps) {
  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const onBookLoadRef = useRef(onBookLoad);
  useEffect(() => {
    onBookLoadRef.current = onBookLoad;
  });

  useEffect(() => {
    let active = true;
    fetchBookById(bookId)
      .then((data) => {
        if (!active) return;
        setBook(data);
        onBookLoadRef.current?.(data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookId]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <button className={styles.closeButton} onClick={onClose}>✕</button>

        {loading ? (
          <div className={styles.loading}>Carregando...</div>
        ) : book ? (
          <>
            <div className={styles.bannerPlaceholder} />

            <div className={styles.header}>
              {book.coverImage ? (
                <img className={styles.coverImage} src={book.coverImage} alt={book.title} />
              ) : (
                <div className={styles.coverPlaceholder}>📚</div>
              )}
              <div className={styles.headerInfo}>
                <div className={styles.title}>{book.title}</div>
                {book.subtitle && <div className={styles.tagline}>{book.subtitle}</div>}
              </div>
            </div>

            <div className={styles.content}>
              {book.description && <div className={styles.description}>{book.description}</div>}

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Autor(es)</span>
                  <span className={styles.infoValue}>{book.authors.length > 0 ? book.authors.join(", ") : "N/A"}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Série</span>
                  <span className={styles.infoValue}>
                    {book.seriesName
                      ? `${book.seriesName}${book.seriesPosition != null ? ` #${book.seriesPosition}` : ""}`
                      : "N/A"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Publicação</span>
                  <span className={styles.infoValue}>{formatPublishedDate(book.publishedDate, book.releaseYear)}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Páginas</span>
                  <span className={styles.infoValue}>{book.pageCount ?? "N/A"}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Avaliação</span>
                  <span className={styles.infoValue}>
                    {book.averageRating
                      ? `★ ${book.averageRating.toFixed(1)}${book.ratingsCount ? ` (${book.ratingsCount.toLocaleString("pt-BR")})` : ""}`
                      : "N/A"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Leitores</span>
                  <span className={styles.infoValue}>
                    {book.usersCount ? book.usersCount.toLocaleString("pt-BR") : "N/A"}
                  </span>
                </div>
              </div>

              {book.genres.length > 0 && (
                <div>
                  <div className={styles.sectionTitle}>Categorias</div>
                  <div className={styles.genres}>
                    {book.genres.map((g) => (
                      <span key={g} className={styles.genreTag}>{g}</span>
                    ))}
                  </div>
                </div>
              )}

              {onNotesChange && <NotesBlock value={notes ?? null} onSave={onNotesChange} />}
            </div>
          </>
        ) : (
          <div className={styles.loading}>{error ? "Erro ao carregar detalhes." : ""}</div>
        )}
      </div>
    </>
  );
}
