import { chunk } from "../lib/chunk.js";
import { fetchGameModes } from "./igdbService.js";
import { findIgdbIdsWithoutModes, setGameModes } from "../models/gameLibraryModel.js";

// Preenche game_modes dos jogos já salvos que ainda não foram processados
// (coluna NULL). Idempotente: linhas já com valor ([] inclusive) não voltam.
const BATCH_SIZE = 200;

export async function backfillGameModes(): Promise<number> {
  const ids = await findIgdbIdsWithoutModes();
  if (ids.length === 0) return 0;

  let updated = 0;
  for (const batch of chunk(ids, BATCH_SIZE)) {
    const modes = await fetchGameModes(batch);
    for (const igdbId of batch) {
      await setGameModes(igdbId, modes.get(igdbId) ?? []);
      updated += 1;
    }
  }
  return updated;
}
