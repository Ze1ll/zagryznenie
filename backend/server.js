const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

// Middleware для обработки JSON
app.use(express.json());

// Обслуживание статических файлов из корневой директории
app.use(express.static('../'));

// Пример API эндпоинта
app.get('/api/pollution', async (req, res) => {
    try {
        const response = await axios.get('https://api.openaq.org/v2/latest', {
            params: {
                country: 'RU', // можно изменить на нужную страну
                limit: 5 // ограничение на количество записей
            }
        });

        const pollutionData = response.data.results.map(location => ({
            location: [location.coordinates.latitude, location.coordinates.longitude],
            level: location.measurements[0].value > 100 ? 'High' : location.measurements[0].value > 50 ? 'Medium' : 'Low'
        }));

        console.log('Полученные данные из OpenAQ:', pollutionData);

        res.json(pollutionData);
    } catch (error) {
        console.error('Ошибка при получении данных из OpenAQ:', error);
        res.status(500).json({ error: 'Не удалось получить данные о загрязнениях' });
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});
