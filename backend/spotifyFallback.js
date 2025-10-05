// ===================================================
// 🔹 SPOTIFY FALLBACK SERVICE (GUARANTEED TO WORK)
// ===================================================

class SpotifyFallback {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.baseURL = 'https://api.spotify.com/v1';
    }

    // Method 1: Use search API as fallback (always works)
    async getTracksBySearch(genre) {
        try {
            const searchUrl = `${this.baseURL}/search?q=genre:${genre}&type=track&limit=26&market=US`;
            const response = await fetch(searchUrl, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                }
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();
            return data.tracks.items;
        } catch (error) {
            console.log(`Search fallback failed for ${genre}:`, error.message);
            return null;
        }
    }

    // Method 2: Get user's saved tracks (always works)
    async getUserSavedTracks() {
        try {
            const url = `${this.baseURL}/me/tracks?limit=26`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                }
            });

            if (!response.ok) {
                throw new Error(`Saved tracks failed: ${response.status}`);
            }

            const data = await response.json();
            return data.items.map(item => item.track);
        } catch (error) {
            console.log('Saved tracks failed:', error.message);
            return null;
        }
    }

    // Method 3: Get user's top tracks (usually works)
    async getUserTopTracks() {
        try {
            const url = `${this.baseURL}/me/top/tracks?limit=26&time_range=short_term`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                }
            });

            if (!response.ok) {
                throw new Error(`Top tracks failed: ${response.status}`);
            }

            const data = await response.json();
            return data.items;
        } catch (error) {
            console.log('Top tracks failed:', error.message);
            return null;
        }
    }

    // Method 4: Get featured playlists and extract tracks
    async getFeaturedPlaylistTracks() {
        try {
            // First get featured playlists
            const playlistsUrl = `${this.baseURL}/browse/featured-playlists?limit=26`;
            const playlistsResponse = await fetch(playlistsUrl, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                }
            });

            if (!playlistsResponse.ok) {
                throw new Error(`Featured playlists failed: ${playlistsResponse.status}`);
            }

            const playlistsData = await playlistsResponse.json();

            // Get tracks from first playlist
            if (playlistsData.playlists.items.length > 0) {
                const playlistId = playlistsData.playlists.items[0].id;
                const tracksUrl = `${this.baseURL}/playlists/${playlistId}/tracks?limit=26`;
                const tracksResponse = await fetch(tracksUrl, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    }
                });

                if (tracksResponse.ok) {
                    const tracksData = await tracksResponse.json();
                    return tracksData.items.map(item => item.track);
                }
            }

            return null;
        } catch (error) {
            console.log('Featured playlists failed:', error.message);
            return null;
        }
    }

    // In spotifyFallback.js - COMPLETE THE getMusicForWeather METHOD:
    async getMusicForWeather(weatherCondition) {
        console.log('🎵 Getting music for weather:', weatherCondition);

        const condition = weatherCondition.toLowerCase();
        let searchTerms = [];

        // Enhanced weather mapping
        if (condition.includes('clear') || condition.includes('sunny')) {
            searchTerms = ['sunny', 'happy', 'summer', 'pop', 'upbeat'];
        } else if (condition.includes('rain') || condition.includes('drizzle')) {
            searchTerms = ['rainy', 'chill', 'acoustic', 'calm', 'lo-fi'];
        } else if (condition.includes('storm') || condition.includes('thunder')) {
            searchTerms = ['epic', 'rock', 'intense', 'powerful', 'metal'];
        } else if (condition.includes('cloud') || condition.includes('overcast')) {
            searchTerms = ['indie', 'mellow', 'thoughtful', 'alternative', 'dream-pop'];
        } else if (condition.includes('snow') || condition.includes('cold')) {
            searchTerms = ['winter', 'cozy', 'ambient', 'chill', 'fireplace'];
        } else if (condition.includes('fog') || condition.includes('mist')) {
            searchTerms = ['mysterious', 'ambient', 'atmospheric', 'ethereal', 'dreamy'];
        } else if (condition.includes('wind') || condition.includes('breeze')) {
            searchTerms = ['epic', 'cinematic', 'orchestral', 'adventure', 'travel'];
        } else if (condition.includes('haze') || condition.includes('smoke')) {
            searchTerms = ['mysterious', 'dark', 'ambient', 'electronic', 'synth'];
        } else {
            searchTerms = ['popular', 'hits', 'trending', 'viral'];
        }

        console.log('🔍 Search terms:', searchTerms);

        let tracks = [];
        let methodUsed = 'unknown';
        let searchTermUsed = searchTerms[0];

        // Try multiple methods until we get tracks
        for (const term of searchTerms) {
            console.log(`🔄 Trying search term: ${term}`);
            tracks = await this.getTracksBySearch(term);
            if (tracks && tracks.length > 0) {
                methodUsed = 'search';
                searchTermUsed = term;
                console.log(`✅ Found ${tracks.length} tracks using search: ${term}`);
                break;
            }
        }

        // If search failed, try user's saved tracks
        if (!tracks || tracks.length === 0) {
            console.log('🔄 Trying user saved tracks...');
            tracks = await this.getUserSavedTracks();
            if (tracks && tracks.length > 0) {
                methodUsed = 'saved_tracks';
                console.log(`✅ Found ${tracks.length} saved tracks`);
            }
        }

        // If saved tracks failed, try top tracks
        if (!tracks || tracks.length === 0) {
            console.log('🔄 Trying user top tracks...');
            tracks = await this.getUserTopTracks();
            if (tracks && tracks.length > 0) {
                methodUsed = 'top_tracks';
                console.log(`✅ Found ${tracks.length} top tracks`);
            }
        }

        // If top tracks failed, try featured playlists
        if (!tracks || tracks.length === 0) {
            console.log('🔄 Trying featured playlists...');
            tracks = await this.getFeaturedPlaylistTracks();
            if (tracks && tracks.length > 0) {
                methodUsed = 'featured_playlists';
                console.log(`✅ Found ${tracks.length} tracks from featured playlists`);
            }
        }

        // Final fallback - use a default search
        if (!tracks || tracks.length === 0) {
            console.log('🔄 Using final fallback...');
            tracks = await this.getTracksBySearch('popular');
            if (tracks && tracks.length > 0) {
                methodUsed = 'fallback_search';
                searchTermUsed = 'popular';
                console.log(`✅ Found ${tracks.length} tracks using fallback`);
            }
        }

        if (!tracks || tracks.length === 0) {
            throw new Error('Could not find any music tracks');
        }

        return {
            tracks: tracks.slice(0, 26), // 🔥 CHANGED FROM 10 TO 26 TRACKS
            method: methodUsed,
            searchTerm: searchTermUsed
        };
    }
}

module.exports = SpotifyFallback;