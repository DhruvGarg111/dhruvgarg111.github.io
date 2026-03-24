module.exports = {
  content: ["./index.html", "./assets/**/*.js"],
  theme: {
    extend: {
      colors: {
        void:     "#0b0b0f",
        ink:      "#121218",
        charcoal: "#1a1a22",
        slate:    "#2a2a34",
        ash:      "#3a3a46",
        mist:     "#8a8a96",
        bone:     "#e8e6e1",
        cream:    "#f5f3ee",
        gold:     "#c5a059",
        "gold-dim": "#a07d3a",
        copper:   "#d4956a",
        arctic:   "#b0c6f9",
      },
      fontFamily: {
        display: ["'Instrument Serif'", "serif"],
        body:    ["'Satoshi'", "sans-serif"],
        mono:    ["'DM Mono'", "monospace"],
      },
    },
  },
  plugins: [],
}
