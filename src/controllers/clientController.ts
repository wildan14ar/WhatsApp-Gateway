// src/controllers/clientController.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { hashSecretKey, verifySecretKey } from '../lib/crypto';
import { initWhatsAppClient } from '../services/whatsappClients';
import { sendWhatsAppMessage } from '../services/whatsappClients';

export const getClients = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const clients = await prisma.whatsAppClient.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.render('clients', { clients });
  } catch (err) {
    next(err);
  }
};

export const getClient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const client = await prisma.whatsAppClient.findUnique({ where: { id }, include: { messages: true, webhooks: true } });
    if (!client) {
      res.status(404).send('Client not found');
      return;
    }
    res.render('client', { client });
  } catch (err) {
    next(err);
  }
};

export const createClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, secretKey } = req.body;
    if (!name || !secretKey) {
      res.status(400).send('Name and secret key are required');
      return;
    }

    const hashedSecretKey = await hashSecretKey(secretKey);
    const folderName = randomUUID();
    const sessionPath = path.join(process.cwd(), 'sessions', folderName);
    fs.mkdirSync(sessionPath, { recursive: true });

    // 2) simpan ke DB dengan sessionFolder
    const newClient = await prisma.whatsAppClient.create({
      data: {
        name,
        secretKey: hashedSecretKey,
        status: false,
        sessionFolder: folderName,
      },
    });

    initWhatsAppClient({ id: newClient.id, sessionFolder: folderName });

    res.redirect('/clients');
  } catch (err) {
    next(err);
  }
};


export const updateClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { name, secretKey } = req.body;

    if (!name || !secretKey) {
      res.status(400).send('Name and secret key are required');
      return;
    }

    const client = await prisma.whatsAppClient.findUnique({ where: { id } });
    if (!client) {
      res.status(404).send('Client not found');
      return;
    }

    const hashedSecretKey = await hashSecretKey(secretKey);

    // update DB
    await prisma.whatsAppClient.update({
      where: { id },
      data: { name, secretKey: hashedSecretKey },
    });

    // re-initialize WhatsApp client
    initWhatsAppClient({ id, sessionFolder: client.sessionFolder });

    res.redirect('/clients');
  } catch (err) {
    next(err);
  }
};

export const deleteClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const client = await prisma.whatsAppClient.findUnique({ where: { id } });
    if (!client) {
      res.status(404).send('Client not found');
      return;
    }

    // hapus record DB
    await prisma.whatsAppClient.delete({ where: { id } });

    // hapus session folder
    const sessionPath = path.join(process.cwd(), 'sessions', client.sessionFolder);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    if (req.xhr) {
      res.sendStatus(204);
    } else {
      res.redirect('/clients');
    }
  } catch (err) {
    next(err);
  }
};

export async function sendMessage(req: Request, res: Response) {
  const clientId = +req.params.id;
  const { to, body } = req.body;
  try {
    await sendWhatsAppMessage(clientId, to, body);
    await prisma.message.create({
      data: {
        clientId,
        to,
        body,
        direction: 'OUT',
        status: 'SENT',
      },
    });
    res.status(200).json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export async function scheduleMessage(req: Request, res: Response) {
  const clientId = +req.params.id;
  const { to, body, scheduledAt } = req.body;
  try {
    await prisma.message.create({
      data: {
        clientId,
        to,
        body,
        direction: 'OUT',
        status: 'SCHEDULED',
        scheduledAt: new Date(scheduledAt),
      },
    });
    res.status(201).json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
}

export async function updateAutoReply(req: Request, res: Response) {
  const clientId = +req.params.id;
  const {
    isReplyPersonal,
    isReplyGroup,
    isReplyTag,
    replyTemplatePersonal,
    replyTemplateGroup,
    replyTemplateTag,
  } = req.body;

  try {
    const updated = await prisma.whatsAppClient.update({
      where: { id: clientId },
      data: {
        // update flags
        isReplyPersonal: isReplyPersonal ?? false,
        isReplyGroup: isReplyGroup ?? false,
        isReplyTag: isReplyTag ?? false,
        // hanya simpan template jika flag true
        replyTemplatePersonal: isReplyPersonal ? replyTemplatePersonal : null,
        replyTemplateGroup: isReplyGroup ? replyTemplateGroup : null,
        replyTemplateTag: isReplyTag ? replyTemplateTag : null,
      },
    });

    res.json({ success: true, client: updated });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

function parseBool(val: any): boolean | undefined {
  if (val === undefined) return undefined;
  // val bisa "true" atau "false", atau boolean sebenarnya
  return val === 'true' || val === true;
}

export async function createWebhook(req: Request, res: Response) {
  const clientId = Number(req.params.id);
  const { url, name, description, signatureHeader, isPersonal, isGroup, isTag } = req.body;
  const secretKey = randomUUID(); // Pastikan secretKey dikirim dari client

  try {
    const newWebhook = await prisma.webhook.create({
      data: {
        url,
        name,
        description,
        signatureHeader,
        isPersonal: isPersonal ?? false, // Default to false if not provided
        isGroup: isGroup ?? false, // Default to false if not provided
        isTag: isTag ?? false, // Default to false if not provided
        clientId, // Hubungkan dengan WhatsAppClient
        secretKey // Pastikan secretKey dikirim dari client
      },
    });
    res.status(201).json({ success: true, webhook: newWebhook });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateWebhook(req: Request, res: Response) {
  // params.id di sini adalah ID dari record Webhook, bukan WhatsAppClient
  const webhookId = Number(req.params.webhookId)
  const { url, name, description, signatureHeader, isPersonal, isGroup, isTag } = req.body

  try {
    const updated = await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        url,
        name,
        description,
        signatureHeader,
        isPersonal: parseBool(isPersonal) ?? false, // Default to false if not provided
        isGroup: parseBool(isGroup) ?? false, // Default to false if not provided
        isTag: parseBool(isTag) ?? false, // Default to false if not provided
      },
    })
    res.json({ success: true, webhook: updated })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function deleteWebhook(req: Request, res: Response) {
  const webhookId = Number(req.params.webhookId)

  try {
    await prisma.webhook.delete({ where: { id: webhookId } })
    res.sendStatus(204)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
}