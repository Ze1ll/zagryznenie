// Инициализация карты
var map = L.map('map').setView([59.9343, 30.3351], 13);

// Добавление слоя карты
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ' OpenStreetMap contributors'
}).addTo(map);

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

// Функция для создания маркера с контекстным меню
function createMarkerWithContextMenu(latlng, popupContent) {
    const marker = L.marker(latlng, {
        contextmenu: true,
        contextmenuItems: [{
            text: 'Удалить маркер',
            callback: function() {
                pollutionMarkers.removeLayer(marker);
            }
        }]
    });

    // Добавляем обработчик правого клика
    marker.on('contextmenu', function() {
        pollutionMarkers.removeLayer(marker);
    });

    marker.bindPopup(popupContent);
    return marker;
}

// Обработчик события создания объекта на карте
map.on('draw:created', async function(e) {
    var layer = e.layer;
    
    if (e.layerType === 'marker') {
        // Если создан маркер, получаем данные о загрязнении
        const latlng = layer.getLatLng();
        const data = await fetchAirQualityData(latlng.lat, latlng.lng);
        
        if (data) {
            const popupContent = createPopupContent(data, latlng.lat, latlng.lng);
            const marker = createMarkerWithContextMenu(latlng, popupContent);
            pollutionMarkers.addLayer(marker);
        }
    } else if (e.layerType === 'polygon') {
        // Если создан полигон, добавляем его и считаем площадь
        drawnItems.addLayer(layer);
        var areaInKm = calculateArea(layer);
        document.getElementById('area-value').textContent = areaInKm;
        
        // Расчет среднего загрязнения для полигона
        await calculatePolygonPollution(layer);
    }
});

// Обработчик события редактирования полигона
map.on('draw:edited', async function(e) {
    var layers = e.layers;
    layers.eachLayer(async function(layer) {
        if (layer instanceof L.Polygon) {
            var areaInKm = calculateArea(layer);
            document.getElementById('area-value').textContent = areaInKm;
            
            // Перерасчет среднего загрязнения после редактирования
            await calculatePolygonPollution(layer);
        }
    });
});

// Обработчик события удаления объектов
map.on('draw:deleted', function(e) {
    var layers = e.layers;
    layers.eachLayer(function(layer) {
        if (layer instanceof L.Polygon) {
            document.getElementById('area-value').textContent = '0';
            clearPollutionInfo();
            document.getElementById('calculation-status').textContent = '';
        }
        if (layer instanceof L.Marker) {
            pollutionMarkers.removeLayer(layer);
        }
    });
});