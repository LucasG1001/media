import type { ComponentType, Ref } from "react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useDismiss } from "../../hooks/useDismiss";
import { useTopbarSlot } from "../../context/topbarSlotContext";
import styles from "./Sidebar.module.css";
import {
  AnimeIcon,
  BookIcon,
  GameIcon,
  HomeIcon,
  LogoIcon,
  MediaIcon,
  MenuIcon,
  MovieIcon,
  SeriesIcon,
  SettingsIcon,
  TierIcon,
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

const MENU_ID = "main-menu";

interface BrandProps {
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}

// Hambúrguer + logo. Aparece na barra superior e de novo no cabeçalho do menu,
// na mesma posição: com o menu aberto por cima, o botão não sai do lugar.
function Brand({ open, onToggle, onNavigate, buttonRef }: BrandProps) {
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.menuButton}
        onClick={onToggle}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        aria-controls={MENU_ID}
      >
        <MenuIcon className={styles.menuIcon} />
      </button>
      <NavLink to="/" className={styles.logo} onClick={onNavigate}>
        <span className={styles.logoIcon}>
          <LogoIcon className={styles.logoMark} />
        </span>
        <span className={styles.logoText}>Media</span>
      </NavLink>
    </>
  );
}

export function Sidebar() {
  const location = useLocation();
  const { setSlot } = useTopbarSlot();
  const [menuOpen, setMenuOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const topbarButton = useRef<HTMLButtonElement>(null);
  const drawerButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);

  const closeMenu = () => {
    // O menu fechado fica `inert`: o foco que estava dentro dele se perderia.
    if (drawer.current?.contains(document.activeElement)) topbarButton.current?.focus();
    setMenuOpen(false);
  };

  useDismiss(menuOpen, closeMenu);

  useEffect(() => {
    if (menuOpen) drawerButton.current?.focus();
  }, [menuOpen]);

  // Prefixo, não igualdade: `/youtube/:videoId` ainda é a mídia YouTube.
  const current = NAV_ITEMS.find(
    (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
  );
  const CenterIcon = current ? current.icon : MediaIcon;
  const centerLabel = current ? current.label : "Mídia";

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.navItem} ${isActive ? styles.navItemActive : ""}`;
  const barItemClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.barItem} ${isActive ? styles.barItemActive : ""}`;

  return (
    <>
      <header className={styles.topbar}>
        <Brand
          open={menuOpen}
          onToggle={() => setMenuOpen(true)}
          onNavigate={closeMenu}
          buttonRef={topbarButton}
        />
        {/* Onde as páginas põem o próprio cabeçalho (abas da mídia), via
            TopbarSlot. */}
        <div className={styles.topbarSlot} ref={setSlot} />
      </header>

      {menuOpen && <div className={styles.backdrop} data-testid="menu-backdrop" onClick={closeMenu} />}

      <aside
        ref={drawer}
        id={MENU_ID}
        className={`${styles.drawer} ${menuOpen ? styles.drawerOpen : ""}`}
        inert={!menuOpen}
      >
        <div className={styles.drawerHeader}>
          <Brand open={menuOpen} onToggle={closeMenu} onNavigate={closeMenu} buttonRef={drawerButton} />
        </div>

        <nav className={styles.nav} aria-label="Menu principal">
          <NavLink to="/" end className={navItemClass} onClick={closeMenu}>
            <HomeIcon className={styles.navIcon} />
            <span className={styles.navLabel}>Início</span>
          </NavLink>
          <NavLink to="/tierlist" className={navItemClass} onClick={closeMenu}>
            <TierIcon className={styles.navIcon} />
            <span className={styles.navLabel}>Tier List</span>
          </NavLink>

          <span className={styles.navSection}>Biblioteca</span>
          {NAV_ITEMS.map((item) => {
            const ItemIcon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={navItemClass} onClick={closeMenu}>
                <ItemIcon className={styles.navIcon} />
                <span className={styles.navLabel}>{item.label}</span>
                {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
              </NavLink>
            );
          })}

          <span className={styles.navSection}>Sistema</span>
          <NavLink to="/config" className={navItemClass} onClick={closeMenu}>
            <SettingsIcon className={styles.navIcon} />
            <span className={styles.navLabel}>Configurações</span>
          </NavLink>
        </nav>
      </aside>

      <nav className={styles.mobileNav}>
        <NavLink to="/" end aria-label="Início" className={barItemClass}>
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

        <NavLink to="/tierlist" aria-label="Tier List" className={barItemClass}>
          <TierIcon className={styles.barIcon} />
        </NavLink>

        <NavLink to="/config" aria-label="Configurações" className={barItemClass}>
          <SettingsIcon className={styles.barIcon} />
        </NavLink>
      </nav>

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
