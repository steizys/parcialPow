if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito:', reg.scope))
            .catch(err => console.error('Error al registrar el Service Worker:', err));
    });
}
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
    //spiner
    setTimeout(() => {
        localStorage.setItem('skyDash_token', 'mock-jwt-token-12345');
        document.getElementById('login-spinner').classList.add('hidden');
        document.getElementById('btn-login-text').classList.remove('remove');
        initApp();
    }, 1200);
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('skyDash_token');
    location.reload(); 
});

//cambio temas
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('skyDash_theme', newTheme);
});


window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('skyDash_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);

    if (localStorage.getItem('skyDash_token')) {
        initApp();
    }
});

function initApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    
    if (!map) { //si el mapa existe
        map = L.map('map').setView([10.4806, -66.9036], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        map.on('click', function(e) {
            localizacion(e.latlng.lat, e.latlng.lng);
        });
    }
    cargarFavoritos();
    if(!navigator.onLine) {
        alert("Modo offline, los datos mostrados provienen de consultas anteriores guardadas.");
    }
}

function getClimaEmojis(code) {
    const emojis = {
        0: '☀️',
        1: '⛅', 2: '⛅', 3: '⛅',
        45: '🌫️', 48: '🌫️',
        51: '🌧️', 53: '🌧️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
        71: '❄️', 73: '❄️', 75: '❄️', 77: '❄️',
        80: '🌦️', 81: '🌦️', 82: '🌦️',
        95: '⛈️', 96: '⛈️', 99: '⛈️'
    };
    return emojis[code] || '☁️';
}

async function localizacion(lat, lng, customName = null) {
    currentSelectedCoords = { lat, lng };
    document.getElementById('weather-box').classList.remove('hidden');
    document.getElementById('weather-loading').classList.remove('hidden');
    document.getElementById('weather-info').classList.add('hidden');

    //actualizar mapa
    if (mainMarker) {
        mainMarker.setLatLng([lat, lng]);
    } else {
        mainMarker = L.marker([lat, lng]).addTo(map);
    }
    map.panTo([lat, lng]);

    //obtener nombre de lugar
    if (!customName) {
        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const geoData = await geoRes.json();
            currentSelectedName = geoData.display_name.split(',')[0] || `coord: ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
        } catch (err) {
            currentSelectedName = `ubicación (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
        }
    } else {
        currentSelectedName = customName;
    }
    document.getElementById('location-name').innerText = currentSelectedName;

    // gestionar clima y cache
    const cacheKey = `weather_${lat}_${lng}`;
    let weatherData = null;

    if (!navigator.onLine) {
        // modo offline
        weatherData = JSON.parse(localStorage.getItem(cacheKey));
        if (!weatherData) {
            alert("sin conexión y sin datos guardados.");
            document.getElementById('weather-loading').classList.add('hidden');
            return;
        }
    } else {
        // modo online
        try {
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`);
            weatherData = await weatherRes.json();
            localStorage.setItem(cacheKey, JSON.stringify(weatherData)); 
        } catch (error) {
            console.error("error al cargar clima:", error);
        }
    }

    if (weatherData) {
        displayClima(weatherData);
    }
}
async function localizacion(lat, lng, customName = null) {
    currentSelectedCoords = { lat, lng };
    document.getElementById('weather-box').classList.remove('hidden');
    document.getElementById('weather-loading').classList.remove('hidden');
    document.getElementById('weather-info').classList.add('hidden');


    // el pin
    if (mainMarker) {
        mainMarker.setLatLng([lat, lng]);
    } else {
        mainMarker = L.marker([lat, lng]).addTo(map);
    }
    map.panTo([lat, lng]);

   
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
            localStorage.setItem(cacheKey, JSON.stringify(weatherData)); 
        } catch (error) {
            console.error("Error trayendo clima", error);
        }
    }

    if (weatherData) {
        displayClima(weatherData);
    }
}

function displayClima(data) {
    document.getElementById('weather-loading').classList.add('hidden');
    document.getElementById('weather-info').classList.remove('hidden');

    const current = data.current_weather;
    const emoji = getClimaEmojis(current.weathercode);

    if (mainMarker) map.removeLayer(mainMarker);
    
    const customIcon = L.divIcon({
        html: `<div style="font-size: 24px; background: white; border-radius: 50%; padding: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); text-align:center; width:34px; height:34px; line-height:24px;">${emoji}</div>`,
        className: 'custom-div-icon',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });

    mainMarker = L.marker([currentSelectedCoords.lat, currentSelectedCoords.lng], { icon: customIcon }).addTo(map);

    document.getElementById('current-temp').innerText = `${current.temperature}°C ${emoji}`;
    document.getElementById('current-extra').innerText = `Viento: ${current.windspeed} km/h`;

    const forecastContainer = document.getElementById('forecast-container');
    forecastContainer.innerHTML = '';
    
    for (let i = 0; i < data.daily.time.length; i++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'forecast-day';
        
        const dateObj = new Date(data.daily.time[i] + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('es', { weekday: 'short' });
        
        dayEl.innerHTML = `
            <div><strong>${dayName}</strong></div>
            <div style="font-size:1.2rem; margin:3px 0;">${getClimaEmojis(data.daily.weathercode[i])}</div>
            <div style="font-size:0.75rem;">${Math.round(data.daily.temperature_2m_max[i])}° / ${Math.round(data.daily.temperature_2m_min[i])}°</div>
        `;
        forecastContainer.appendChild(dayEl);
    }
}

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
            localizacion(lat, lng, data[0].display_name.split(',')[0]);
        } else {
            alert("Ubicación no encontrada.");
        }
    } catch (err) {
        alert("Error de red al buscar ubicación.");
    }
}

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
    cargarFavoritos();
});

function cargarFavoritos() {
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
            localizacion(fav.lat, fav.lng, fav.name);
        });

        li.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            favorites.splice(index, 1);
            localStorage.setItem('skyDash_favs', JSON.stringify(favorites));
            cargarFavoritos();
        });

        list.appendChild(li);
    });
}