import type { SeasonEpisode } from "../../types/series";
import { formatAirDate } from "../../utils/seriesFormat";
import { CoverImage } from "../CoverImage/CoverImage";
import drawer from "../SeriesDrawer/SeriesDrawer.module.css";
import styles from "./SeasonDrawer.module.css";

// Lista de episódios de uma temporada, igual no drawer e na visão de detalhe.
export function SeasonEpisodes({ episodes }: { episodes: SeasonEpisode[] }) {
  if (episodes.length === 0) return null;

  return (
    <div>
      <div className={drawer.sectionTitle}>Episódios</div>
      <div className={styles.episodes}>
        {episodes.map((ep) => (
          <div key={ep.episodeNumber} className={styles.episode}>
            <CoverImage className={styles.episodeStill} src={ep.still} alt="" />
            <div className={styles.episodeBody}>
              <div className={styles.episodeHead}>
                <span className={styles.episodeNumber}>{ep.episodeNumber}.</span>
                <span className={styles.episodeName}>{ep.name || `Episódio ${ep.episodeNumber}`}</span>
              </div>
              <div className={styles.episodeMeta}>
                {formatAirDate(ep.airDate)}
                {ep.runtime ? ` · ${ep.runtime} min` : ""}
                {ep.voteAverage ? ` · ★ ${ep.voteAverage.toFixed(1)}` : ""}
              </div>
              {ep.overview && <div className={styles.episodeOverview}>{ep.overview}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
