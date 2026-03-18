/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: ["./index.html", "./**/*.js"],
    theme: {
        extend: {
            colors: {
                "primary": "#38bdf8",
                "primary-light": "#7dd3fc",
                "accent-cyan": "#2dd4bf",
                "background-light": "#f3efe8",
                "background-dark": "#0b1120",
                "surface-dark": "#111a2e",
                "surface-darker": "#0d1424",
                "border-dark": "#1e2d4a",
                "surface-light": "#ede8df",
                "surface-lighter": "#e8e2d8",
                "border-light": "#d4cdc2",
            },
            fontFamily: {
                "display": ["Space Grotesk", "sans-serif"],
                "mono": ["JetBrains Mono", "monospace"],
            },
            borderRadius: { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
            backgroundImage: {
                'grid-pattern-dark': "radial-gradient(ellipse at center, rgba(56,189,248,0.03) 0%, transparent 70%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
                'grid-pattern-light': "linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)",
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries')
    ],
}
