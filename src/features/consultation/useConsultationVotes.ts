"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  clearVotes,
  readVotes,
  storageKeyForTopic,
  writeVotes,
  type ConsultationVoteMap,
} from "@/features/consultation/consultation-storage";

function emitVotesChanged(topicId: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(`ostt-consult-${topicId}`));
}

export function useConsultationVotes(topicId: string) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKeyForTopic(topicId)) {
          onStoreChange();
        }
      };
      const onLocal = () => onStoreChange();
      window.addEventListener("storage", onStorage);
      window.addEventListener(`ostt-consult-${topicId}`, onLocal);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(`ostt-consult-${topicId}`, onLocal);
      };
    },
    [topicId],
  );

  const getSnapshot = useCallback(() => {
    return JSON.stringify(readVotes(topicId));
  }, [topicId]);

  const getServerSnapshot = useCallback(() => "{}", []);

  const serialized = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const votes = useMemo(
    () => JSON.parse(serialized) as ConsultationVoteMap,
    [serialized],
  );

  const persist = useCallback(
    (next: ConsultationVoteMap) => {
      writeVotes(topicId, next);
      emitVotesChanged(topicId);
    },
    [topicId],
  );

  const reset = useCallback(() => {
    clearVotes(topicId);
    emitVotesChanged(topicId);
  }, [topicId]);

  return { votes, persist, reset };
}
