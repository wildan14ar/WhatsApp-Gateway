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

export const syncContacts = async (client: Client, clientId: number) => {
  try {
    const allContacts = await client.getContacts();

    for (const c of allContacts) {
      const isGroup = c.isGroup;
      const isCommunity = (c as any).isCommunity || false;
      const waId = c.id._serialized;
      const type = isGroup
        ? isCommunity ? 'COMMUNITY' : 'GROUP'
        : 'PERSONAL';

      const name = c.name || c.pushname || 'Unknown';
      const phone = c.id.user;
      let profilePicUrl: string | null = null;

      try {
        profilePicUrl = await client.getProfilePicUrl(waId);
      } catch (e) {
        profilePicUrl = null;
      }

      const existing = await prisma.contact.findFirst({
        where: { waId, clientId },
      });

      if (existing) {
        await prisma.contact.update({
          where: { id: existing.id },
          data: {
            name,
            phone,
            profilePicUrl,
            type,
          },
        });
      } else {
        await prisma.contact.create({
          data: {
            clientId,
            waId,
            name,
            phone,
            profilePicUrl,
            type,
          },
        });
      }
    }

    console.log(`✅ Sinkronisasi kontak selesai untuk clientId: ${clientId} (${allContacts.length} kontak)`);
  } catch (err) {
    console.error('❌ Gagal sinkronisasi kontak:', err);
  }
};

export const handleAutoReply = async (client: Client, msg: Message, clientId: number) => {
  if (msg.fromMe) return;

  const isGroup = msg.from.endsWith('@g.us');
  const mentionsMe = msg.mentionedIds?.includes(client.info?.me._serialized as any) ?? false;
  const isTagGroup = isGroup && mentionsMe;
  const isPersonal = !isGroup;

  const cfgDB = await prisma.autoReply.findUnique({
    where: { clientId },
    select: {
      isReplyPersonal: true,
      isReplyGroup: true,
      isReplyTag: true,
      replyTemplatePersonal: true,
      replyTemplateGroup: true,
      replyTemplateTag: true,
    },
  });
  if (!cfgDB) return;

  if (
    (isPersonal && cfgDB.isReplyPersonal) ||
    (isGroup && cfgDB.isReplyGroup) ||
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
          clientId,
          to: msg.from,
          body: text,
          direction: 'OUT',
          status: 'SENT',
        },
      });
    } catch (e) {
      console.error('Auto-reply gagal:', e);
    }
  }
};

export const dispatchIncomingWebhooks = async (client: Client, msg: Message, clientId: number) => {
  const isGroup = msg.from.endsWith('@g.us');
  const mentionsMe = msg.mentionedIds?.includes(client.info?.me._serialized as any) ?? false;
  const isTagGroup = isGroup && mentionsMe;
  const isPersonal = !isGroup;

  const allHooks = await prisma.webhook.findMany({ where: { clientId } });
  const inHooks = allHooks.filter(h =>
    (isPersonal && h.isPersonal) ||
    (isGroup && h.isGroup) ||
    (isTagGroup && h.isTag)
  );

  for (const hook of inHooks) {
    const webhookUrl = normalizeUrl(hook.url);
    console.log(`Dispatching IN webhook (${hook.id}) to ${webhookUrl}`);
    try {
      const response = await axios.post(
        webhookUrl,
        {
          clientId,
          direction: 'IN',
          from: msg.from,
          msg: msg.body,
          timestamp: msg.timestamp,
          isGroup,
          isPersonal,
          isTagGroup,
        },
        { headers: { [hook.signatureHeader]: hook.secretKey } }
      );

      console.log(`Webhook IN (${hook.id}) response:`, response);
      const data = response.data as { output?: string };
      const replyText = typeof data.output === 'string'
        ? data.output
        : JSON.stringify(response.data);
      await msg.reply(replyText);
      await prisma.message.create({
        data: {
          clientId,
          to: msg.from,
          body: replyText,
          direction: 'OUT',
          status: 'SENT',
        },
      });
    } catch (err) {
      console.error(`Webhook IN (${hook.id}) failed:`, err);
    }
  }
};

export const initWhatsAppClient = (cfg: { id: number; sessionFolder: string }) => {
  const readyPromise = new Promise<void>(res => readyResolvers.set(cfg.id, res));
  readyMap.set(cfg.id, readyPromise);

  const dataPath = path.join(process.cwd(), 'sessions', cfg.sessionFolder);
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: String(cfg.id), dataPath }),
    puppeteer: { headless: true },
  });

  io.emit('status', { clientId: cfg.id, status: "DISCONNECTED" });
  prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: "DISCONNECTED" } });

  // QR & status notifications
  client.on('qr', qr => {
    prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: "SCANNING" } });
    io.emit('qr', { clientId: cfg.id, qr });
    io.emit('status', { clientId: cfg.id, status: "SCANNING" });
  });
  client.on('ready', async () => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: "CONNECTED" } });
    io.emit('status', { clientId: cfg.id, status: "CONNECTED" });

    // Panggil fungsi sync kontak
    await syncContacts(client, cfg.id);

    // === Ambil informasi client ===
    try {
      const me = client.info?.me;
      const waName = client.info?.pushname || 'Unknown';
      const waId = me?._serialized || '';
      const phoneNumber = me?.user || '';

      let profilePicUrl: string | null = null;
      try {
        profilePicUrl = await client.getProfilePicUrl(me?._serialized || '');
      } catch {
        profilePicUrl = null;
      }

      // Simpan ke DB
      await prisma.whatsAppClient.update({
        where: { id: cfg.id },
        data: {
          waName,
          phoneNumber,
          waId,
          profilePicUrl,
        },
      });

      console.log(`✅ Informasi client ${cfg.id} berhasil disimpan ke database`);
    } catch (e) {
      console.error(`❌ Gagal simpan informasi WA client (${cfg.id}):`, e);
    }

    readyResolvers.get(cfg.id)?.();
    readyResolvers.delete(cfg.id);
  });
  client.on('disconnected', async () => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: "DISCONNECTED" } });
    io.emit('status', { clientId: cfg.id, status: "DISCONNECTED" });
    client.destroy();
    clients.delete(cfg.id);
    readyMap.delete(cfg.id);
    readyResolvers.delete(cfg.id);
    setTimeout(() => initWhatsAppClient(cfg), 5000);
  });
  client.on('auth_failure', async () => {
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: "DISCONNECTED" } });
    io.emit('status', { clientId: cfg.id, status: "DISCONNECTED" });
    console.warn(`Auth failure for client ${cfg.id}`);
  });
  client.on('change_state', async state => {
    const isOnline = state === 'CONNECTED';
    await prisma.whatsAppClient.update({ where: { id: cfg.id }, data: { status: isOnline ? "CONNECTED" : "DISCONNECTED" } });
    io.emit('status', { clientId: cfg.id, status: isOnline ? "CONNECTED" : "DISCONNECTED" });
  });

  // === HANDLE INCOMING MESSAGE ===
  client.on('message', async (msg: Message) => {
    if (msg.fromMe) return;

    await prisma.message.create({
      data: {
        clientId: cfg.id,
        to: msg.from,
        body: msg.body,
        direction: 'IN',
        status: 'SENT',
      },
    });

    await handleAutoReply(client, msg, cfg.id);
    await dispatchIncomingWebhooks(client, msg, cfg.id);
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
