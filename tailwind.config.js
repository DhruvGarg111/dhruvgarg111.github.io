/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: ["./index.html", "./**/*.js"],
    theme: {
        extend: {
            colors: {
                "primary": "#ff7e29",
                "background-light": "#faf7f2",
                "background-dark": "#0c1220",
                "surface-dark": "#141e30",
                "surface-darker": "#0f172a",
                "border-dark": "#1e293b",
                "surface-light": "#f5f0e8",
                "surface-lighter": "#efe9dd",
                "border-light": "#ddd5c8",
            },
            fontFamily: {
                "display": ["Space Grotesk", "sans-serif"],
                "mono": ["JetBrains Mono", "monospace"],
            },
            borderRadius: { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
            backgroundImage: {
                'grid-pattern-dark': "radial-gradient(ellipse at center, rgba(255,126,41,0.03) 0%, transparent 70%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
                'grid-pattern-light': "linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)",
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries')
    ],
}
