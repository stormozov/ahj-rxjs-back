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

// Храним все активные SSE-соединения (для простоты — массив res)
const sseClients = [];

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

  // 🔥 Отправляем событие всем подключённым SSE-клиентам
  if (newMessageCount > 0 && sseClients.length > 0) {
    const eventData = JSON.stringify({
      type: 'new_unread_messages',
      count: newMessageCount,
      total: unreadMessages.length,
      timestamp: Math.floor(Date.now() / 1000)
    });

    sseClients.forEach(client => {
      try {
        client.res.write(`event: unread_update\ndata: ${eventData}\n\n`);
      } catch (err) {
        logger.warn(`Failed to send SSE to client ${client.id}: ${err.message}`);
      }
    });
  }
}

// Запускаем генерацию новых сообщений каждые 15 секунд
const INTERVAL_MS = 15_000;
const MAX_MESSAGES = 50;
const intervalId = setInterval(() => {
  if (unreadMessages.length < MAX_MESSAGES) {
    addNewMessages();
  } else {
    logger.info(`Maximum number (${MAX_MESSAGES}) of messages reached. Stopping message generation.`);
    clearInterval(intervalId);
  }
}, INTERVAL_MS);

// Endpoint: GET /events/unread-updates — поток обновлений о новых сообщениях
app.get('/events/unread-updates', (req, res) => {
  // Устанавливаем заголовки для SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*', // важно для CORS
  });

  // Отправляем начальное событие
  res.write('event: ping\ndata: {"status":"connected"}\n\n');

  // Сохраняем соединение
  const clientId = uuidv4();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);
  
  logger.info(`SSE client connected: ${clientId}. Total clients: ${sseClients.length}`);

  // Обработчик закрытия соединения
  req.on('close', () => {
    const idx = sseClients.findIndex(c => c.id === clientId);

    if (idx !== -1) {
      sseClients.splice(idx, 1);
      logger.info(`SSE client disconnected: ${clientId}. Remaining: ${sseClients.length}`);
    }

    res.end();
  });
});

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
