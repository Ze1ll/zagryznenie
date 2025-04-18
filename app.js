// Инициализация базовых слоёв карты
var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: 'OpenStreetMap contributors'
});

var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// Инициализация карты с базовым слоем
var map = L.map('map', {
    center: [59.9343, 30.3351],
    zoom: 13,
    layers: [osmLayer]
});

// Контрол для переключения слоёв
var baseMaps = {
    "Карта OSM": osmLayer,
    "Спутник": satelliteLayer
};
L.control.layers(baseMaps).addTo(map);

// Инициализация объектов для рисования
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Группа для маркеров загрязнения
var pollutionMarkers = L.layerGroup().addTo(map);

var drawControl = new L.Control.Draw({
    draw: {
        marker: true, // Разрешаем ставить маркеры
        circle: false,
        circlemarker: false,
        rectangle: false,
        polyline: false,
        polygon: {
            allowIntersection: false,
            showArea: true
        }
    },
    edit: {
        featureGroup: drawnItems,
        remove: true
    }
});
map.addControl(drawControl);

// Функция для расчета площади полигона
function calculateArea(layer) {
    var area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
    return (area / 1000000).toFixed(2); // Конвертация в квадратные километры
}

// Функция для получения точек сетки внутри полигона
function getGridPointsInPolygon(polygon, gridSize = 5) {
    const bounds = polygon.getBounds();
    const points = [];
    const latSpan = bounds.getNorth() - bounds.getSouth();
    const lngSpan = bounds.getEast() - bounds.getWest();
    const polygonLatLngs = polygon.getLatLngs()[0];
    
    // Создаем сетку точек
    for (let i = 0; i <= gridSize; i++) {
        for (let j = 0; j <= gridSize; j++) {
            const lat = bounds.getSouth() + (latSpan * i / gridSize);
            const lng = bounds.getWest() + (lngSpan * j / gridSize);
            const point = L.latLng(lat, lng);
            
            // Проверяем, находится ли точка внутри полигона
            if (isPointInPolygon(point, polygonLatLngs)) {
                points.push(point);
            }
        }
    }
    
    return points;
}

// Функция для проверки, находится ли точка внутри полигона
function isPointInPolygon(point, polygon) {
    let inside = false;
    let j = polygon.length - 1;

    for (let i = 0; i < polygon.length; i++) {
        if (((polygon[i].lat > point.lat) !== (polygon[j].lat > point.lat)) &&
            (point.lng < (polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat) / 
            (polygon[j].lat - polygon[i].lat) + polygon[i].lng)) {
            inside = !inside;
        }
        j = i;
    }

    return inside;
}

// Функция для загрузки данных о качестве воздуха из OpenWeatherMap
async function fetchAirQualityData(lat, lon) {
    const apiKey = 'cd8146722903d5076ed30bcfe2c68c12';
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Сеть не в порядке: ' + response.statusText);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        return null;
    }
}

// Функция для расчета среднего значения
function calculateAverage(values) {
    if (!values.length) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

// Функция для обновления информации о загрязнении
function updatePollutionInfo(values) {
    document.getElementById('avg-aqi').textContent = values.aqi.toFixed(1);
    document.getElementById('avg-co').textContent = values.co.toFixed(2);
    document.getElementById('avg-no2').textContent = values.no2.toFixed(2);
    document.getElementById('avg-o3').textContent = values.o3.toFixed(2);
    document.getElementById('avg-so2').textContent = values.so2.toFixed(2);
    document.getElementById('avg-pm25').textContent = values.pm2_5.toFixed(2);
    document.getElementById('avg-pm10').textContent = values.pm10.toFixed(2);
}

// Функция для очистки информации о загрязнении
function clearPollutionInfo() {
    const elements = ['aqi', 'co', 'no2', 'o3', 'so2', 'pm25', 'pm10'];
    elements.forEach(el => document.getElementById(`avg-${el}`).textContent = '-');
}

// Функция для расчета среднего загрязнения в полигоне
async function calculatePolygonPollution(polygon) {
    const statusElement = document.getElementById('calculation-status');
    statusElement.textContent = 'Расчёт загрязнения...';
    
    try {
        const points = getGridPointsInPolygon(polygon);
        const pollutionData = await Promise.all(
            points.map(point => fetchAirQualityData(point.lat, point.lng))
        );
        
        const validData = pollutionData.filter(data => data && data.list && data.list[0]);
        
        if (validData.length === 0) {
            throw new Error('Не удалось получить данные о загрязнении');
        }

        const averages = {
            aqi: calculateAverage(validData.map(d => d.list[0].main.aqi)),
            co: calculateAverage(validData.map(d => d.list[0].components.co)),
            no2: calculateAverage(validData.map(d => d.list[0].components.no2)),
            o3: calculateAverage(validData.map(d => d.list[0].components.o3)),
            so2: calculateAverage(validData.map(d => d.list[0].components.so2)),
            pm2_5: calculateAverage(validData.map(d => d.list[0].components.pm2_5)),
            pm10: calculateAverage(validData.map(d => d.list[0].components.pm10))
        };

        updatePollutionInfo(averages);
        statusElement.textContent = `Данные получены из ${validData.length} точек`;
    } catch (error) {
        console.error('Ошибка при расчете загрязнения:', error);
        statusElement.textContent = 'Ошибка при расчете загрязнения';
        clearPollutionInfo();
    }
}

// Функция для получения данных о загрязнении за неделю по координатам
async function fetchWeeklyAirQuality(lat, lon) {
    // OpenWeatherMap предоставляет только почасовые данные на 5 дней, используем их как пример
    const apiKey = 'cd8146722903d5076ed30bcfe2c68c12';
    const url = `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка сети');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Ошибка при получении прогноза:', error);
        return null;
    }
}

// Функция для отображения графика загрязнений
function renderPollutionChart(forecastData) {
    const ctx = document.getElementById('pollution-chart').getContext('2d');
    if (!forecastData || !forecastData.list) return;
    // Берём данные за последние 7 дней (если есть)
    const labels = forecastData.list.slice(0, 56).map(item => {
        const date = new Date(item.dt * 1000);
        return `${date.getDate()}.${date.getMonth()+1} ${date.getHours()}:00`;
    });
    const aqi = forecastData.list.slice(0, 56).map(item => item.main.aqi);
    const pm25 = forecastData.list.slice(0, 56).map(item => item.components.pm2_5);
    const pm10 = forecastData.list.slice(0, 56).map(item => item.components.pm10);
    if (window.pollutionChartInstance) window.pollutionChartInstance.destroy();
    window.pollutionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'AQI', data: aqi, borderColor: '#e67e22', fill: false },
                { label: 'PM2.5', data: pm25, borderColor: '#3498db', fill: false },
                { label: 'PM10', data: pm10, borderColor: '#2ecc71', fill: false }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: true } },
            scales: { x: { display: false }, y: { beginAtZero: true } }
        }
    });
}

// Функция для определения цвета по уровню AQI
function getColorByAQI(aqi) {
    if (aqi >= 4) return '#e74c3c'; // опасно (красный)
    if (aqi === 3) return '#f39c12'; // умеренно (оранжевый)
    if (aqi === 2) return '#f1c40f'; // удовлетворительно (жёлтый)
    return '#2ecc71'; // хорошо (зелёный)
}

// Функция для создания маркера с контекстным меню
function createMarkerWithContextMenu(latlng, popupContent, aqi) {
    const marker = L.circleMarker(latlng, {
        radius: 10,
        color: getColorByAQI(aqi),
        fillColor: getColorByAQI(aqi),
        fillOpacity: 0.8,
        contextmenu: true,
        contextmenuItems: [{
            text: 'Удалить маркер',
            callback: function() { pollutionMarkers.removeLayer(marker); }
        }]
    });

    // Добавляем обработчик правого клика
    marker.on('contextmenu', function() {
        pollutionMarkers.removeLayer(marker);
    });

    marker.bindPopup(popupContent);
    return marker;
}

// Храним области и их данные
let areasData = [];
let areaIdCounter = 1;

// Функция для добавления новой области
async function addArea(polygon) {
    const areaId = areaIdCounter++;
    const areaCenter = polygon.getBounds().getCenter();
    // Получаем средние значения загрязнения
    const points = getGridPointsInPolygon(polygon);
    const pollutionData = await Promise.all(points.map(point => fetchAirQualityData(point.lat, point.lng)));
    const validData = pollutionData.filter(data => data && data.list && data.list[0]);
    const averages = validData.length > 0 ? {
        aqi: calculateAverage(validData.map(d => d.list[0].main.aqi)),
        co: calculateAverage(validData.map(d => d.list[0].components.co)),
        no2: calculateAverage(validData.map(d => d.list[0].components.no2)),
        o3: calculateAverage(validData.map(d => d.list[0].components.o3)),
        so2: calculateAverage(validData.map(d => d.list[0].components.so2)),
        pm2_5: calculateAverage(validData.map(d => d.list[0].components.pm2_5)),
        pm10: calculateAverage(validData.map(d => d.list[0].components.pm10))
    } : null;
    // Получаем прогноз для центра области
    const forecast = await fetchWeeklyAirQuality(areaCenter.lat, areaCenter.lng);
    // Стилизация полигона
    if (averages) {
        polygon.setStyle({
            color: getColorByAQI(averages.aqi),
            fillColor: getColorByAQI(averages.aqi),
            fillOpacity: 0.25
        });
    }
    areasData.push({ id: areaId, polygon, averages, forecast });
    renderAreasList();
}

// Функция для удаления области
function removeArea(areaId) {
    areasData = areasData.filter(area => area.id !== areaId);
    renderAreasList();
}

// Функция для отображения списка областей
function renderAreasList() {
    const container = document.getElementById('areas-list');
    container.innerHTML = '';
    areasData.forEach(area => {
        const block = document.createElement('div');
        block.className = 'area-block';
        block.innerHTML = `
            <h4>Область #${area.id}</h4>
            <div class="area-info-grid">
                <div class="area-info-item"><span>AQI</span><span>${area.averages ? area.averages.aqi.toFixed(1) : '-'}</span></div>
                <div class="area-info-item"><span>CO</span><span>${area.averages ? area.averages.co.toFixed(2) : '-'}</span></div>
                <div class="area-info-item"><span>NO₂</span><span>${area.averages ? area.averages.no2.toFixed(2) : '-'}</span></div>
                <div class="area-info-item"><span>O₃</span><span>${area.averages ? area.averages.o3.toFixed(2) : '-'}</span></div>
                <div class="area-info-item"><span>SO₂</span><span>${area.averages ? area.averages.so2.toFixed(2) : '-'}</span></div>
                <div class="area-info-item"><span>PM2.5</span><span>${area.averages ? area.averages.pm2_5.toFixed(2) : '-'}</span></div>
                <div class="area-info-item"><span>PM10</span><span>${area.averages ? area.averages.pm10.toFixed(2) : '-'}</span></div>
            </div>
            <div class="area-chart-container"><canvas id="area-chart-${area.id}" width="320" height="140"></canvas></div>
            <button class="area-delete-btn" onclick="removeArea(${area.id})">Удалить область</button>
        `;
        container.appendChild(block);
        // Рисуем график
        if (area.forecast) {
            const ctx = document.getElementById(`area-chart-${area.id}`).getContext('2d');
            const labels = area.forecast.list.slice(0, 56).map(item => {
                const date = new Date(item.dt * 1000);
                return `${date.getDate()}.${date.getMonth()+1} ${date.getHours()}:00`;
            });
            const aqi = area.forecast.list.slice(0, 56).map(item => item.main.aqi);
            const pm25 = area.forecast.list.slice(0, 56).map(item => item.components.pm2_5);
            const pm10 = area.forecast.list.slice(0, 56).map(item => item.components.pm10);
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'AQI', data: aqi, borderColor: '#e67e22', fill: false },
                        { label: 'PM2.5', data: pm25, borderColor: '#3498db', fill: false },
                        { label: 'PM10', data: pm10, borderColor: '#2ecc71', fill: false }
                    ]
                },
                options: {
                    responsive: false,
                    plugins: { legend: { display: true } },
                    scales: { x: { display: false }, y: { beginAtZero: true } }
                }
            });
        }
    });
}

// === Переключение тёмной/светлой темы ===
const themeBtn = document.getElementById('toggle-theme');
if (themeBtn) {
    themeBtn.addEventListener('click', function() {
        document.body.classList.toggle('dark-theme');
        if(document.body.classList.contains('dark-theme')) {
            themeBtn.textContent = '☀️ Светлая тема';
        } else {
            themeBtn.textContent = '🌙 Тёмная тема';
        }
    });
}
// При загрузке страницы — можно добавить автосохранение темы через localStorage (опционально)
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    if(themeBtn) themeBtn.textContent = '☀️ Светлая тема';
}
themeBtn && themeBtn.addEventListener('click', function() {
    if(document.body.classList.contains('dark-theme')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
});

// === Поиск города и GPS в одном блоке ===
const citySearchInput = document.getElementById('city-search');
const gpsGoBtn = document.getElementById('gps-go');
const gpsInput = document.getElementById('gps-coords');

if (citySearchInput) {
    citySearchInput.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter' && citySearchInput.value.trim()) {
            const city = citySearchInput.value.trim();
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`;
            try {
                const res = await fetch(url);
                const data = await res.json();
                if (data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    map.setView([lat, lon], 12);
                    gpsInput.value = `${lat.toFixed(5)},${lon.toFixed(5)}`;
                } else {
                    alert('Город не найден');
                }
            } catch (err) {
                alert('Ошибка поиска города');
            }
        }
    });
}
if (gpsGoBtn && gpsInput) {
    gpsGoBtn.addEventListener('click', function() {
        const value = gpsInput.value.trim();
        const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (match) {
            const lat = parseFloat(match[1]);
            const lon = parseFloat(match[2]);
            if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                map.setView([lat, lon], 13);
                citySearchInput.value = '';
            } else {
                alert('Некорректные координаты');
            }
        } else {
            alert('Введите координаты в формате: широта,долгота');
        }
    });
}

// Обработчик события создания объекта на карте
map.on('draw:created', async function(e) {
    var layer = e.layer;
    if (e.layerType === 'marker') {
        // Если создан маркер, получаем данные о загрязнении
        const latlng = layer.getLatLng();
        const data = await fetchAirQualityData(latlng.lat, latlng.lng);
        
        if (data) {
            const aqi = data.list && data.list[0] ? data.list[0].main.aqi : 1;
            const popupContent = createPopupContent(data, latlng.lat, latlng.lng);
            const marker = createMarkerWithContextMenu(latlng, popupContent, aqi);
            pollutionMarkers.addLayer(marker);
            // Получаем и отображаем график
            const forecast = await fetchWeeklyAirQuality(latlng.lat, latlng.lng);
            renderPollutionChart(forecast);
        }
    } else if (e.layerType === 'polygon') {
        drawnItems.addLayer(layer);
        await addArea(layer);
    }
});

// Обработчик события удаления объектов
map.on('draw:deleted', function(e) {
    var layers = e.layers;
    layers.eachLayer(function(layer) {
        if (layer instanceof L.Polygon) {
            // Удаляем из списка областей по совпадению координат центра
            const center = layer.getBounds().getCenter();
            areasData = areasData.filter(area => {
                const aCenter = area.polygon.getBounds().getCenter();
                return Math.abs(center.lat - aCenter.lat) > 0.0001 || Math.abs(center.lng - aCenter.lng) > 0.0001;
            });
            renderAreasList();
        }
        if (layer instanceof L.Marker) {
            pollutionMarkers.removeLayer(layer);
        }
    });
});

// Функция для создания HTML-содержимого всплывающего окна
function createPopupContent(data, lat, lon) {
    if (!data || !data.list || !data.list[0]) {
        return '<div class="error-popup">Ошибка получения данных</div>';
    }

    const aqi = data.list[0].main.aqi;
    const components = data.list[0].components;
    
    let aqiDescription;
    switch(aqi) {
        case 1: aqiDescription = 'Отличное'; break;
        case 2: aqiDescription = 'Хорошее'; break;
        case 3: aqiDescription = 'Умеренное'; break;
        case 4: aqiDescription = 'Плохое'; break;
        case 5: aqiDescription = 'Очень плохое'; break;
        default: aqiDescription = 'Неизвестно';
    }

    return `
        <div class="pollution-popup">
            <h3>Качество воздуха</h3>
            <p><strong>Индекс качества:</strong> ${aqiDescription} (${aqi})</p>
            <p><strong>Координаты:</strong><br>
            Широта: ${lat.toFixed(4)}<br>
            Долгота: ${lon.toFixed(4)}</p>
            <h4>Компоненты (μg/m³):</h4>
            <ul>
                <li>CO: ${components.co}</li>
                <li>NO₂: ${components.no2}</li>
                <li>O₃: ${components.o3}</li>
                <li>SO₂: ${components.so2}</li>
                <li>PM2.5: ${components.pm2_5}</li>
                <li>PM10: ${components.pm10}</li>
            </ul>
            <div class="delete-marker-hint">Правый клик для удаления маркера</div>
        </div>
    `;
}