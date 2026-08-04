import type { BookCard } from "../../types/book";
import type { BookLibraryEntry, BookLibraryStatus } from "../../types/bookLibrary";
import { BOOK_LIBRARY_STATUS_LABELS } from "../../types/bookLibrary";
import { LibraryModalBase } from "../LibraryModalBase/LibraryModalBase";

interface BookLibraryModalProps {
  book: BookCard;
  libraryEntry: BookLibraryEntry | undefined;
  onClose: () => void;
  onSave: (book: BookCard, data: { status: BookLibraryStatus; score: number }) => void;
  onRemove: (id: string) => void;
  onSetCover: (id: string) => void;
  onAccessAgain: (id: string) => void;
}

export function BookLibraryModal({ book, libraryEntry, onClose, onSave, onRemove, onSetCover, onAccessAgain }: BookLibraryModalProps) {
  return (
    <LibraryModalBase
      title={book.title}
      coverImage={book.coverImage}
      placeholder="📚"
      statusLabels={BOOK_LIBRARY_STATUS_LABELS}
      initialStatus={libraryEntry?.status ?? "plan_to_read"}
      initialScore={libraryEntry?.score ?? 0}
      hasEntry={!!libraryEntry}
      canSetCover={!!libraryEntry && libraryEntry.collectionId != null}
      isCover={libraryEntry?.isCover ?? false}
      lastAccess={{ label: "Última vez lido", at: libraryEntry?.lastAccessAt ?? null }}
      again={{ label: "🔁 Li de novo", whenStatus: "read", onClick: () => libraryEntry && onAccessAgain(libraryEntry.id) }}
      onSetCover={() => libraryEntry && onSetCover(libraryEntry.id)}
      onClose={onClose}
      onSave={(data) => onSave(book, { status: data.status as BookLibraryStatus, score: data.score })}
      onRemove={() => libraryEntry && onRemove(libraryEntry.id)}
    />
  );
}
