export const measurementSheetFields = [
  { key: "height", label: "Height (in)" },
  { key: "backHeight", label: "Back height (in)" },
  { key: "neck", label: "Neck (in)" },
  { key: "width", label: "Width (in)" },
  { key: "hand", label: "Hand (in)" },
  { key: "shoulder", label: "Shoulder (in)" },
] as const;

export const additionalMeasurementFields = [
  { key: "chest", label: "Chest (in)" },
  { key: "waist", label: "Waist (in)" },
  { key: "sleeve", label: "Sleeve (in)" },
  { key: "length", label: "Length (in)" },
] as const;

export const measurementDisplayFields = [
  ...measurementSheetFields,
  ...additionalMeasurementFields,
  { key: "fitPreference", label: "Fit preference" },
  { key: "collarStyle", label: "Collar type" },
  { key: "collarConfiguration", label: "Collar configuration" },
  { key: "pocketStyle", label: "Pocket style" },
] as const;

export const collarTypeOptions = [
  { value: "Bahraini", label: "Bahraini / بحريني" },
  { value: "Hijazi", label: "Hijazi / حجازي" },
  { value: "Kuwaiti", label: "Kuwaiti / كويتي" },
  { value: "Qatari", label: "Qatari / قطري" },
  { value: "Emirati", label: "Emirati / إماراتي" },
  { value: "Omani", label: "Omani / عماني" },
] as const;

export const collarConfigurationOptions = ["1", "2", "3", "4"] as const;
export const pocketStyleOptions = ["1", "2", "3", "4", "5", "6", "7"] as const;
export const fitPreferenceOptions = ["Standard", "Slim", "Relaxed"] as const;
