export type ConsultationVote = "agree" | "disagree" | "pass";

export type ConsultationVoteMap = Record<string, ConsultationVote>;

const storagePrefix = "ostt-consult-votes:";

export function storageKeyForTopic(topicId: string): string {
  return `${storagePrefix}${topicId}`;
}

export function readVotes(topicId: string): ConsultationVoteMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.sessionStorage.getItem(storageKeyForTopic(topicId));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as ConsultationVoteMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeVotes(topicId: string, votes: ConsultationVoteMap): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(
    storageKeyForTopic(topicId),
    JSON.stringify(votes),
  );
}

export function clearVotes(topicId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(storageKeyForTopic(topicId));
}

export const MIN_RESPONSES_TO_OPEN_REPORT = 3;
