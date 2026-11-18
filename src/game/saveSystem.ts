import { WeaponId } from './types';

const SAVE_KEY = 'djelfa_mosaab_save_v1';

export interface SavedProgress {
  missionIndex: number;
  cash: number;
  kills: number;
  hp: number;
  armor?: number;
  unlockedWeapons: WeaponId[];
  activeWeapon: WeaponId;
  playerX: number;
  playerZ: number;
  savedAt: string;
}

export function loadSavedProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgress;
    if (typeof parsed.missionIndex !== 'number' || !Array.isArray(parsed.unlockedWeapons)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSavedProgress(data: SavedProgress): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedProgress(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
