import { MonthlyPresentations, MonthlySuperMeta, AppSettings, ReceivableAdjustments } from "./types";

const PRESENTATIONS_KEY = "comissao_presentations";
const SETTINGS_KEY = "comissao_settings";
const SUPER_META_KEY = "comissao_super_meta";
const ADJUSTMENTS_KEY = "comissao_adjustments";

const defaultSettings: AppSettings = {
  fixedSalary: 3500,
  commissionRate: 0.20,
  superMetaThreshold: 30,
  superMetaMultiplier: 2,
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getPresentations(): MonthlyPresentations {
  const data = load<MonthlyPresentations>(PRESENTATIONS_KEY, {});
  // Migrate old format (number values) to new format
  const migrated: MonthlyPresentations = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "number") {
      migrated[key] = { bluepex: value, opus: 0 };
    } else {
      migrated[key] = value;
    }
  }
  return migrated;
}

export function savePresentations(data: MonthlyPresentations) {
  save(PRESENTATIONS_KEY, data);
}

export function getSettings(): AppSettings {
  return load<AppSettings>(SETTINGS_KEY, defaultSettings);
}

export function saveSettings(settings: AppSettings) {
  save(SETTINGS_KEY, settings);
}

export function getSuperMeta(): MonthlySuperMeta {
  return load<MonthlySuperMeta>(SUPER_META_KEY, {});
}

export function saveSuperMeta(data: MonthlySuperMeta) {
  save(SUPER_META_KEY, data);
}

export function getAdjustments(): ReceivableAdjustments {
  return load<ReceivableAdjustments>(ADJUSTMENTS_KEY, {});
}

export function saveAdjustments(data: ReceivableAdjustments) {
  save(ADJUSTMENTS_KEY, data);
}
