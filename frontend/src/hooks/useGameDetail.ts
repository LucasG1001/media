import { useEffect, useRef, useState } from "react";
import type { GameDetail } from "../types/game";
import { fetchGameById } from "../services/gameService";

interface GameDetailState {
  game: GameDetail | null;
  loading: boolean;
  error: boolean;
}

// Detalhe de um jogo para quem troca de item sem remontar (drawer e visão de
// detalhe). O payload é guardado junto com o id a que pertence e loading/error
// saem daí por derivação: estado solto seguiria falando do item anterior
// (mostrando-o enquanto busca, ou grudando um erro antigo).
export function useGameDetail(gameId: number, onLoad?: (game: GameDetail) => void): GameDetailState {
  const [loaded, setLoaded] = useState<{ id: number; data: GameDetail } | null>(null);
  const [failedId, setFailedId] = useState<number | null>(null);
  const game = loaded?.id === gameId ? loaded.data : null;
  const error = failedId === gameId;

  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    onLoadRef.current = onLoad;
  });

  useEffect(() => {
    let active = true;
    fetchGameById(gameId)
      .then((data) => {
        if (!active) return;
        setLoaded({ id: gameId, data });
        onLoadRef.current?.(data);
      })
      .catch(() => {
        if (active) setFailedId(gameId);
      });

    return () => {
      active = false;
    };
  }, [gameId]);

  return { game, loading: !game && !error, error };
}
