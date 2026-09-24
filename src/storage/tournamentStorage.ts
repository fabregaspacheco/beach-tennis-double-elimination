import type { Tournament } from '../types';

const STORAGE_KEY = 'bt-tournaments-v1';

export function loadTournaments(): Tournament[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Tournament[]) : [];
  } catch {
    return [];
  }
}

export function saveTournaments(tournaments: Tournament[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
  } catch {
    // localStorage indisponível (modo privado, quota excedida etc.) — segue sem persistir.
  }
}
