declare module 'expo-health' {
  export interface HealthDateRange {
    startDate: Date;
    endDate: Date;
  }

  export interface HealthSample {
    value?: number;
    startDate?: string | Date;
    timestamp?: string | Date;
  }

  export function requestPermissionsAsync(options: {
    permissions: string[];
  }): Promise<{
    status?: string;
    permissions?: Record<string, string>;
  }>;

  export function getPermissionsAsync(): Promise<{
    status?: string;
    permissions?: Record<string, string>;
  }>;

  export function getHeartRateAsync(range: HealthDateRange): Promise<HealthSample[]>;

  export function getActiveEnergyAsync(range: HealthDateRange): Promise<HealthSample[]>;

  export function getStepsAsync(range: HealthDateRange): Promise<HealthSample[]>;

  export function getDistanceAsync(range: HealthDateRange): Promise<HealthSample[]>;
}
