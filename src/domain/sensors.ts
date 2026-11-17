import type { Metric } from "./types";
export const metrics: Record<
  Metric,
  { label: string; unit: string; digits: number }
> = {
  temp: { label: "온도", unit: "°C", digits: 1 },
  humid: { label: "습도", unit: "%", digits: 1 },
  pm1: { label: "PM1.0", unit: "µg/m³", digits: 0 },
  pm10: { label: "PM10", unit: "µg/m³", digits: 0 },
  pm25: { label: "PM2.5", unit: "µg/m³", digits: 0 },
  tvoc: { label: "TVOC", unit: "ppb", digits: 0 },
  eco2: { label: "추정 CO₂", unit: "ppm", digits: 0 },
  co2: { label: "실측 CO₂", unit: "ppm", digits: 0 },
  dp: { label: "차압", unit: "Pa", digits: 2 },
};
