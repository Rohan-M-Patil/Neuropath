/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0A0E14",
        synapse: "#0F1521",
        ember: "#FF7A45",
        cortex: "#7C9CFF",
        myelin: "#E8ECF4",
        dim: "#5C6B82",
        mastered: "#4ADE80",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(124,156,255,0.35)",
        emberGlow: "0 0 24px rgba(255,122,69,0.35)",
      },
      animation: {
        pulse_slow: "pulse 3s ease-in-out infinite",
        dash: "dash 20s linear infinite",
      },
      keyframes: {
        dash: {
          to: { strokeDashoffset: "-1000" },
        },
      },
    },
  },
  plugins: [],
}
