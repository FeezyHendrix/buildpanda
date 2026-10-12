export type Country = { code: string; name: string; dial: string };

/** Countries offered in phone fields. The first is the default. */
export const countries: ReadonlyArray<Country> = [
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "GH", name: "Ghana", dial: "+233" },
  { code: "KE", name: "Kenya", dial: "+254" },
];
