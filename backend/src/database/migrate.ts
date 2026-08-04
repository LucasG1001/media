import { pool } from "./connection.js";

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS anime_library (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      anilist_id       INTEGER NOT NULL UNIQUE,
      title            TEXT NOT NULL,
      cover_image      TEXT,
      status           TEXT NOT NULL DEFAULT 'plan_to_watch',
      score            NUMERIC(3,1) DEFAULT 0,
      watched_episodes INTEGER NOT NULL DEFAULT 0,
      total_episodes   INTEGER DEFAULT 0,
      anime_status     TEXT NOT NULL DEFAULT 'FINISHED',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE anime_library
    ADD COLUMN IF NOT EXISTS anime_status TEXT NOT NULL DEFAULT 'FINISHED';
  `);

  await pool.query(`
    ALTER TABLE anime_library
    ADD COLUMN IF NOT EXISTS next_airing_episode JSONB,
    ADD COLUMN IF NOT EXISTS streaming_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS watched_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS season_year INTEGER;
  `);

  await pool.query(`
    ALTER TABLE anime_library
    ADD COLUMN IF NOT EXISTS franchise_id INTEGER,
    ADD COLUMN IF NOT EXISTS format TEXT;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_anime_library_franchise_id ON anime_library (franchise_id);
  `);

  await pool.query(`
    ALTER TABLE anime_library
    ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS movie_library (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tmdb_id       INTEGER NOT NULL UNIQUE,
      title         TEXT NOT NULL,
      poster_image  TEXT,
      status        TEXT NOT NULL DEFAULT 'plan_to_watch',
      score         NUMERIC(3,1) DEFAULT 0,
      release_date  TEXT,
      runtime       INTEGER,
      movie_status  TEXT NOT NULL DEFAULT 'RELEASED',
      watched_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE movie_library
    ADD COLUMN IF NOT EXISTS collection_id INTEGER;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_movie_library_collection_id ON movie_library (collection_id);
  `);

  await pool.query(`
    ALTER TABLE movie_library
    ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await pool.query(`
    ALTER TABLE movie_library
    ADD COLUMN IF NOT EXISTS release_notified_at TIMESTAMPTZ;
  `);

  // NULL = nunca sincronizado com o TMDB; findStaleMovies pega essas primeiro.
  await pool.query(`
    ALTER TABLE movie_library
    ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS series_library (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tmdb_id         INTEGER NOT NULL UNIQUE,
      title           TEXT NOT NULL,
      poster_image    TEXT,
      status          TEXT NOT NULL DEFAULT 'plan_to_watch',
      score           NUMERIC(3,1) DEFAULT 0,
      first_air_date  TEXT,
      seasons         INTEGER,
      episodes        INTEGER,
      series_status   TEXT NOT NULL DEFAULT 'RELEASED',
      watched_at      TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE series_library
    ADD COLUMN IF NOT EXISTS next_airing_episode JSONB,
    ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;
  `);

  await pool.query(`
    ALTER TABLE series_library
    ADD COLUMN IF NOT EXISTS last_notified_episode INTEGER;
  `);

  await pool.query(`
    UPDATE series_library
    SET last_notified_episode = (next_airing_episode->>'episode')::int - 1
    WHERE last_notified_episode IS NULL
      AND next_airing_episode IS NOT NULL
      AND (next_airing_episode->>'airingAt')::bigint <= EXTRACT(EPOCH FROM NOW());
  `);

  // season_list = metadado das temporadas (TMDB); NULL = ainda não backfilled.
  // season_states = estado do usuário por temporada ({ "1": {status,score,notes,lastAccessAt} });
  // score da série = média das notas > 0. Ver backfillSeriesSeasons e setSeasonState.
  await pool.query(`
    ALTER TABLE series_library
    ADD COLUMN IF NOT EXISTS season_list JSONB,
    ADD COLUMN IF NOT EXISTS season_scores JSONB,
    ADD COLUMN IF NOT EXISTS season_states JSONB;
  `);

  // Converte o formato antigo (season_scores = { "1": 8.5 }) para season_states.
  await pool.query(`
    UPDATE series_library
    SET season_states = (
      SELECT jsonb_object_agg(
        key,
        jsonb_build_object('status', 'plan_to_watch', 'score', (value)::numeric)
      )
      FROM jsonb_each_text(season_scores)
    )
    WHERE season_states IS NULL AND season_scores IS NOT NULL AND season_scores <> '{}'::jsonb;
  `);

  // Zera nota legada da série (antes das temporadas o modal da série tinha campo
  // Nota): score da série é a média das temporadas avaliadas, então nota sem
  // nenhuma temporada avaliada é fantasma. Roda a cada boot — a condição só bate
  // em linha inconsistente.
  await pool.query(`
    UPDATE series_library
    SET score = 0
    WHERE score > 0
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_each(COALESCE(season_states, '{}'::jsonb)) AS state(key, value)
        WHERE (value->>'score')::numeric > 0
      );
  `);

  // Número da temporada usada como capa da coleção (NULL = pôster da série).
  await pool.query(`
    ALTER TABLE series_library
    ADD COLUMN IF NOT EXISTS cover_season INTEGER;
  `);

  // Status de exibição cru do TMDB ("Returning Series"/"Ended"/"Canceled"/...).
  // Distinto de series_status (RELEASED/UPCOMING, derivado da data de estreia).
  // NULL = nunca sincronizado; findStaleSeries usa isso para fazer o backfill.
  await pool.query(`
    ALTER TABLE series_library
    ADD COLUMN IF NOT EXISTS air_status TEXT;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'game_library' AND column_name = 'rawg_id'
      ) THEN
        DROP TABLE game_library;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_library (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      igdb_id           INTEGER NOT NULL UNIQUE,
      title             TEXT NOT NULL,
      background_image  TEXT,
      status            TEXT NOT NULL DEFAULT 'plan_to_play',
      score             NUMERIC(3,1) DEFAULT 0,
      released          TEXT,
      metacritic        INTEGER,
      game_status       TEXT NOT NULL DEFAULT 'RELEASED',
      finished_at       TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    UPDATE game_library
    SET background_image = REPLACE(background_image, 'https://images.igdb.com/igdb/image/upload', '/api/game/image')
    WHERE background_image LIKE 'https://images.igdb.com/igdb/image/upload/%';
  `);

  await pool.query(`
    ALTER TABLE game_library
    ADD COLUMN IF NOT EXISTS collection_id INTEGER;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_game_library_collection_id ON game_library (collection_id);
  `);

  await pool.query(`
    ALTER TABLE game_library
    ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await pool.query(`
    ALTER TABLE game_library
    ADD COLUMN IF NOT EXISTS release_notified_at TIMESTAMPTZ;
  `);

  // NULL = ainda não backfilled; [] = jogo sem modo conhecido. Distinção usada
  // pelo backfill (backfillGameModes) para só reprocessar linhas nunca buscadas.
  await pool.query(`
    ALTER TABLE game_library
    ADD COLUMN IF NOT EXISTS game_modes TEXT[];
  `);

  // NULL = nunca sincronizado com a IGDB; findStaleGames pega essas primeiro.
  await pool.query(`
    ALTER TABLE game_library
    ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS books_library (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      hardcover_id     INTEGER NOT NULL UNIQUE,
      title            TEXT NOT NULL,
      cover_image      TEXT,
      authors          TEXT,
      status           TEXT NOT NULL DEFAULT 'plan_to_read',
      score            NUMERIC(3,1) DEFAULT 0,
      published_date   TEXT,
      page_count       INTEGER,
      read_at          TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE books_library
    ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  // Livros migraram do Google Books para a Hardcover: o id externo passou a ser INTEGER e
  // não existe mapeamento confiável entre os dois catálogos (as linhas antigas eram
  // duplicatas do lixo do Google Books — o mesmo "Hunger Games" três vezes, box sets,
  // nenhuma lida). A biblioteca é recriada pela Hardcover. A sequência é idempotente e se
  // desliga: depois da primeira subida toda linha tem hardcover_id e o DELETE não casa
  // com nada — importante porque migrate() roda a cada boot.
  await pool.query(`ALTER TABLE books_library ADD COLUMN IF NOT EXISTS hardcover_id INTEGER;`);
  await pool.query(`DELETE FROM books_library WHERE hardcover_id IS NULL;`);
  await pool.query(`ALTER TABLE books_library DROP COLUMN IF EXISTS google_books_id;`);
  await pool.query(`ALTER TABLE books_library ALTER COLUMN hardcover_id SET NOT NULL;`);
  // Este é o nome que o UNIQUE do CREATE TABLE gera: no banco novo o IF NOT EXISTS vira
  // no-op, no antigo cria o índice. ON CONFLICT (hardcover_id) exige índice único.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS books_library_hardcover_id_key ON books_library (hardcover_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS youtube_collection (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS youtube_library (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id          TEXT NOT NULL UNIQUE,
      title             TEXT NOT NULL,
      channel_title     TEXT,
      thumbnail         TEXT,
      duration_seconds  INTEGER,
      view_count        BIGINT,
      published_at      TEXT,
      description       TEXT,
      status            TEXT NOT NULL DEFAULT 'plan_to_watch',
      score             NUMERIC(3,1) DEFAULT 0,
      liked_at          TIMESTAMPTZ,
      collection_id     INTEGER REFERENCES youtube_collection(id) ON DELETE SET NULL,
      is_cover          BOOLEAN NOT NULL DEFAULT FALSE,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE youtube_library
    ADD COLUMN IF NOT EXISTS channel_id TEXT,
    ADD COLUMN IF NOT EXISTS channel_thumbnail TEXT,
    ADD COLUMN IF NOT EXISTS collection_id INTEGER REFERENCES youtube_collection(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_youtube_library_collection_id ON youtube_library (collection_id);
  `);

  await pool.query(`
    UPDATE youtube_library
    SET status = 'liked', liked_at = COALESCE(liked_at, created_at)
    WHERE status = 'plan_to_watch';
  `);

  await pool.query(`
    ALTER TABLE youtube_library ALTER COLUMN status SET DEFAULT 'liked';
  `);

  // Anotação livre do usuário. NULL = nunca anotado. Séries não têm coluna: a
  // anotação é por temporada e mora dentro de season_states.
  await pool.query(`ALTER TABLE anime_library   ADD COLUMN IF NOT EXISTS notes TEXT;`);
  await pool.query(`ALTER TABLE movie_library   ADD COLUMN IF NOT EXISTS notes TEXT;`);
  await pool.query(`ALTER TABLE game_library    ADD COLUMN IF NOT EXISTS notes TEXT;`);
  await pool.query(`ALTER TABLE books_library   ADD COLUMN IF NOT EXISTS notes TEXT;`);
  await pool.query(`ALTER TABLE youtube_library ADD COLUMN IF NOT EXISTS notes TEXT;`);

  // Tags do vídeo (só o YouTube): N por vídeo, `{}` = sem tag — sem dualidade
  // NULL/vazio. O vocabulário sai do DISTINCT dos próprios dados, não de tabela.
  await pool.query(`
    ALTER TABLE youtube_library ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
  `);

  // Modelos anteriores de classificação do YouTube (tag única escopada à coleção e o
  // par categoria/subcategoria) foram substituídos pelo array `tags`.
  await pool.query(`
    ALTER TABLE youtube_library
    DROP COLUMN IF EXISTS tag,
    DROP COLUMN IF EXISTS category,
    DROP COLUMN IF EXISTS subcategory;
  `);

  // Tag só existe dentro de coleção: vídeo avulso não pode carregar tag. Roda a cada
  // boot e só toca linha inconsistente (mesmo espírito do reset de score em séries).
  await pool.query(`
    UPDATE youtube_library SET tags = '{}'
     WHERE collection_id IS NULL AND cardinality(tags) > 0;
  `);

  // Última vez assistido/jogado. Distinta do timestamp de conclusão, que marca a
  // PRIMEIRA conclusão e é zerado ao sair do status concluído. NULL = nunca.
  // Livros ficam fora (só read_at).
  await pool.query(`ALTER TABLE anime_library   ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE movie_library   ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE series_library  ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE game_library    ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE youtube_library ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;`);

  // Backfill: o que já estava concluído tem a conclusão como último acesso
  // conhecido. Roda a cada boot e só toca linha ainda sem data — as duas colunas
  // passam a ser gravadas juntas, então uma linha nova nunca cai aqui.
  // O YouTube não entra: liked_at é quando o vídeo foi curtido, não quando foi
  // aberto, e NULL = "nunca abri" é a semântica correta.
  await pool.query(`
    UPDATE anime_library SET last_access_at = watched_at
     WHERE last_access_at IS NULL AND watched_at IS NOT NULL;
  `);
  await pool.query(`
    UPDATE movie_library SET last_access_at = watched_at
     WHERE last_access_at IS NULL AND watched_at IS NOT NULL;
  `);
  await pool.query(`
    UPDATE series_library SET last_access_at = watched_at
     WHERE last_access_at IS NULL AND watched_at IS NOT NULL;
  `);
  await pool.query(`
    UPDATE game_library SET last_access_at = finished_at
     WHERE last_access_at IS NULL AND finished_at IS NOT NULL;
  `);

  // Reassistindo/rejogando deixou de existir: marcar como concluído é tudo, e
  // rever de novo é o `touchAccess` (só a data de último acesso avança).
  await pool.query(`ALTER TABLE anime_library   DROP COLUMN IF EXISTS is_rewatching;`);
  await pool.query(`ALTER TABLE movie_library   DROP COLUMN IF EXISTS is_rewatching;`);
  await pool.query(`ALTER TABLE series_library  DROP COLUMN IF EXISTS is_rewatching;`);
  await pool.query(`ALTER TABLE game_library    DROP COLUMN IF EXISTS is_rewatching;`);
  await pool.query(`ALTER TABLE youtube_library DROP COLUMN IF EXISTS is_rewatching;`);

  // A mesma limpeza dentro do JSONB das temporadas: `setSeasonState` faz merge,
  // então a chave sobreviveria para sempre. Guardado pelo LIKE — só toca linha
  // que ainda tem a chave.
  await pool.query(`
    UPDATE series_library
    SET season_states = (
      SELECT jsonb_object_agg(key, value - 'isRewatching')
      FROM jsonb_each(season_states)
    )
    WHERE season_states IS NOT NULL AND season_states::text LIKE '%isRewatching%';
  `);

  await pool.query(`UPDATE anime_library  SET status = 'plan_to_watch' WHERE status = 'watching';`);
  await pool.query(`UPDATE series_library SET status = 'plan_to_watch' WHERE status = 'watching';`);
  await pool.query(`UPDATE game_library   SET status = 'plan_to_play'  WHERE status = 'playing';`);
  await pool.query(`UPDATE books_library  SET status = 'plan_to_read'  WHERE status = 'reading';`);

  // Coleção de livros = série em destaque da Hardcover (`featured_series`), pela mesma
  // máquina de filmes/jogos: collection_id guarda o id da série e é a coluna de coleção
  // do is_cover. series_position é NUMERIC porque a posição da Hardcover é float8 com
  // meio-valor real (0.5 para conto, 3.5 para novela) e é ela que ordena a expansão, não
  // a data de publicação. series_name vem grátis na mesma resposta e evita uma
  // requisição só para escrever "Mistborn #2" — e tem de ficar fora de findStaleBooks.
  await pool.query(`
    ALTER TABLE books_library
    ADD COLUMN IF NOT EXISTS collection_id   INTEGER,
    ADD COLUMN IF NOT EXISTS series_name     TEXT,
    ADD COLUMN IF NOT EXISTS series_position NUMERIC(6,2);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_books_library_collection_id ON books_library (collection_id);
  `);

  // RELEASED/UPCOMING derivado da data — a Hardcover tem lançamento futuro de verdade
  // dentro de série e também data nula em livro antigo (ver deriveBookStatus).
  // NULL em synced_at = nunca sincronizado; findStaleBooks pega essas primeiro.
  await pool.query(`
    ALTER TABLE books_library
    ADD COLUMN IF NOT EXISTS book_status         TEXT NOT NULL DEFAULT 'RELEASED',
    ADD COLUMN IF NOT EXISTS synced_at           TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_access_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS release_notified_at TIMESTAMPTZ;
  `);

  // Mesmo backfill das outras mídias: o que já estava lido tem a conclusão como último
  // acesso conhecido. Só toca linha ainda sem data.
  await pool.query(`
    UPDATE books_library SET last_access_at = read_at
     WHERE last_access_at IS NULL AND read_at IS NOT NULL;
  `);
}
