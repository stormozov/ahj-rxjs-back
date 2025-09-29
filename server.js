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
app.use(cors());

// Хранилище всех непрочитанных сообщений (в памяти)
const unreadMessages = [];

/**
 * Генерация случайного непрочитанного сообщения
 * @returns {Object} - Объект непрочитанного сообщения
 */
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

/**
 * Добавление новых непрочитанных сообщений в хранилище
 */
function addNewMessages() {
  const newMessageCount = faker.number.int({ min: 0, max: 10 });
  const newMessages = Array.from({ length: newMessageCount }, generateMessage);

  unreadMessages.push(...newMessages);
  logger.info(`Added ${newMessageCount} new unread messages. Total: ${unreadMessages.length}`);
}

// Запускаем генерацию новых сообщений каждые 15 секунд
const INTERVAL_MS = 15_000;
const MAX_MESSAGES = 50;
if (unreadMessages.length !== MAX_MESSAGES) setInterval(addNewMessages, INTERVAL_MS);

// Endpoint: GET /messages/unread - получение непрочитанных сообщений
app.get('/messages/unread', (req, res) => {
  try {
    const response = {
      status: 'ok',
      timestamp: Math.floor(Date.now() / 1000),
      messages: unreadMessages,
    };

    logger.info(`Sent ${unreadMessages.length} unread messages to client`);
    res.json(response);
  } catch {
    const errorMessage = 'Failed to retrieve unread messages';
    logger.error({ err: error }, errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// Endpoint: DELETE /messages/unread - очистка непрочитанных сообщений
app.delete('/messages/unread', (req, res) => {
  unreadMessages.length = 0;
  logger.info('Unread messages cleared');
  res.json({ status: 'ok', message: 'All unread messages cleared' });
});

// Запуск сервера
app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});
