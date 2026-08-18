import styles from "./DrawerNav.module.css";

export interface DrawerNavProps {
  index: number;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
  // "float" sobrepõe o player; o padrão ancora no topo do drawer, espelhando o
  // botão de fechar.
  variant?: "corner" | "float";
}

// Navegação entre os itens de uma coleção sem fechar o drawer. As setas do
// teclado ficam com o useDrawerKeys, que é quem sabe se o foco está num campo.
export function DrawerNav({ index, total, onPrev, onNext, variant = "corner" }: DrawerNavProps) {
  // Sobre o player cada seta se revela pelo hover **dela**, encostada na borda:
  // revelar pelo hover do player inteiro faria aparecer controle por cima do
  // vídeo a cada passada de mouse. Sem contador e sem botão desabilitado nas
  // pontas — em cima do vídeo, tudo que não leva a lugar nenhum é estorvo.
  if (variant === "float") {
    return (
      <>
        {onPrev && (
          <button
            className={`${styles.floatButton} ${styles.floatPrev}`}
            onClick={onPrev}
            title="Anterior (←)"
            aria-label="Item anterior"
          >
            ‹
          </button>
        )}
        {onNext && (
          <button
            className={`${styles.floatButton} ${styles.floatNext}`}
            onClick={onNext}
            title="Próximo (→)"
            aria-label="Próximo item"
          >
            ›
          </button>
        )}
      </>
    );
  }

  return (
    <div className={styles.corner}>
      <button
        className={styles.button}
        onClick={onPrev}
        disabled={!onPrev}
        title="Anterior (←)"
        aria-label="Item anterior"
      >
        ‹
      </button>
      <span className={styles.position}>
        {index + 1} / {total}
      </span>
      <button
        className={styles.button}
        onClick={onNext}
        disabled={!onNext}
        title="Próximo (→)"
        aria-label="Próximo item"
      >
        ›
      </button>
    </div>
  );
}
