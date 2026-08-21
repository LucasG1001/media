import styles from "./TabNav.module.css";

interface Tab {
  id: string;
  label: string;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  plain?: boolean;
  disabledIds?: string[];
}

export function TabNav({ tabs, activeTab, onTabChange, plain = false, disabledIds }: TabNavProps) {
  const isDisabled = (id: string) => disabledIds?.includes(id) ?? false;

  return (
    <>
      <div className={`${styles.tabNav} ${plain ? styles.tabNavPlain : ""}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            onClick={() => onTabChange(tab.id)}
            disabled={isDisabled(tab.id)}
            title={isDisabled(tab.id) ? "Sem conexão — esta aba precisa de internet." : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <select
        className={styles.mobileSelect}
        value={activeTab}
        onChange={(e) => onTabChange(e.target.value)}
      >
        {tabs.map((tab) => (
          <option key={tab.id} value={tab.id} disabled={isDisabled(tab.id)}>
            {tab.label}
          </option>
        ))}
      </select>
    </>
  );
}
