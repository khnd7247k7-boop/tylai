/** Manual body circumference logs (inches), keyed by calendar day. */
export type CustomBodyMeasurement = {
  id: string;
  /** Display name, e.g. "Neck", "Left arm" */
  label: string;
  value: number;
  /** Defaults to inches when omitted. */
  unit?: string;
};

export type MeasurementEntry = {
  id: string;
  date: string;
  waistIn?: number;
  chestIn?: number;
  hipsIn?: number;
  /** User-defined measurements beyond the defaults. */
  custom?: CustomBodyMeasurement[];
};
