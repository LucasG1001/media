import type { ComponentType } from "react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import {
  AnimeIcon,
  BookIcon,
  ChevronIcon,
  GameIcon,
  HomeIcon,
  LogoIcon,
  MediaIcon,
  MovieIcon,
  SeriesIcon,
  SettingsIcon,
  YoutubeIcon,
} from "./Sidebar.icons";

interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/anime", label: "Anime", icon: AnimeIcon },
  { path: "/filmes", label: "Filmes", icon: MovieIcon },
  { path: "/series", label: "Séries", icon: SeriesIcon },
  { path: "/livros", label: "Livros", icon: BookIcon },
  { path: "/jogos", label: "Jogos", icon: GameIcon },
  { path: "/youtube", label: "YouTube", icon: YoutubeIcon },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const [chooserOpen, setChooserOpen] = useState(false);

  const current = NAV_ITEMS.find((item) => item.path === location.pathname);
  const CenterIcon = current ? current.icon : MediaIcon;
  const centerLabel = current ? current.label : "Mídia";

  return (
    <>
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <LogoIcon className={styles.logoMark} />
        </div>
        <span className={styles.logoText}>Media</span>
        <button
          type="button"
          className={styles.toggle}
          onClick={onToggle}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <ChevronIcon className={styles.toggleIcon} />
        </button>
      </div>

      <nav className={styles.nav}>
        <NavLink
          to="/"
          end
          title="Início"
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
        >
          <HomeIcon className={styles.navIcon} />
          <span className={styles.navLabel}>Início</span>
        </NavLink>

        <span className={styles.navSection}>Biblioteca</span>
        {NAV_ITEMS.map((item) => {
          const ItemIcon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
              }
            >
              <ItemIcon className={styles.navIcon} />
              <span className={styles.navLabel}>{item.label}</span>
              {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
            </NavLink>
          );
        })}

        <span className={styles.navSection}>Sistema</span>
        <NavLink
          to="/config"
          title="Configurações"
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
        >
          <SettingsIcon className={styles.navIcon} />
          <span className={styles.navLabel}>Configurações</span>
        </NavLink>
      </nav>

      <nav className={styles.mobileNav}>
        <NavLink
          to="/"
          end
          aria-label="Início"
          className={({ isActive }) => `${styles.barItem} ${isActive ? styles.barItemActive : ""}`}
        >
          <HomeIcon className={styles.barIcon} />
        </NavLink>

        <button
          type="button"
          className={`${styles.barItem} ${current ? styles.barItemActive : ""}`}
          onClick={() => setChooserOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={chooserOpen}
          aria-label={centerLabel}
        >
          <CenterIcon className={styles.barIcon} />
        </button>

        <NavLink
          to="/config"
          aria-label="Configurações"
          className={({ isActive }) => `${styles.barItem} ${isActive ? styles.barItemActive : ""}`}
        >
          <SettingsIcon className={styles.barIcon} />
        </NavLink>
      </nav>
    </aside>

    {chooserOpen && (
      <div className={styles.chooserOverlay} onClick={() => setChooserOpen(false)}>
        <div className={styles.chooserSheet} onClick={(event) => event.stopPropagation()}>
          <div className={styles.chooserGrid}>
            {NAV_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setChooserOpen(false)}
                  className={({ isActive }) =>
                    `${styles.chooserItem} ${isActive ? styles.chooserItemActive : ""}`
                  }
                >
                  <ItemIcon className={styles.chooserIcon} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
