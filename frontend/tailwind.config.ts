import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "var(--bg)",
        panel: "var(--panel)",
        ink: "var(--ink)",
        accent: "var(--accent)",
        ember: "var(--ember)",
      },
      animation: {
        rise: "rise 0.4s ease-out",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
