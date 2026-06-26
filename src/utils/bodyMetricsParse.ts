/** Parse free-form height/weight strings from onboarding or settings. */

export function parseAgeYears(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  const n = typeof input === 'number' ? input : parseInt(String(input).replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n) || n < 13 || n > 100) return null;
  return n;
}

export function parseWeightToKg(
  input: string | number | null | undefined,
  unitPreference: 'imperial' | 'metric' = 'imperial'
): number | null {
  if (input == null) return null;
  if (typeof input === 'number' && input > 0) return input;

  const raw = String(input).trim().toLowerCase();
  if (!raw) return null;

  const num = parseFloat(raw.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return null;

  if (/\bkg\b|kilogram/.test(raw)) return num;
  if (/\blb|lbs|pound/.test(raw)) return num * 0.45359237;

  if (unitPreference === 'metric') {
    if (num >= 30 && num <= 250) return num;
    return null;
  }

  // Imperial bare number — treat as pounds.
  if (num >= 50 && num <= 550) return num * 0.45359237;
  if (num >= 30 && num <= 120) return num;
  return null;
}

export function parseHeightToCm(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === 'number' && input > 0) return input;

  const raw = String(input).trim().toLowerCase();
  if (!raw) return null;

  if (/\bcm\b|centimeter/.test(raw)) {
    const cm = parseFloat(raw.replace(/[^\d.]/g, ''));
    return Number.isFinite(cm) && cm >= 120 && cm <= 230 ? cm : null;
  }

  const feetInches =
    raw.match(/(\d+)\s*['′]\s*(\d+)/) ||
    raw.match(/(\d+)\s*(?:ft|feet|foot)\s*(\d+)\s*(?:in|inch|inches)?/);
  if (feetInches) {
    const feet = parseInt(feetInches[1], 10);
    const inches = parseInt(feetInches[2], 10);
    if (feet >= 4 && feet <= 7 && inches >= 0 && inches < 12) {
      return Math.round((feet * 12 + inches) * 2.54);
    }
  }

  const spaceOrDashFeetInches = raw.match(/^(\d)\s*[-\s]\s*(\d{1,2})$/);
  if (spaceOrDashFeetInches) {
    const feet = parseInt(spaceOrDashFeetInches[1], 10);
    const inches = parseInt(spaceOrDashFeetInches[2], 10);
    if (feet >= 4 && feet <= 7 && inches >= 0 && inches < 12) {
      return Math.round((feet * 12 + inches) * 2.54);
    }
  }

  const compact = raw.replace(/[^\d]/g, '');
  if (/^\d{3}$/.test(compact)) {
    const feet = parseInt(compact[0], 10);
    const inches = parseInt(compact.slice(1), 10);
    if (feet >= 4 && feet <= 7 && inches >= 0 && inches < 12) {
      return Math.round((feet * 12 + inches) * 2.54);
    }
  }

  const meters = raw.match(/(\d(?:\.\d+)?)\s*m\b/);
  if (meters) {
    const m = parseFloat(meters[1]);
    if (m >= 1.2 && m <= 2.3) return Math.round(m * 100);
  }

  const bare = parseFloat(raw.replace(/[^\d.]/g, ''));
  if (Number.isFinite(bare) && bare >= 120 && bare <= 230) return bare;

  if (/^\d{2,3}$/.test(compact)) {
    const inches = parseInt(compact, 10);
    if (inches >= 48 && inches <= 84) {
      return Math.round(inches * 2.54);
    }
  }

  return null;
}

export function formatWeightDisplay(kg: number, unit: 'imperial' | 'metric'): string {
  if (unit === 'metric') return `${Math.round(kg)} kg`;
  return `${Math.round(kg / 0.45359237)} lbs`;
}

export function formatHeightDisplay(cm: number, unit: 'imperial' | 'metric'): string {
  if (unit === 'metric') return `${Math.round(cm)} cm`;
  const totalIn = Math.round(cm / 2.54);
  const feet = Math.floor(totalIn / 12);
  const inches = totalIn % 12;
  return `${feet}'${inches}"`;
}
