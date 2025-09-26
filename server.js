const express = require('express');
const cors = require('cors');
const { faker } = require('@faker-js/faker');
const { v4: uuidv4 } = require('uuid');
const pino = require('pino');
const pinoHttp = require('pino-http');
const pinoPretty = require('pino-pretty');

// Настраиваем логгер
const logger = pino(pinoPretty());

// Создаём Express-приложение
const app = express();
const PORT = process.env.PORT || 7070;

// Используем pino-http как middleware
app.use(pinoHttp({ logger }));

// Настраиваем CORS
app.use(cors({ origin: 'http://localhost:3000' }));

// Генерация одного случайного сообщения
function generateMessage() {
  return {
    id: uuidv4(),
    from: faker.internet.email(),
    subject: faker.lorem.sentence(),
    body: faker.lorem.paragraphs(2),
    avatar: faker.image.avatar(),
    received: Math.floor(faker.date.past().getTime() / 1000), // Unix timestamp
  };
}

// Эндпоинт: GET /messages/unread
app.get('/messages/unread', (req, res) => {
  try {
    // Генерируем случайное количество непрочитанных сообщений (от 0 до 10)
    const messageCount = faker.number.int({ min: 0, max: 10 });
    const messages = Array.from({ length: messageCount }, generateMessage);

    const response = {
      status: 'ok',
      timestamp: Math.floor(Date.now() / 1000),
      messages,
    };

    logger.info('Unread messages have been generated and sent successfully');
    res.json(response);
  } catch {
    const errorMessage = 'Failed to generate unread messages';
    logger.error(errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});
