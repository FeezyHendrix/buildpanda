/**
 * Mirrors the `@theme` block in packages/frontend/src/styles/index.css so a
 * colour named here means the same thing it does on web. Keep the two in sync;
 * drift is how the two clients stop looking like one product.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // React Native picks a face by family name, not by numeric weight, so each
      // cut is its own family. `font-bold` alone would render regular here.
      // Distinct keys, not `bold`/`semibold`: those collide with Tailwind's
      // font-weight utilities of the same name.
      fontFamily: {
        jakarta: ["PlusJakartaSans_400Regular"],
        "jakarta-medium": ["PlusJakartaSans_500Medium"],
        "jakarta-semibold": ["PlusJakartaSans_600SemiBold"],
        "jakarta-bold": ["PlusJakartaSans_700Bold"],
        "jakarta-extrabold": ["PlusJakartaSans_800ExtraBold"],
      },
      colors: {
        primary: {
          50: "#E6EDFD",
          100: "#B0C8F8",
          200: "#8BACF1",
          300: "#5488EF",
          400: "#3371EE",
          500: "#004DE7",
          600: "#0046D2",
          700: "#0037A4",
          800: "#002A7F",
          900: "#002061",
        },
        brand: "#004DE7",
        // The exact neutrals packages/frontend uses in components, named so we
        // never hand-pick a near-miss shade.
        surface: "#FFFFFF",
        "surface-alt": "#F6F6F6",
        canvas: "#FAFAFA",
        hairline: "#F0F0F0",
        success: {
          50: "#E8FCF4",
          100: "#B8F7DD",
          500: "#1AE592",
          600: "#18D085",
          700: "#13A368",
        },
        error: {
          50: "#FDEAE8",
          100: "#F8BFB9",
          500: "#E9301C",
          600: "#D42C19",
          700: "#A52214",
        },
        warning: {
          50: "#FAFFE6",
          100: "#EEFFB0",
          500: "#C8FF00",
          600: "#B6E800",
        },
        grey: {
          50: "#EDEDED",
          100: "#C8C8C8",
          200: "#ADADAD",
          300: "#888888",
          400: "#717171",
          500: "#4D4D4D",
          600: "#464646",
          700: "#373737",
          800: "#2A2A2A",
          900: "#202020",
        },
        black: {
          50: "#E7E7E7",
          100: "#B5B5B5",
          200: "#929292",
          300: "#606060",
          400: "#414141",
          500: "#1A1A1A",
          600: "#0F0F0F",
          700: "#0C0C0C",
          800: "#090909",
          900: "#070707",
        },
      },
    },
  },
  plugins: [],
};
