import { useEffect, useRef, useState } from "react";
import styles from "./NotesBlock.module.css";

const DEBOUNCE_MS = 1000;
const SAVED_MS = 2000;

interface NotesBlockProps {
  value: string | null;
  onSave: (notes: string) => void;
  placeholder?: string;
}

export function NotesBlock({
  value,
  onSave,
  placeholder = "Escreva o que quiser sobre este item...",
}: NotesBlockProps) {
  const [text, setText] = useState(value ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const savedRef = useRef(value ?? "");
  const textRef = useRef(text);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  useEffect(() => {
    textRef.current = text;
    if (text === savedRef.current) return;
    setStatus("saving");
    const timer = setTimeout(() => {
      savedRef.current = text;
      onSaveRef.current(text);
      setStatus("saved");
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // Fechar o drawer desmonta o bloco antes do debounce vencer: o que ainda não
  // foi salvo vai embora aqui.
  useEffect(() => {
    return () => {
      if (textRef.current !== savedRef.current) onSaveRef.current(textRef.current);
    };
  }, []);

  useEffect(() => {
    if (status !== "saved") return;
    const timer = setTimeout(() => setStatus("idle"), SAVED_MS);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  return (
    <div>
      <div className={styles.header}>
        <span className={styles.title}>Minhas anotações</span>
        {status !== "idle" && (
          <span className={`${styles.status} ${status === "saved" ? styles.statusSaved : ""}`}>
            {status === "saved" ? "salvo ✓" : "salvando..."}
          </span>
        )}
      </div>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
}
