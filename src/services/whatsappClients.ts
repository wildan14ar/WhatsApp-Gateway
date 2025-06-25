// src/services/whatsappClients.ts
import { Client, LocalAuth, MessageMedia, Message } from 'whatsapp-web.js';
import { prisma } from '../lib/prisma';
import { io } from '../app';
import axios from 'axios';
import path from 'path';

const clients = new Map<number, Client>();
const readyMap = new Map<number, Promise<void>>();
const readyResolvers = new Map<number, () => void>();

export const initWhatsAppClient = (cfg: {
  id: number;
  sessionFolder: string;
}) => {
  // Deferred promise untuk ready
  const readyPromise = new Promise<void>((resolve) => {
    readyResolvers.set(cfg.id, resolve);
  });
  readyMap.set(cfg.id, readyPromise);

  const dataPath = path.join(process.cwd(), 'sessions', cfg.sessionFolder);
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: String(cfg.id), dataPath }),
    puppeteer: { headless: true },
  });

  client.on('qr', (qr) => {
    prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: false } });
    io.emit('qr', { clientId: cfg.id, qr });
    io.emit('status', { clientId: cfg.id, status: false });
  });

  client.on('ready', async () => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: true } });
    io.emit('status', { clientId: cfg.id, status: true });
    const resolve = readyResolvers.get(cfg.id);
    if (resolve) {
      resolve();
      readyResolvers.delete(cfg.id);
    }
  });

  client.on('disconnected', async () => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: false } });
    io.emit('status', { clientId: cfg.id, status: false });

    client.destroy();
    clients.delete(cfg.id);
    readyMap.delete(cfg.id);
    readyResolvers.delete(cfg.id);

    initWhatsAppClient(cfg);
  });

  client.on('auth_failure', async (msg) => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: false } });
    io.emit('status', { clientId: cfg.id, status: false });
    console.warn(`Auth failure for client ${cfg.id}:`, msg);
  });

  client.on('change_state', async (state) => {
    const isOnline = state === 'CONNECTED';
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: isOnline } });
    io.emit('status', { clientId: cfg.id, status: isOnline });
  });

  client.on('message', async (msg) => {
    if (msg.fromMe) return;

    // Tentukan tipe chat
    const isGroup = msg.from.endsWith('@g.us');
    const mentionsMe = msg.mentionedIds?.includes(client.info?.me._serialized as any) ?? false;
    const isPersonal = !isGroup;
    const isTagGroup = isGroup && mentionsMe;

    // Ambil config dan webhook list
    const cfgDB = await prisma.whatsAppClient.findUnique({
      where: { id: cfg.id },
      select: {
        isReplyPersonal: true,
        isReplyGroup: true,
        isReplyTag: true,
        replyTemplatePersonal: true,
        replyTemplateGroup: true,
        replyTemplateTag: true,
      },
    });
    const webhooks = await prisma.webhook.findMany({ where: { clientId: cfg.id } });
    if (!cfgDB) return;

    const shouldReply =
      (isPersonal && cfgDB.isReplyPersonal) ||
      (isGroup && cfgDB.isReplyGroup) ||
      (isTagGroup && cfgDB.isReplyTag);

    if (shouldReply) {
      let template = '';
      if (isPersonal) template = cfgDB.replyTemplatePersonal ?? 'Terima kasih telah menghubungi kami!';
      else if (isTagGroup) template = cfgDB.replyTemplateTag ?? 'Terima kasih telah menghubungi kami!';
      else if (isGroup) template = cfgDB.replyTemplateGroup ?? 'Terima kasih telah menghubungi grup kami!';

      if (template) {
        try {
          await msg.reply(template);
          await prisma.message.create({
            data: {
              clientId: cfg.id,
              to: msg.from,
              body: template,
              direction: 'OUT',
              status: 'SENT',
            },
          });
        } catch (e) {
          console.error('Auto-reply gagal:', e);
        }
      }
    }

    // Kirim data ke webhooks (Incoming)
    for (const hook of webhooks) {
      try {
        await axios.post(hook.url, {
          clientId: cfg.id,
          direction: 'IN',
          from: msg.from,
          body: msg.body,
          timestamp: msg.timestamp,
          isGroup,
          isPersonal,
          isTagGroup,
        }, {
          headers: { [hook.signatureHeader]: hook.secretKey }
        });
      } catch (e) {
        console.error(`Webhook IN (${hook.id}) gagal:`, e);
      }
    }
  });

  client.on('message_create', async (msg) => {
    if (!msg.fromMe) return;
    const isGroup = msg.to?.endsWith('@g.us') ?? false;
    const to = msg.to || '';

    const webhooks = await prisma.webhook.findMany({ where: { clientId: cfg.id } });

    for (const hook of webhooks) {
      try {
        await axios.post(hook.url, {
          clientId: cfg.id,
          direction: 'OUT',
          to,
          body: msg.body,
          timestamp: msg.timestamp,
          isGroup,
        }, {
          headers: { [hook.signatureHeader]: hook.secretKey }
        });
      } catch (e) {
        console.error(`Webhook OUT (${hook.id}) gagal:`, e);
      }
    }
  });

  client.initialize();
  clients.set(cfg.id, client);
};

export const initWhatsAppClients = async () => {
  const configs = await prisma.whatsAppClient.findMany();
  configs.forEach(initWhatsAppClient);
};

function normalizeToChatId(raw: string): string {
  let num = raw.replace(/\D+/g, '');
  if (!num.startsWith('62')) {
    num = num.replace(/^0+/, '');
    num = '62' + num;
  }
  return `${num}@c.us`;
}

export const sendWhatsAppMessage = async (
  clientId: number,
  chatId: string,
  text: string,
  media?: { filename: string; mimetype: string; data: Buffer }
) => {
  const client = clients.get(clientId);
  if (!client) throw new Error(`Client ${clientId} belum diinisialisasi`);

  const readyPromise = readyMap.get(clientId);
  if (readyPromise) await readyPromise;

  chatId = normalizeToChatId(chatId);
  text = text || 'swasasalam';
  console.log(`Sending message from client ${clientId} to ${chatId}:`, text);

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
