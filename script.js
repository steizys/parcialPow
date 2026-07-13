let map;
let mainMarker;
let favorites = JSON.parse(localStorage.getItem('skyDash_favs')) || [];
let currentSelectedCoords = null;
let currentSelectedName = "";


const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    document.getElementById('btn-login-text').classList.add('hidden');
    document.getElementById('login-spinner').classList.remove('hidden');

    //spinner de carga
    setTimeout(() => {
        localStorage.setItem('skyDash_token', 'mock-jwt-token-12345');
        document.getElementById('login-spinner').classList.add('hidden');
        document.getElementById('btn-login-text').classList.remove('remove');
        initApp();
    }, 1200);
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('skyDash_token');
    location.reload(); // Limpia estado de memoria y fuerza el render de login seguro
});

// --- CAMBIO DE TEMA (MODO OSCURO / CLARO) ---
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('skyDash_theme', newTheme);
});

// --- INICIALIZACIÓN ---
window.addEventListener('DOMContentLoaded', () => {
    // Cargar tema previo
    const savedTheme = localStorage.getItem('skyDash_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);

    if (localStorage.getItem('skyDash_token')) {
        initApp();
    }
});

function initApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    
    // Inicializar Mapa (Por defecto en Caracas)
    if (!map) {
        map = L.map('map').setView([10.4806, -66.9036], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        // Evento de clic en el mapa (Georreferenciación directa)
        map.on('click', function(e) {
            handleLocationSelection(e.latlng.lat, e.latlng.lng);
        });
    }
    renderFavorites();
    
    // Resiliencia/Offline
    if(!navigator.onLine) {
        alert("Modo offline activado. Los datos mostrados provienen de consultas previas guardadas.");
    }
}

// --- TRADUCCIÓN DE CLIMA A EMOJIS (Divicon funcional) ---
function getWeatherEmoji(code) {
    if (code === 0) return '☀️';
    if (code >= 1 && code <= 3) return '⛅';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 95 && code <= 99) return '⛈️';
    return '☁️';
}

// --- LÓGICA DE GEORREFERENCIACIÓN Y CONSULTA ---
async function handleLocationSelection(lat, lng, customName = null) {
    currentSelectedCoords = { lat, lng };
    document.getElementById('weather-box').classList.remove('hidden');
    document.getElementById('weather-loading').classList.remove('hidden');
    document.getElementById('weather-info').classList.add('hidden');

    // Inyectar marcador dinámico temporalmente
    if (mainMarker) map.removeLayer(mainMarker);
    mainMarker = L.marker([lat, lng]).addTo(map);
    map.panTo([lat, lng]);

    // Geocodificación Inversa
    if (!customName) {
        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const geoData = await geoRes.json();
            currentSelectedName = geoData.display_name.split(',')[0] || `Coordenadas: ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
        } catch (err) {
            currentSelectedName = `Ubicación (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
        }
    } else {
        currentSelectedName = customName;
    }

    document.getElementById('location-name').innerText = currentSelectedName;

    // Petición Meteorológica a Open-Meteo
    const cacheKey = `weather_${lat}_${lng}`;
    let weatherData = null;

    if (!navigator.onLine) {
        weatherData = JSON.parse(localStorage.getItem(cacheKey));
        if (!weatherData) {
            alert("Sin conexión y sin datos en la caché para esta ubicación.");
            document.getElementById('weather-loading').classList.add('hidden');
            return;
        }
    } else {
        try {
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`);
            weatherData = await weatherRes.json();
            localStorage.setItem(cacheKey, JSON.stringify(weatherData)); // Almacenamiento local para offline
        } catch (error) {
            console.error("Error trayendo clima", error);
        }
    }

    if (weatherData) {
        displayWeather(weatherData);
    }
}

function displayWeather(data) {
    document.getElementById('weather-loading').classList.add('hidden');
    document.getElementById('weather-info').classList.remove('hidden');

    const current = data.current_weather;
    const emoji = getWeatherEmoji(current.weathercode);

    // Manipulación avanzada de marcador (Divicon programático)
    if (mainMarker) map.removeLayer(mainMarker);
    
    const customIcon = L.divIcon({
        html: `<div style="font-size: 24px; background: white; border-radius: 50%; padding: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); text-align:center; width:34px; height:34px; line-height:24px;">${emoji}</div>`,
        className: 'custom-div-icon',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });

    mainMarker = L.marker([currentSelectedCoords.lat, currentSelectedCoords.lng], { icon: customIcon }).addTo(map);

    // Llenar datos actuales
    document.getElementById('current-temp').innerText = `${current.temperature}°C ${emoji}`;
    document.getElementById('current-extra').innerText = `Viento: ${current.windspeed} km/h`;

    // Pronóstico 7 Días
    const forecastContainer = document.getElementById('forecast-container');
    forecastContainer.innerHTML = '';
    
    for (let i = 0; i < data.daily.time.length; i++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'forecast-day';
        
        const dateObj = new Date(data.daily.time[i] + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('es', { weekday: 'short' });
        
        dayEl.innerHTML = `
            <div><strong>${dayName}</strong></div>
            <div style="font-size:1.2rem; margin:3px 0;">${getWeatherEmoji(data.daily.weathercode[i])}</div>
            <div style="font-size:0.75rem;">${Math.round(data.daily.temperature_2m_max[i])}° / ${Math.round(data.daily.temperature_2m_min[i])}°</div>
        `;
        forecastContainer.appendChild(dayEl);
    }
}

// --- BUSCADOR MANUAL POR TEXTO ---
document.getElementById('search-btn').addEventListener('click', triggerSearch);
document.getElementById('search-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') triggerSearch(); });

async function triggerSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            handleLocationSelection(lat, lng, data[0].display_name.split(',')[0]);
        } else {
            alert("Ubicación no encontrada.");
        }
    } catch (err) {
        alert("Error de red al buscar ubicación.");
    }
}

// --- GESTIÓN DE FAVORITOS (PERSISTENCIA) ---
document.getElementById('fav-btn').addEventListener('click', () => {
    if (!currentSelectedCoords) return;
    
    if (favorites.some(f => f.lat === currentSelectedCoords.lat && f.lng === currentSelectedCoords.lng)) {
        return;
    }

    favorites.push({
        name: currentSelectedName,
        lat: currentSelectedCoords.lat,
        lng: currentSelectedCoords.lng
    });

    localStorage.setItem('skyDash_favs', JSON.stringify(favorites));
    renderFavorites();
});

function renderFavorites() {
    const list = document.getElementById('favorites-list');
    list.innerHTML = '';
    
    favorites.forEach((fav, index) => {
        const li = document.createElement('li');
        li.className = 'fav-item';
        li.innerHTML = `
            <span class="fav-link">${fav.name}</span>
            <button class="btn btn-sm btn-delete" data-index="${index}">X</button>
        `;
        
        li.querySelector('.fav-link').addEventListener('click', () => {
            handleLocationSelection(fav.lat, fav.lng, fav.name);
        });

        li.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            favorites.splice(index, 1);
            localStorage.setItem('skyDash_favs', JSON.stringify(favorites));
            renderFavorites();
        });

        list.appendChild(li);
    });
}