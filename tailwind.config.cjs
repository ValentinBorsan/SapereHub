/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./views/partials/**/*.ejs",
    "./public/js/**/*.js",
  ],
  // SAFELIST: Forțăm generarea acestor clase pentru a testa conexiunea
  safelist: [
    "bg-sapereOrange",
    "text-sapereOrange",
    "border-sapereOrange",
    "bg-sapereCard",
    "bg-sapereDark",
    "font-serif",
  ],
  theme: {
    extend: {
      colors: {
        sapereOrange: "#f59e0b",
        sapereCard: "#1e293b",
        sapereDark: "#0f172a",
      },
      fontFamily: {
        serif: ["Merriweather", "serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
