export const measurementFields = [
  { key: "lengthFL", label: "Length FL", type: "text" },
  { key: "lengthBL", label: "Length BL", type: "text" },
  { key: "chestWhole", label: "Chest Whole", type: "text" },
  { key: "chestHalf", label: "Chest Half", type: "text" },
  { key: "shoulder", label: "Shoulder", type: "text" },
  { key: "sleeveLength", label: "Sleeve Length", type: "text" },
  { key: "armHoleLoose", label: "Arm Hole Loose", type: "text" },
  { key: "neck", label: "Neck", type: "text" },
  { key: "hip", label: "Hip", type: "text" },
  { key: "bottom", label: "Bottom", type: "text" },
  { key: "fo", label: "FO", type: "text" },
  { key: "model", label: "Model", type: "text" },
  { key: "upperPocket", label: "Upper Pocket", type: "text" },
  { key: "cuffling", label: "Cuffling", type: "text" },
  { key: "openHand", label: "Open Hand", type: "text" },
  { key: "embroidery", label: "Embroidery", type: "text" },
] as const;

export const measurementDisplayFields = measurementFields;

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
