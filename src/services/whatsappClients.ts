// src/services/whatsappClients.ts
import { Client, LocalAuth, MessageMedia, Message } from 'whatsapp-web.js';
import { prisma } from '../lib/prisma';
import { io } from '../app';
import axios from 'axios';
import path from 'path';

const clients = new Map<number, Client>();
const readyMap = new Map<number, Promise<void>>();
const readyResolvers = new Map<number, () => void>();

function normalizeUrl(raw: string): string {
  // hilangkan spasi
  let url = raw.trim();
  // ganti multiple dots di host menjadi satu
  url = url.replace(/\.{2,}/g, '.');
  // kalau tidak ada protocol, tambahkan http://
  if (!/^https?:\/\//i.test(url)) {
    url = 'http://' + url;
  }
  // validasi
  try {
    new URL(url);
  } catch {
    throw new Error(`Malformed webhook URL: ${url}`);
  }
  return url;
}


export const initWhatsAppClient = (cfg: { id: number; sessionFolder: string }) => {
  const readyPromise = new Promise<void>(res => readyResolvers.set(cfg.id, res));
  readyMap.set(cfg.id, readyPromise);

  const dataPath = path.join(process.cwd(), 'sessions', cfg.sessionFolder);
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: String(cfg.id), dataPath }),
    puppeteer: { headless: true },
  });

  // QR & status notifications
  client.on('qr', qr => {
    prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: false } });
    io.emit('qr',    { clientId: cfg.id, qr });
    io.emit('status',{ clientId: cfg.id, status: false });
  });
  client.on('ready', async () => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: true } });
    io.emit('status',{ clientId: cfg.id, status: true });
    readyResolvers.get(cfg.id)?.();
    readyResolvers.delete(cfg.id);
  });
  client.on('disconnected', async () => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: false } });
    io.emit('status',{ clientId: cfg.id, status: false });
    client.destroy();
    clients.delete(cfg.id);
    readyMap.delete(cfg.id);
    readyResolvers.delete(cfg.id);
    setTimeout(() => initWhatsAppClient(cfg), 5000);
  });
  client.on('auth_failure', async () => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: false } });
    io.emit('status',{ clientId: cfg.id, status: false });
    console.warn(`Auth failure for client ${cfg.id}`);
  });
  client.on('change_state', async state => {
    const isOnline = state === 'CONNECTED';
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: isOnline } });
    io.emit('status',{ clientId: cfg.id, status: isOnline });
  });

  // === HANDLE INCOMING MESSAGE ===
  client.on('message', async (msg: Message) => {
    if (msg.fromMe) return;

    // detect chat type
    const isGroup     = msg.from.endsWith('@g.us');
    const mentionsMe  = msg.mentionedIds?.includes(client.info?.me._serialized as any) ?? false;
    const isTagGroup  = isGroup && mentionsMe;
    const isPersonal  = !isGroup;

    // fetch reply-config
    const cfgDB = await prisma.whatsAppClient.findUnique({
      where: { id: cfg.id },
      select: {
        isReplyPersonal: true,
        isReplyGroup:    true,
        isReplyTag:      true,
        replyTemplatePersonal: true,
        replyTemplateGroup:    true,
        replyTemplateTag:      true,
      },
    });
    if (!cfgDB) return;

    // ---- AUTO-REPLY ----
    if (
      (isPersonal && cfgDB.isReplyPersonal) ||
      (isGroup    && cfgDB.isReplyGroup)    ||
      (isTagGroup && cfgDB.isReplyTag)
    ) {
      const tpl = isPersonal
        ? cfgDB.replyTemplatePersonal
        : isTagGroup
          ? cfgDB.replyTemplateTag
          : cfgDB.replyTemplateGroup;
      const text = tpl?.trim() || (isPersonal
        ? 'Terima kasih telah menghubungi kami!'
        : isTagGroup
          ? 'Terima kasih telah men-tag kami!'
          : 'Terima kasih kepada grup!'
      );
      try {
        await msg.reply(text);
        await prisma.message.create({
          data: {
            clientId:  cfg.id,
            to:        msg.from,
            body:      text,
            direction: 'OUT',
            status:    'SENT',
          },
        });
      } catch (e) {
        console.error('Auto-reply gagal:', e);
      }
    }

    // ---- SIMPAN PESAN MASUK ----
    await prisma.message.create({
      data: {
        clientId:  cfg.id,
        to:        msg.from,
        body:      msg.body,
        direction: 'IN',
        status:    'SENT',
      },
    });

    // ---- DISPATCH IN-WEBHOOK & RETURN RESPONSE ----
    const allHooks = await prisma.webhook.findMany({ where: { clientId: cfg.id } });
    const inHooks = allHooks.filter(h =>
      (isPersonal  && h.isPersonal) ||
      (isGroup     && h.isGroup)    ||
      (isTagGroup  && h.isTag)
    );
    for (const hook of inHooks) {
      const webhookUrl = normalizeUrl(hook.url);
      console.log(`Dispatching IN webhook (${hook.id}) to ${webhookUrl}`);
      try {
        const response = await axios.post(
          webhookUrl,
          {
            clientId:  cfg.id,
            direction: 'IN',
            from:      msg.from,
            msg:      msg.body,
            timestamp: msg.timestamp,
            isGroup,
            isPersonal,
            isTagGroup,
          },
          { headers: { [hook.signatureHeader]: hook.secretKey } }
        );
        console.log(`Webhook IN (${hook.id}) response:`, response);
        // Reply back to sender with webhook response
        const data = response.data as { output?: string };
        const replyText = typeof data.output === 'string'
          ? data.output
          : JSON.stringify(response.data);
        await msg.reply(replyText);
        await prisma.message.create({
          data: {
            clientId:  cfg.id,
            to:        msg.from,
            body:      replyText,
            direction: 'OUT',
            status:    'SENT',
          },
        });
      } catch (err) {
        console.error(`Webhook IN (${hook.id}) failed:`, err);
      }
    }
  });

  // ... outgoing handlers unchanged ...
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
