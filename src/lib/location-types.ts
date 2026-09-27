/** A location chosen in the Sun Tracker (shared with everyone on the project). */
export type Place = {
  name: string;
  subtitle: string;
  lat: number;
  lon: number;
  /** IANA zone if known up front (place search provides it; weather fills it in otherwise). */
  timeZone?: string;
  source: "gps" | "search";
};
