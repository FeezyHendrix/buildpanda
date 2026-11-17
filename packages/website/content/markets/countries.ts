export const regions = ["north", "west", "central", "east", "south"] as const;
export type Region = (typeof regions)[number];
export type Market = { code: string; name: string; slug: string; region: Region };

// UN member countries, grouped using UN M49 regions. This is an editorial
// directory, not a claim of offices, certifications or local service availability.
const directory: Record<Region, readonly (readonly [string, string, string])[]> = {
  north: [
    ["DZ", "Algeria", "algeria"], ["EG", "Egypt", "egypt"], ["LY", "Libya", "libya"],
    ["MA", "Morocco", "morocco"], ["SD", "Sudan", "sudan"], ["TN", "Tunisia", "tunisia"],
  ],
  west: [
    ["BJ", "Benin", "benin"], ["BF", "Burkina Faso", "burkina-faso"], ["CV", "Cabo Verde", "cabo-verde"],
    ["CI", "Côte d’Ivoire", "cote-divoire"], ["GM", "Gambia", "gambia"], ["GH", "Ghana", "ghana"],
    ["GN", "Guinea", "guinea"], ["GW", "Guinea-Bissau", "guinea-bissau"], ["LR", "Liberia", "liberia"],
    ["ML", "Mali", "mali"], ["MR", "Mauritania", "mauritania"], ["NE", "Niger", "niger"],
    ["NG", "Nigeria", "nigeria"], ["SN", "Senegal", "senegal"], ["SL", "Sierra Leone", "sierra-leone"],
    ["TG", "Togo", "togo"],
  ],
  central: [
    ["AO", "Angola", "angola"], ["CM", "Cameroon", "cameroon"], ["CF", "Central African Republic", "central-african-republic"],
    ["TD", "Chad", "chad"], ["CG", "Republic of the Congo", "republic-of-the-congo"],
    ["CD", "Democratic Republic of the Congo", "democratic-republic-of-the-congo"],
    ["GQ", "Equatorial Guinea", "equatorial-guinea"], ["GA", "Gabon", "gabon"],
    ["ST", "São Tomé and Príncipe", "sao-tome-and-principe"],
  ],
  east: [
    ["BI", "Burundi", "burundi"], ["KM", "Comoros", "comoros"], ["DJ", "Djibouti", "djibouti"],
    ["ER", "Eritrea", "eritrea"], ["ET", "Ethiopia", "ethiopia"], ["KE", "Kenya", "kenya"],
    ["MG", "Madagascar", "madagascar"], ["MW", "Malawi", "malawi"], ["MU", "Mauritius", "mauritius"],
    ["MZ", "Mozambique", "mozambique"], ["RW", "Rwanda", "rwanda"], ["SC", "Seychelles", "seychelles"],
    ["SO", "Somalia", "somalia"], ["SS", "South Sudan", "south-sudan"], ["TZ", "Tanzania", "tanzania"],
    ["UG", "Uganda", "uganda"], ["ZM", "Zambia", "zambia"], ["ZW", "Zimbabwe", "zimbabwe"],
  ],
  south: [
    ["BW", "Botswana", "botswana"], ["SZ", "Eswatini", "eswatini"], ["LS", "Lesotho", "lesotho"],
    ["NA", "Namibia", "namibia"], ["ZA", "South Africa", "south-africa"],
  ],
};

export const markets: readonly Market[] = regions.flatMap((region) =>
  directory[region].map(([code, name, slug]) => ({ code, name, slug, region })),
);

export function marketBySlug(slug: string): Market | undefined {
  return markets.find((market) => market.slug === slug);
}
