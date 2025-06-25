// src/services/whatsappClients.ts
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import { prisma } from '../lib/prisma';
import { io } from '../app';
import axios from 'axios';
import path from 'path';

const clients = new Map<number, Client>();

// Inisialisasi satu client berdasarkan config dari DB
export const initWhatsAppClient = (cfg: {
  id: number;
  sessionFolder: string;
}) => {
  const dataPath = path.join(process.cwd(), 'sessions', cfg.sessionFolder);
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: String(cfg.id), dataPath }),
    puppeteer: { headless: true },
  });

  // QR, ready, disconnected, auth_failure, change_state tetap seperti sebelumnya...
  client.on('qr', qr => {
    prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: false } });
    io.emit('qr', { clientId: cfg.id, qr });
    io.emit('status', { clientId: cfg.id, status: false });
  });

  client.on('ready', async () => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: true } });
    io.emit('status', { clientId: cfg.id, status: true });
  });

  client.on('disconnected', async () => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: false } });
    io.emit('status', { clientId: cfg.id, status: false });
    client.destroy();
    clients.delete(cfg.id);
    initWhatsAppClient(cfg);
  });

  client.on('auth_failure', async msg => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: false } });
    io.emit('status', { clientId: cfg.id, status: false });
    console.warn(`Auth failure for client ${cfg.id}:`, msg);
  });

  client.on('change_state', async state => {
    const isOnline = state === 'CONNECTED';
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: isOnline } });
    io.emit('status', { clientId: cfg.id, status: isOnline });
  });

  // === SINGLE 'message' LISTENER untuk auto-reply & webhook ===
  client.on('message', async msg => {
    if (msg.fromMe) return;

    // Ambil config terbaru dari DB
    const cfgDB = await prisma.whatsAppClient.findUnique({
      where: { id: cfg.id },
      select: { isReply: true, replyTemplate: true, webhookUrl: true },
    });
    if (!cfgDB) return;

    // Auto-reply
    if (cfgDB.isReply && cfgDB.replyTemplate) {
      try {
        await msg.reply(cfgDB.replyTemplate);
        await prisma.message.create({
          data: {
            clientId: cfg.id,
            to: msg.from,
            body: cfgDB.replyTemplate,
            direction: 'OUT',
            status: 'SENT',
          },
        });
      } catch (e) {
        console.error('Auto-reply failed', e);
      }
    }

    // Webhook forwarding
    if (cfgDB.webhookUrl) {
      try {
        await axios.post(cfgDB.webhookUrl, {
          clientId: cfg.id,
          from: msg.from,
          body: msg.body,
          timestamp: msg.timestamp,
        });
      } catch (e) {
        console.error('Webhook delivery failed', e);
      }
    }
  });

  client.initialize();
  clients.set(cfg.id, client);
};

// Inisialisasi semua client pada startup
export const initWhatsAppClients = async () => {
  const configs = await prisma.whatsAppClient.findMany();
  configs.forEach(initWhatsAppClient);
};

// Kirim pesan media / teks
function normalizeToChatId(raw: string): string {
  // 1) Hilangkan semua non-digit
  let num = raw.replace(/\D+/g, '');
  // 2) Pastikan kode internasional (default: Indonesia 62)
  if (!num.startsWith('62')) {
    num = num.replace(/^0+/, '');
    num = '62' + num;
  }
  // 3) Tambah suffix @c.us
  return `${num}@c.us`;
}

export const sendWhatsAppMessage = async (
  clientId: number,
  chatId: string,
  text: string,
  media?: { filename: string; mimetype: string; data: Buffer }
) => {
  const client = clients.get(clientId);
  if (!client) {
    throw new Error(`Client ${clientId} belum diinisialisasi`);
  }

  chatId = normalizeToChatId(chatId)
  text = text || 'swasasalam';

  console.log(`Sending message from client ${clientId} to ${chatId}:`, text);

  // Jika perlu tunggu client ready
  // await readyMap.get(clientId);

  if (media) {
    const mediaMessage = new MessageMedia(
      media.mimetype,
      media.data.toString('base64'),
      media.filename
    );
    return client.sendMessage(chatId, mediaMessage, { caption: text });
  } else {
    return client.sendMessage(chatId, text);
  }
};