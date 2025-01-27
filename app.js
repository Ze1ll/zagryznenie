// Инициализация карты
var map = L.map('map').setView([59.9343, 30.3351], 13);

// Добавление слоя карты
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Функция для загрузки данных о качестве воздуха из OpenWeatherMap
function fetchAirQualityData() {
    const apiKey = 'cd8146722903d5076ed30bcfe2c68c12'; // Замените на ваш API ключ
    const lat = 59.939095; // Широта Санкт-Петербурга
    const lon = 30.315868; // Долгота Санкт-Петербурга
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Сеть не в порядке: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log('Полученные данные о качестве воздуха:', data);
            const aqi = data.list[0].main.aqi; // Уровень загрязнения
            var marker = L.marker([lat, lon]).addTo(map);
            marker.bindPopup(`<b>Уровень загрязнения:</b> ${aqi}`).openPopup();
        })
        .catch(error => {
            console.error('Ошибка при получении данных:', error);
        });
}

// Вызов функции для загрузки данных о качестве воздуха
fetchAirQualityData();