import { useMemo, useState } from "react";
import { useOnline } from "../context/connectivityContext";

const LIBRARY_TAB = "library";

// Offline as abas de catálogo não têm de onde tirar dado: a aba efetiva vira a
// biblioteca, que é servida pelo banco. A escolha do usuário fica guardada, então
// quando a rede volta ele cai de volta na aba em que estava.
export function useOfflineTab(tabs: { id: string }[], defaultTab: string) {
  const online = useOnline();
  const [chosenTab, setActiveTab] = useState(defaultTab);
  const activeTab = online ? chosenTab : LIBRARY_TAB;

  const disabledTabs = useMemo(
    () => (online ? [] : tabs.filter((tab) => tab.id !== LIBRARY_TAB).map((tab) => tab.id)),
    [online, tabs]
  );

  return { activeTab, setActiveTab, disabledTabs };
}
