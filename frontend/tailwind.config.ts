import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#10252b",
        tide: "#0d5f73",
        sand: "#f4ead5",
        surf: "#dbf0f2",
        coral: "#f16d5b",
        kelp: "#29584a"
      },
      boxShadow: {
        panel: "0 24px 60px rgba(16, 37, 43, 0.14)"
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)"
      }
    }
  },
  plugins: []
};

export default config;
