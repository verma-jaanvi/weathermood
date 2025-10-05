// Add this at the top of frontend/script.js to verify config is loaded
console.log('Project:', window.CONFIG?.PROJECT?.NAME || 'Config not loaded');

// Update your share function
function shareRecommendations() {
    const data = window.currentWeatherData;
    if (!data) {
        alert('No recommendations to share');
        return;
    }
    
    // Use the GitHub URL from config
    const projectUrl = window.CONFIG?.PROJECT?.GITHUB_URL || "https://github.com/verma-jaanvi/weathermood";
    
    const shareText = `🎵 ${data.mood} - ${data.tracks.length} tracks for ${data.condition} weather!\n\n` +
                     `I discovered this amazing playlist using WeatherMood - an app that creates music playlists based on your current weather! 🌤️🎶\n\n` +
                     `Check out the project: ${projectUrl}\n\n` +
                     `Featured tracks:\n` +
                     `${data.tracks.slice(0, 3).map((track, index) => `${index + 1}. ${track.name} - ${track.artists.join(', ')}`).join('\n')}`;
    
    if (navigator.share) {
        navigator.share({
            title: `🎵 ${data.mood} - WeatherMood Playlist`,
            text: shareText,
            url: projectUrl
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            alert('Playlist copied to clipboard! Share it with your friends! 📋\n\nProject: ' + projectUrl);
        });
    }
}

// =========================
// 🔹 STATE MANAGEMENT
// =========================
let appState = {
    isLoggedIn: false,
    userProfile: null,
    currentWeather: null,
    currentRecommendations: null,
    searchResults: null
};

// =========================
// 🔹 EVENT LISTENERS
// =========================
document.addEventListener("DOMContentLoaded", () => {
    fetchUserProfile();
    loadWeatherByGeolocation();
    
    // Dashboard event listeners
    document.getElementById('search-toggle')?.addEventListener('click', toggleSearch);
    document.getElementById('search-button')?.addEventListener('click', performSearch);
    document.getElementById('dashboard-logout')?.addEventListener('click', logout);
    document.getElementById('dashboard-play-music')?.addEventListener('click', getMusicRecommendations);
    
    // Enter key for search
    document.getElementById('search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
});

// =========================
// 🔹 SPOTIFY FUNCTIONS
// =========================
async function fetchUserProfile() {
    try {
        const res = await fetch("/me");
        if (!res.ok) {
            updateUIForLoggedOutUser();
            return;
        }
        const profile = await res.json();
        appState.userProfile = profile;
        appState.isLoggedIn = true;
        updateUIForLoggedInUser(profile);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        updateUIForLoggedOutUser();
    }
}

function updateUIForLoggedInUser(profile) {
    // Show dashboard, hide landing page
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('landing-section').classList.add('hidden');
    
    // Update dashboard profile
    document.getElementById('dashboard-profile-name').textContent = `Welcome, ${profile.name}!`;
    document.getElementById('dashboard-email').textContent = profile.email || 'Spotify User';
    
    const profilePic = document.getElementById('dashboard-profile-pic');
    const spotifyPlaceholderIcon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNhMGEwYTAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCIvPjwvc3ZnPg==';
    profilePic.src = profile.image || spotifyPlaceholderIcon;
    profilePic.alt = profile.name;

    // Also update original profile section (for consistency)
    updateOriginalProfileSection(profile);
}

function updateOriginalProfileSection(profile) {
    document.getElementById('profile-section').classList.remove('hidden');
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('music-section').classList.remove('hidden');

    document.getElementById('profile-name').textContent = profile.name;
    const profilePic = document.getElementById('profile-pic');
    const spotifyPlaceholderIcon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNhMGEwYTAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCIvPjwvc3ZnPg==';
    profilePic.src = profile.image || spotifyPlaceholderIcon;
    profilePic.alt = profile.name;

    document.getElementById('logout-button').addEventListener('click', logout);
    document.getElementById('play-music').addEventListener('click', getMusicRecommendations);
}

function updateUIForLoggedOutUser() {
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('landing-section').classList.remove('hidden');
    document.getElementById('profile-section').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('music-section').classList.add('hidden');
}

async function logout() {
    try {
        await fetch('/logout', { method: 'POST' });
        window.location.reload();
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// =========================
// 🔹 WEATHER FUNCTIONS
// =========================
function loadWeatherByGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchWeatherByLocation(position.coords.latitude, position.coords.longitude);
            },
            (err) => {
                console.warn(`Geolocation error: ${err.message}`);
                fetchWeatherByCity('London');
            }
        );
    } else {
        fetchWeatherByCity('London');
    }
}

function fetchWeatherByLocation(latitude, longitude) {
    const url = `/weather?lat=${latitude}&lon=${longitude}`;
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            updateWeatherUI(data);
        })
        .catch(err => {
            console.error('Location weather failed:', err);
            fetchWeatherByCity('London');
        });
}

function fetchWeatherByCity(cityName) {
    const url = `/weather/city?city=${encodeURIComponent(cityName)}`;
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            updateWeatherUI(data);
        })
        .catch(err => {
            console.error('City weather failed:', err);
            showWeatherError();
        });
}

function updateWeatherUI(data) {
    appState.currentWeather = data;
    
    // Update dashboard weather
    document.getElementById("dashboard-city").textContent = `🌍 ${data.city}`;
    document.getElementById("dashboard-temperature").textContent = `${data.temp}°C`;
    document.getElementById("dashboard-condition").textContent = `${data.condition}`;
    document.getElementById('dashboard-play-music').setAttribute('data-condition', data.condition);
    
    // Update original weather display
    document.getElementById("city").textContent = `🌍 ${data.city}`;
    document.getElementById("temperature").textContent = `${data.temp}°C`;
    document.getElementById("condition").textContent = `${data.condition}`;
    document.getElementById('play-music').setAttribute('data-condition', data.condition);
}

function showWeatherError() {
    const errorData = { city: "Location Unknown", temp: "--", condition: "Weather unavailable" };
    appState.currentWeather = errorData;
    
    document.getElementById("dashboard-city").textContent = "🌍 Location Unknown";
    document.getElementById("dashboard-temperature").textContent = "--°C";
    document.getElementById("dashboard-condition").textContent = "Weather unavailable";
    document.getElementById('dashboard-play-music').setAttribute('data-condition', 'clear');
    
    document.getElementById("city").textContent = "🌍 Location Unknown";
    document.getElementById("temperature").textContent = "--°C";
    document.getElementById("condition").textContent = "Weather unavailable";
    document.getElementById('play-music').setAttribute('data-condition', 'clear');
}

// =========================
// 🔹 MUSIC RECOMMENDATIONS
// =========================
async function getMusicRecommendations() {
    const button = event.target;
    const condition = button.getAttribute('data-condition');
    
    if (!condition) {
        alert('Please wait for weather data to load...');
        return;
    }

    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Finding Music...';
    button.disabled = true;

    try {
        const response = await fetch(`/recommendations?condition=${encodeURIComponent(condition)}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get recommendations');
        }

        const data = await response.json();
        appState.currentRecommendations = data;
        displayDashboardRecommendations(data);

    } catch (error) {
        console.error('Error getting recommendations:', error);
        alert('Sorry! ' + error.message);
    } finally {
        button.innerHTML = '<i class="fas fa-music mr-2"></i>Get Mood Music';
        button.disabled = false;
    }
}

// =========================
// 🔹 DASHBOARD RECOMMENDATIONS DISPLAY
// =========================
// In the displayDashboardRecommendations function, update the share section:
function displayDashboardRecommendations(data) {
    const container = document.getElementById('dashboard-recommendations');
    const trackUris = data.tracks.map(track => `spotify:track:${track.id}`);
    
    // Store for playlist creation
    window.currentTrackUris = trackUris;
    window.currentWeatherData = data;

    container.innerHTML = `
        <div class="bg-white/10 rounded-xl p-4 mb-4">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-lg font-bold">${data.mood}</h4>
                    <p class="text-sm opacity-80">${data.description}</p>
                    <p class="text-xs opacity-60 mt-1">${data.tracks.length} tracks • ${data.method === 'search' ? 'Search: ' + data.searchTerm : 'Method: ' + data.method}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="createPlaylistFromTracks()" 
                            class="bg-green-500 hover:bg-green-600 px-3 py-2 rounded-lg text-sm font-semibold transition transform hover:scale-105">
                        <i class="fas fa-save mr-1"></i>Save Playlist
                    </button>
                    <div class="relative group">
                        <button class="bg-purple-500 hover:bg-purple-600 px-3 py-2 rounded-lg text-sm font-semibold transition transform hover:scale-105">
                            <i class="fas fa-share mr-1"></i>Share
                        </button>
                        <!-- Share dropdown menu -->
                        <div class="absolute right-0 mt-1 w-48 bg-white/95 backdrop-blur-md rounded-lg shadow-xl z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                            <div class="py-1">
                                <button onclick="shareRecommendations()" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-500 hover:text-white flex items-center gap-2">
                                    <i class="fas fa-share-alt"></i>Share with Web API
                                </button>
                                <button onclick="shareRecommendationsAsText()" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white flex items-center gap-2">
                                    <i class="fas fa-copy"></i>Copy as Text
                                </button>
                                <button onclick="shareAsTwitter()" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-400 hover:text-white flex items-center gap-2">
                                    <i class="fab fa-twitter"></i>Share on Twitter
                                </button>
                                <button onclick="shareAsWhatsApp()" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-500 hover:text-white flex items-center gap-2">
                                    <i class="fab fa-whatsapp"></i>Share on WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                ${data.tracks.map(track => `
                    <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition">
                        <img src="${track.image}" alt="${track.album}" class="w-12 h-12 rounded-lg shadow-md">
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-sm truncate">${track.name}</p>
                            <p class="text-xs opacity-80 truncate">${track.artists.join(', ')}</p>
                            <p class="text-xs opacity-60 truncate">${track.album}</p>
                        </div>
                        <div class="flex gap-1">
                            ${track.preview_url ? `
                                <audio controls class="h-8 w-24">
                                    <source src="${track.preview_url}" type="audio/mpeg">
                                </audio>
                            ` : '<span class="text-xs opacity-60 px-2">No preview</span>'}
                            <a href="${track.external_url}" target="_blank" 
                               class="bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-xs font-semibold transition">
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Remove any existing playlist form or success message
    const existingForm = document.getElementById('dashboard-playlist-form');
    const existingSuccess = document.getElementById('dashboard-playlist-success');
    if (existingForm) existingForm.remove();
    if (existingSuccess) existingSuccess.remove();
}

// =========================
// 🔹 SOCIAL MEDIA SHARE FUNCTIONS
// =========================
function shareAsTwitter() {
    const data = window.currentWeatherData;
    if (!data) return;
    
    const text = `🎵 ${data.mood} - ${data.tracks.length} tracks for ${data.condition} weather! Generated by WeatherMood 🌤️🎶`;
    const url = 'https://github.com/verma-jaanvi/weathermood'; // Your project URL
    const hashtags = 'WeatherMood,Music,Weather,Playlist';
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
}

function shareAsWhatsApp() {
    const data = window.currentWeatherData;
    if (!data) return;
    
    const text = `🎵 ${data.mood} - ${data.tracks.length} tracks for ${data.condition} weather!\n\nCheck out this amazing playlist generated by WeatherMood! 🌤️🎶`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
}

function shareAsFacebook() {
    const data = window.currentWeatherData;
    if (!data) return;
    
    const text = `🎵 ${data.mood} - Discovered this amazing weather-based playlist!`;
    const url = 'https://github.com/verma-jaanvi/weathermood';
    
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
}

// =========================
// 🔹 SEARCH FUNCTIONALITY
// =========================
function toggleSearch() {
    const searchCard = document.getElementById('search-card');
    searchCard.classList.toggle('hidden');
    
    // Clear previous results when closing
    if (searchCard.classList.contains('hidden')) {
        document.getElementById('search-results').innerHTML = '';
        document.getElementById('search-input').value = '';
    }
}

async function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    
    if (!query) {
        alert('Please enter a search term');
        return;
    }

    const button = document.getElementById('search-button');
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    button.disabled = true;

    try {
        // You'll need to implement this endpoint in your server
        const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error('Search failed');
        }

        const data = await response.json();
        appState.searchResults = data;
        displaySearchResults(data);

    } catch (error) {
        console.error('Search error:', error);
        alert('Search failed: ' + error.message);
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

function displaySearchResults(data) {
    const container = document.getElementById('search-results');
    
    if (!data.tracks || data.tracks.length === 0) {
        container.innerHTML = '<p class="text-center opacity-70 py-4">No results found</p>';
        return;
    }

    container.innerHTML = data.tracks.map(track => `
        <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition">
            <img src="${track.album.images[0]?.url}" alt="${track.album.name}" class="w-12 h-12 rounded-lg">
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm truncate">${track.name}</p>
                <p class="text-xs opacity-80 truncate">${track.artists.map(a => a.name).join(', ')}</p>
            </div>
            <div class="flex gap-1">
                ${track.preview_url ? `
                    <audio controls class="h-8 w-24">
                        <source src="${track.preview_url}" type="audio/mpeg">
                    </audio>
                ` : ''}
                <a href="${track.external_urls.spotify}" target="_blank" 
                   class="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-xs font-semibold transition">
                    Open
                </a>
            </div>
        </div>
    `).join('');
}

// =========================
// 🔹 PLAYLIST & SHARE FUNCTIONS (Keep existing ones)
// =========================
// ... (Keep your existing createPlaylistFromTracks, confirmCreatePlaylist, hidePlaylistForm, shareRecommendations functions)

// =========================
// 🔹 PLAYLIST CREATION FUNCTIONS
// =========================
function createPlaylistFromTracks() {
    // Create or show playlist form in dashboard
    let playlistForm = document.getElementById('dashboard-playlist-form');
    
    if (!playlistForm) {
        // Create playlist form if it doesn't exist
        playlistForm = document.createElement('div');
        playlistForm.id = 'dashboard-playlist-form';
        playlistForm.className = 'mt-4 p-4 bg-white/10 rounded-xl';
        playlistForm.innerHTML = `
            <h4 class="font-semibold mb-3 flex items-center gap-2">
                <i class="fas fa-plus-circle"></i>Create Spotify Playlist
            </h4>
            <div class="space-y-3">
                <div>
                    <label class="block text-sm opacity-80 mb-1">Playlist Name</label>
                    <input type="text" id="dashboard-playlist-name" 
                           value="${window.currentWeatherData?.mood || 'WeatherMood'} - ${window.currentWeatherData?.condition || 'Weather'} Playlist" 
                           class="w-full px-3 py-2 bg-white/10 rounded-lg text-white placeholder-white/50 border border-white/20">
                </div>
                <div>
                    <label class="block text-sm opacity-80 mb-1">Description</label>
                    <input type="text" id="dashboard-playlist-desc" 
                           value="🎵 Curated by WeatherMood for ${window.currentWeatherData?.condition?.toLowerCase() || 'current'} weather" 
                           class="w-full px-3 py-2 bg-white/10 rounded-lg text-white placeholder-white/50 border border-white/20">
                </div>
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="dashboard-playlist-public" checked class="rounded bg-white/10">
                    <label class="text-sm opacity-80">Public playlist</label>
                </div>
                <div class="flex gap-2">
                    <button onclick="confirmDashboardCreatePlaylist()" 
                            class="flex-1 bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
                        <i class="fas fa-check mr-1"></i>Create Playlist
                    </button>
                    <button onclick="hideDashboardPlaylistForm()" 
                            class="flex-1 bg-gray-500 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
                        <i class="fas fa-times mr-1"></i>Cancel
                    </button>
                </div>
            </div>
        `;
        
        // Add form to recommendations container
        const container = document.getElementById('dashboard-recommendations');
        container.appendChild(playlistForm);
    } else {
        // Show existing form
        playlistForm.classList.remove('hidden');
    }
    
    // Hide success message if shown
    const successMsg = document.getElementById('dashboard-playlist-success');
    if (successMsg) {
        successMsg.classList.add('hidden');
    }
}

function hideDashboardPlaylistForm() {
    const playlistForm = document.getElementById('dashboard-playlist-form');
    if (playlistForm) {
        playlistForm.classList.add('hidden');
    }
}

async function confirmDashboardCreatePlaylist() {
    const playlistName = document.getElementById('dashboard-playlist-name').value;
    const playlistDesc = document.getElementById('dashboard-playlist-desc').value;
    const isPublic = document.getElementById('dashboard-playlist-public').checked;
    
    if (!playlistName.trim()) {
        alert('Please enter a playlist name');
        return;
    }

    if (!window.currentTrackUris || window.currentTrackUris.length === 0) {
        alert('No tracks available to create playlist');
        return;
    }

    const button = document.querySelector('#dashboard-playlist-form button');
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Creating...';
    button.disabled = true;

    try {
        const response = await fetch('/create-playlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playlistName: playlistName,
                description: playlistDesc,
                trackUris: window.currentTrackUris,
                isPublic: isPublic
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to create playlist');
        }

        // Show success message
        hideDashboardPlaylistForm();
        showDashboardPlaylistSuccess(result);

        console.log('✅ Playlist created:', result.playlist.url);

    } catch (error) {
        console.error('Playlist creation error:', error);
        alert('Error creating playlist: ' + error.message);
    } finally {
        button.innerHTML = '<i class="fas fa-check mr-1"></i>Create Playlist';
        button.disabled = false;
    }
}

function showDashboardPlaylistSuccess(result) {
    let successMsg = document.getElementById('dashboard-playlist-success');
    
    if (!successMsg) {
        successMsg = document.createElement('div');
        successMsg.id = 'dashboard-playlist-success';
        successMsg.className = 'mt-4 p-4 bg-green-500/20 rounded-xl';
        
        const container = document.getElementById('dashboard-recommendations');
        container.appendChild(successMsg);
    }
    
    successMsg.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <p class="text-green-300 font-semibold flex items-center gap-2">
                    <i class="fas fa-check-circle"></i>🎉 Playlist created successfully!
                </p>
                <p class="text-green-200 text-sm mt-1">${result.playlist.trackCount} tracks added</p>
            </div>
            <a href="${result.playlist.url}" target="_blank" 
               class="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
                <i class="fab fa-spotify mr-1"></i>Open in Spotify
            </a>
        </div>
    `;
    
    successMsg.classList.remove('hidden');
}

// =========================
// 🔹 IMPROVED SHARE FUNCTIONALITY
// =========================
function shareRecommendations() {
    const data = window.currentWeatherData;
    if (!data) {
        alert('No recommendations to share');
        return;
    }
    
    // Create a more engaging share message
    const shareText = `🎵 ${data.mood} - ${data.tracks.length} tracks for ${data.condition} weather!\n\n` +
                     `I discovered this amazing playlist using WeatherMood - an app that creates music playlists based on your current weather! 🌤️🎶\n\n` +
                     `Tracks included:\n` +
                     `${data.tracks.slice(0, 3).map((track, index) => `${index + 1}. ${track.name} - ${track.artists.join(', ')}`).join('\n')}` +
                     `${data.tracks.length > 3 ? `\n...and ${data.tracks.length - 3} more amazing tracks!` : ''}`;
    
    const shareUrl = 'https://github.com/verma-jaanvi/weathermood'; // Replace with your actual project URL
    
    if (navigator.share) {
        // Use Web Share API if available
        navigator.share({
            title: `🎵 ${data.mood} - WeatherMood Playlist`,
            text: shareText,
            url: shareUrl
        }).then(() => {
            console.log('Share successful');
        }).catch(err => {
            console.log('Share cancelled or failed:', err);
            // Fallback to clipboard
            copyToClipboard(shareText);
        });
    } else {
        // Fallback for browsers without Web Share API
        copyToClipboard(shareText);
    }
}

// Alternative: Share as text only (without URL)
function shareRecommendationsAsText() {
    const data = window.currentWeatherData;
    if (!data) {
        alert('No recommendations to share');
        return;
    }
    
    const shareText = `🎵 ${data.mood}\n` +
                     `🌤️ Weather: ${data.condition}\n` +
                     `📊 ${data.tracks.length} tracks\n\n` +
                     `Top tracks:\n` +
                     `${data.tracks.slice(0, 5).map((track, index) => `• ${track.name} - ${track.artists.join(', ')}`).join('\n')}` +
                     `\n\nGenerated by WeatherMood 🎶`;
    
    copyToClipboard(shareText);
}

// Enhanced clipboard function with better feedback
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showTempMessage('🎵 Playlist copied to clipboard! Ready to share anywhere!', 'green');
    }).catch(err => {
        console.error('Clipboard failed:', err);
        // Fallback for older browsers
        fallbackCopyToClipboard(text);
    });
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showTempMessage('🎵 Playlist copied to clipboard!', 'green');
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showTempMessage('❌ Failed to copy to clipboard', 'red');
    }
    
    document.body.removeChild(textArea);
}

function showTempMessage(message, type = 'green') {
    // Remove existing message if any
    const existingMsg = document.getElementById('temp-message');
    if (existingMsg) {
        existingMsg.remove();
    }
    
    // Create and show new message
    const msgElement = document.createElement('div');
    msgElement.id = 'temp-message';
    msgElement.className = `fixed top-4 left-1/2 transform -translate-x-1/2 ${
        type === 'green' ? 'bg-green-500' : 'bg-red-500'
    } text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300`;
    msgElement.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas ${type === 'green' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(msgElement);
    
    // Remove after 3 seconds
    setTimeout(() => {
        msgElement.style.opacity = '0';
        setTimeout(() => {
            if (msgElement.parentNode) {
                msgElement.remove();
            }
        }, 300);
    }, 3000);
}

// =========================
// 🔹 CHECK FOR AUTH ERRORS ON PAGE LOAD
// =========================
function checkForAuthErrors() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error) {
        let errorMessage = 'Login failed. Please try again.';
        
        switch(error) {
            case 'timeout':
                errorMessage = 'Spotify is taking too long to respond. Please try again in a moment.';
                break;
            case 'auth_failed':
                errorMessage = 'Spotify authentication failed. Please try again.';
                break;
            case 'no_code':
                errorMessage = 'Authentication incomplete. Please try logging in again.';
                break;
            case 'spotify_api':
                errorMessage = 'Spotify API error. Please try again later.';
                break;
        }
        
        alert('❌ ' + errorMessage);
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Call this when DOM loads
document.addEventListener("DOMContentLoaded", () => {
    checkForAuthErrors();
    fetchUserProfile();
    loadWeatherByGeolocation();
});