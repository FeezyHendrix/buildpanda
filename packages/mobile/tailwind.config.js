/** Native snapshot of buildpanda-v2 tokens; shared with JS icon/navigation colors. */
const { colors } = require("./src/constants/design-tokens.json");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        inter: ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
        "inter-extrabold": ["Inter_800ExtraBold"],
        "heading-semibold": ["Archivo_600SemiBold"],
        "heading-bold": ["Archivo_700Bold"],
      },
      colors,
    },
  },
  plugins: [],
};
