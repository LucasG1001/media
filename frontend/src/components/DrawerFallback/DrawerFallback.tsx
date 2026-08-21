import { CoverImage } from "../CoverImage/CoverImage";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import styles from "./DrawerFallback.module.css";

// O que a biblioteca sabe sobre o item sem consultar a API externa.
export interface DrawerFallbackData {
  title: string;
  coverImage?: string | null;
  subtitle?: string | null;
  placeholder?: string;
}

interface DrawerFallbackProps extends DrawerFallbackData {
  notes?: string | null;
  onNotesChange?: (notes: string) => void;
  notesKey?: string | number;
}

// Corpo mínimo quando não há detalhe da API nem cache dele. Antes este caso
// mostrava só "Erro ao carregar detalhes." num painel vazio — some a anotação
// junto, que é o único dado do drawer que é do usuário.
export function DrawerFallback({
  title,
  coverImage,
  subtitle,
  placeholder = "🎬",
  notes,
  onNotesChange,
  notesKey,
}: DrawerFallbackProps) {
  return (
    <>
      <div className={styles.banner} />

      <div className={styles.header}>
        <CoverImage
          className={styles.cover}
          src={coverImage}
          alt={title}
          eager
          fallback={<div className={styles.coverPlaceholder}>{placeholder}</div>}
        />
        <div className={styles.headerInfo}>
          <div className={styles.title}>{title}</div>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.notice}>
          Não deu para carregar os detalhes agora — estes são os dados salvos na sua biblioteca.
        </div>
        {onNotesChange && <NotesBlock key={notesKey} value={notes ?? null} onSave={onNotesChange} />}
      </div>
    </>
  );
}
