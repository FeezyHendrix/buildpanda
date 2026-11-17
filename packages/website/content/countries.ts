import { markets } from "./markets/countries";

export type Country = { code: string; name: string; dial: string };

// ITU E.164 country calling codes; names and geographic coverage come from the catalog.
const africanDialCodes: Readonly<Record<string, string>> = {
  DZ: "+213", EG: "+20", LY: "+218", MA: "+212", SD: "+249", TN: "+216",
  BJ: "+229", BF: "+226", CV: "+238", CI: "+225", GM: "+220", GH: "+233",
  GN: "+224", GW: "+245", LR: "+231", ML: "+223", MR: "+222", NE: "+227",
  NG: "+234", SN: "+221", SL: "+232", TG: "+228", AO: "+244", CM: "+237",
  CF: "+236", TD: "+235", CG: "+242", CD: "+243", GQ: "+240", GA: "+241",
  ST: "+239", BI: "+257", KM: "+269", DJ: "+253", ER: "+291", ET: "+251",
  KE: "+254", MG: "+261", MW: "+265", MU: "+230", MZ: "+258", RW: "+250",
  SC: "+248", SO: "+252", SS: "+211", TZ: "+255", UG: "+256", ZM: "+260",
  ZW: "+263", BW: "+267", SZ: "+268", LS: "+266", NA: "+264", ZA: "+27",
};

/** Countries offered in phone fields. The first is the default. */
const preferredCountries: ReadonlyArray<Country> = [
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

export const countries: ReadonlyArray<Country> = [
  ...preferredCountries,
  ...markets.filter((market) => !preferredCountries.some((country) => country.code === market.code))
    .map((market) => ({ code: market.code, name: market.name, dial: africanDialCodes[market.code] })),
];
