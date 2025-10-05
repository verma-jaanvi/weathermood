// config.js - Project Configuration
const CONFIG = {
    PROJECT: {
        NAME: "WeatherMood",
        VERSION: "1.0.0",
        GITHUB_URL: "https://github.com/verma-jaanvi/weathermood",
        DESCRIPTION: "Create music playlists based on your weather",
        AUTHOR: "verma-jaanvi"
    },
    APP: {
        PORT: process.env.PORT || 5000,
        SESSION_SECRET: process.env.SESSION_SECRET
    }
};

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// Make available in browser
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}