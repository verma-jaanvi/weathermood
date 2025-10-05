// ===================================================
// 🔹 MAIN SERVER (GUARANTEED WORKING)
// ===================================================
require('dotenv').config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const FileStore = require('session-file-store')(session);

// Add at the top of backend/server.js
const CONFIG = require('../config');  // ← Go up one level to root

console.log(`🚀 Starting ${CONFIG.PROJECT.NAME} v${CONFIG.PROJECT.VERSION}`);
console.log(`📁 GitHub: ${CONFIG.PROJECT.GITHUB_URL}`);

// The rest of your server code...

const SpotifyFallback = require('./spotifyFallback');

// Add this near the top of server.js after the imports
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

const PORT = process.env.PORT || 5000;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET;

const app = express();

// ===================================================
// 🔹 MIDDLEWARE
// ===================================================
app.use(cors({
    origin: ['http://127.0.0.1:5000'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use(session({
    store: new FileStore({
        path: path.join(__dirname, 'sessions'),
        ttl: 86400,
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ===================================================
// 🔹 WEATHER ROUTES
// ===================================================
async function fetchWeatherData(url) {
    const response = await axios.get(url);
    const { name, main, weather } = response.data;
    return {
        city: name,
        temp: Math.round(main.temp),
        condition: weather[0].main,
        humidity: main.humidity,
    };
}

app.get("/weather", async (req, res, next) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ error: "Latitude and longitude are required" });
        }
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric`;
        const weatherData = await fetchWeatherData(url);
        res.json(weatherData);
    } catch (err) {
        next(err);
    }
});

app.get("/weather/city", async (req, res, next) => {
    try {
        const { city } = req.query;
        if (!city) {
            return res.status(400).json({ error: "City is required" });
        }
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`;
        const weatherData = await fetchWeatherData(url);
        res.json(weatherData);
    } catch (err) {
        next(err);
    }
});

// ===================================================
// 🔹 SPOTIFY AUTH ROUTES
// ===================================================
app.get("/login", (req, res) => {
    const scope = [
        "user-read-private",
        "user-read-email",
        "user-top-read",
        "user-library-read",
        "user-read-playback-state",
        "streaming",
        "playlist-modify-public",    // ✅ NEW: Create public playlists
        "playlist-modify-private"    // ✅ NEW: Create private playlists
    ].join(" ");

    const params = new URLSearchParams({
        response_type: "code",
        client_id: process.env.SPOTIFY_CLIENT_ID,
        scope: scope,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// ===================================================
// 🔹 SPOTIFY AUTH CALLBACK
// ===================================================
app.get("/callback", async (req, res, next) => {
    try {
        const code = req.query.code;
        const error = req.query.error;

        if (error) {
            console.error('Spotify auth error:', error);
            return res.redirect('/?error=auth_failed');
        }

        if (!code) {
            console.error('No authorization code received');
            return res.redirect('/?error=no_code');
        }

        console.log('🔄 Exchanging code for access token...');

        // Add timeout to the token request
        const tokenResponse = await axios.post(
            `https://accounts.spotify.com/api/token`,
            new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": "Basic " + Buffer.from(
                        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                    ).toString("base64"),
                },
                timeout: 10000, // 10 second timeout
            }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        if (!access_token) {
            throw new Error('No access token received from Spotify');
        }

        // Store tokens in session
        req.session.access_token = access_token;
        req.session.refresh_token = refresh_token;
        req.session.token_expires = Date.now() + (expires_in * 1000);

        console.log('✅ User logged in successfully');
        res.redirect('/');

    } catch (err) {
        console.error('❌ Callback error:', err.message);
        
        if (err.code === 'ECONNABORTED') {
            console.error('Spotify API timeout - server might be busy');
            res.redirect('/?error=timeout');
        } else if (err.response) {
            console.error('Spotify API error:', err.response.status, err.response.data);
            res.redirect('/?error=spotify_api');
        } else {
            next(err);
        }
    }
});

// ===================================================
// 🔹 SPOTIFY TOKEN REFRESH MIDDLEWARE
// ===================================================
async function refreshSpotifyToken(req, res, next) {
    if (!req.session.refresh_token) {
        return next();
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const tokenExpires = req.session.token_expires;
    if (tokenExpires && Date.now() < tokenExpires - 300000) {
        return next();
    }

    try {
        console.log('🔄 Refreshing Spotify token...');
        
        const tokenResponse = await axios.post(
            `https://accounts.spotify.com/api/token`,
            new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: req.session.refresh_token,
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": "Basic " + Buffer.from(
                        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                    ).toString("base64"),
                },
                timeout: 10000,
            }
        );

        req.session.access_token = tokenResponse.data.access_token;
        req.session.token_expires = Date.now() + (tokenResponse.data.expires_in * 1000);
        
        console.log('✅ Token refreshed successfully');
        next();
    } catch (err) {
        console.error('❌ Token refresh failed:', err.message);
        // Clear invalid tokens
        req.session.access_token = null;
        req.session.refresh_token = null;
        next();
    }
}

// Apply to all routes that need Spotify access
app.use(['/me', '/recommendations', '/search', '/create-playlist'], refreshSpotifyToken);

app.get("/me", async (req, res, next) => {
    try {
        if (!req.session.access_token) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const response = await axios.get(`https://api.spotify.com/v1/me`, {
            headers: { Authorization: `Bearer ${req.session.access_token}` },
        });

        const { id, display_name, email, images } = response.data;
        res.json({
            id,
            name: display_name,
            email,
            image: images?.[0]?.url || null,
        });

    } catch (err) {
        next(err);
    }
});

app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: "Could not log out." });
        }
        res.status(200).json({ message: "Logged out successfully" });
    });
});

// ===================================================
// 🔹 WORKING RECOMMENDATIONS ROUTE
// ===================================================
app.get("/recommendations", async (req, res, next) => {
    try {
        const { condition } = req.query;

        console.log('🎵 Getting music recommendations for:', condition);

        if (!condition) {
            return res.status(400).json({ error: "Weather condition is required" });
        }

        if (!req.session.access_token) {
            return res.status(401).json({ error: "Please login with Spotify first" });
        }

        // Use our fallback service
        const spotifyService = new SpotifyFallback(req.session.access_token);
        const result = await spotifyService.getMusicForWeather(condition);

        console.log(`✅ Success! Got ${result.tracks.length} tracks using method: ${result.method}`);

        // Get mood based on weather
        let mood = "Good Vibes 🎵";
        let description = "Great music for your current weather";

        const weatherLower = condition.toLowerCase();
        if (weatherLower.includes('clear') || weatherLower.includes('sunny')) {
            mood = "Sunny Vibes 🎉";
            description = "Bright and energetic music for sunny days";
        } else if (weatherLower.includes('rain') || weatherLower.includes('drizzle')) {
            mood = "Rainy Chill 🌧️";
            description = "Calm and soothing music for rainy days";
        } else if (weatherLower.includes('storm') || weatherLower.includes('thunder')) {
            mood = "Stormy Energy ⚡";
            description = "Powerful and intense music for stormy weather";
        } else if (weatherLower.includes('cloud') || weatherLower.includes('overcast')) {
            mood = "Cloudy Moods ☁️";
            description = "Thoughtful and mellow music for cloudy days";
        } else if (weatherLower.includes('snow') || weatherLower.includes('cold')) {
            mood = "Cozy Snow ❄️";
            description = "Warm and cozy music for cold days";
        } else if (weatherLower.includes('fog') || weatherLower.includes('mist')) {
            mood = "Mysterious Fog 🌫️";
            description = "Atmospheric and mysterious music for foggy days";
        } else if (weatherLower.includes('wind') || weatherLower.includes('breeze')) {
            mood = "Windy Adventure 🌬️";
            description = "Epic and adventurous music for windy days";
        } else if (weatherLower.includes('haze') || weatherLower.includes('smoke')) {
            mood = "Mysterious Haze 💨";
            description = "Dark and atmospheric music for hazy conditions";
        }

        // Format response
        const recommendations = {
            success: true,
            mood: mood,
            description: description,
            condition: condition,
            method: result.method,
            searchTerm: result.searchTerm,
            tracks: result.tracks.map(track => ({
                id: track.id,
                name: track.name,
                artists: track.artists.map(artist => artist.name),
                album: track.album.name,
                image: track.album.images[0]?.url,
                preview_url: track.preview_url,
                external_url: track.external_urls.spotify,
                duration_ms: track.duration_ms
            }))
        };

        res.json(recommendations);

    } catch (err) {
        console.error('❌ Final error:', err.message);
        res.status(500).json({
            error: "We're having trouble getting music right now. Please try again in a few minutes."
        });
    }
});

// ===================================================
// 🔹 TEST ROUTE
// ===================================================
app.get("/test-music", async (req, res) => {
    if (!req.session.access_token) {
        return res.status(401).json({ error: "Please login first" });
    }

    const spotifyService = new SpotifyFallback(req.session.access_token);

    try {
        const result = await spotifyService.getMusicForWeather('sunny');
        res.json({
            success: true,
            method: result.method,
            tracksCount: result.tracks.length,
            firstTrack: result.tracks[0]?.name || 'No tracks'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===================================================
// 🔹 SPOTIFY SEARCH ROUTE
// ===================================================
app.get("/search", async (req, res, next) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ error: "Search query is required" });
        }

        if (!req.session.access_token) {
            return res.status(401).json({ error: "Please login with Spotify first" });
        }

        const response = await axios.get(`${SPOTIFY_API_URL}/search`, {
            headers: { Authorization: `Bearer ${req.session.access_token}` },
            params: {
                q: q,
                type: 'track',
                limit: 20,
                market: 'US'
            }
        });

        res.json({
            success: true,
            query: q,
            tracks: response.data.tracks.items
        });

    } catch (err) {
        console.error('Search error:', err.message);
        next(err);
    }
});

// ===================================================
// 🔹 PLAYLIST CREATION ROUTE
// ===================================================
app.post("/create-playlist", async (req, res, next) => {
    try {
        const { playlistName, description, trackUris, isPublic } = req.body;

        console.log('🎵 Creating playlist:', playlistName);

        if (!req.session.access_token) {
            return res.status(401).json({ error: "Please login with Spotify first" });
        }

        if (!playlistName || !trackUris || !Array.isArray(trackUris)) {
            return res.status(400).json({ error: "Playlist name and tracks are required" });
        }

        // Step 1: Get user ID
        const userResponse = await axios.get(`${SPOTIFY_API_URL}/me`, {
            headers: { Authorization: `Bearer ${req.session.access_token}` },
        });
        const userId = userResponse.data.id;

        // Step 2: Create empty playlist
        const createPlaylistResponse = await axios.post(
            `${SPOTIFY_API_URL}/users/${userId}/playlists`,
            {
                name: playlistName,
                description: description || "Created with WeatherMood 🎵",
                public: isPublic !== false // default to public
            },
            {
                headers: { Authorization: `Bearer ${req.session.access_token}` },
            }
        );

        const playlistId = createPlaylistResponse.data.id;
        const playlistUrl = createPlaylistResponse.data.external_urls.spotify;

        // Step 3: Add tracks to playlist
        if (trackUris.length > 0) {
            // Spotify accepts max 100 tracks per request
            const trackChunks = [];
            for (let i = 0; i < trackUris.length; i += 100) {
                trackChunks.push(trackUris.slice(i, i + 100));
            }

            // Add tracks in chunks
            for (const chunk of trackChunks) {
                await axios.post(
                    `${SPOTIFY_API_URL}/playlists/${playlistId}/tracks`,
                    {
                        uris: chunk
                    },
                    {
                        headers: { Authorization: `Bearer ${req.session.access_token}` },
                    }
                );
            }
        }

        console.log(`✅ Playlist created successfully: ${playlistUrl}`);

        res.json({
            success: true,
            playlist: {
                id: playlistId,
                name: playlistName,
                url: playlistUrl,
                trackCount: trackUris.length
            },
            message: "Playlist created successfully! 🎉"
        });

    } catch (err) {
        console.error('❌ Playlist creation error:', err.message);
        if (err.response) {
            console.error('Error details:', err.response.data);
        }
        next(err);
    }
});

// ===================================================
// 🔹 SERVE FRONTEND
// ===================================================
app.use(express.static(path.join(__dirname, "../frontend")));

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ===================================================
// 🔹 START SERVER
// ===================================================
app.listen(PORT, () => {
    console.log(`✅ Server running on http://127.0.0.1:${PORT}`);
    console.log(`🎵 Music service READY - Using fallback methods`);
});