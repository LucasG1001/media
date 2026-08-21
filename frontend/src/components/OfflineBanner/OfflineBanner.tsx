import { useOnline } from "../../context/connectivityContext";
import styles from "./OfflineBanner.module.css";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles.dot} aria-hidden="true" />
      Sem conexão — exibindo os dados salvos. Edições ficam indisponíveis até a rede voltar.
    </div>
  );
}
