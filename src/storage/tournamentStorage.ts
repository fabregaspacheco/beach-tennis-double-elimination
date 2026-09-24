import { doc, onSnapshot, setDoc, type FirestoreError } from 'firebase/firestore';
import { db } from '../firebase';
import type { Tournament } from '../types';

// Every device that opens the app reads/writes this single document — simplest possible
// "database", and one onSnapshot listener is enough to keep every viewer live-updated.
const TOURNAMENTS_DOC = doc(db, 'app', 'tournaments');

const LEGACY_LOCAL_STORAGE_KEY = 'bt-tournaments-v1';

/** One-off carry-over of any tournaments saved locally before Firestore existed. */
function readLegacyLocalTournaments(): Tournament[] {
  try {
    const raw = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Tournament[]) : [];
  } catch {
    return [];
  }
}

/**
 * Subscribes to the tournaments document in real time. Calls `onChange` immediately with the
 * current data and again every time it changes — locally or from any other device. Returns an
 * unsubscribe function.
 */
export function subscribeTournaments(
  onChange: (tournaments: Tournament[]) => void,
  onError?: (error: FirestoreError) => void,
): () => void {
  return onSnapshot(
    TOURNAMENTS_DOC,
    (snapshot) => {
      const data = snapshot.data();
      const remote = Array.isArray(data?.list) ? (data.list as Tournament[]) : [];

      if (!snapshot.exists()) {
        const legacy = readLegacyLocalTournaments();
        if (legacy.length > 0) {
          saveTournaments(legacy).catch(() => {});
          onChange(legacy);
          return;
        }
      }

      onChange(remote);
    },
    (error) => onError?.(error),
  );
}

export function saveTournaments(tournaments: Tournament[]): Promise<void> {
  return setDoc(TOURNAMENTS_DOC, { list: tournaments, updatedAt: Date.now() });
}
