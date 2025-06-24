import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendWhatsAppMessage } from './whatsappClients';

export const initScheduler = () => {
  // jalankan setiap menit
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const due = await prisma.message.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
    });
    for (const msg of due) {
      try {
        await sendWhatsAppMessage(msg.clientId, msg.to, msg.body);
        await prisma.message.update({
          where: { id: msg.id },
          data: { status: 'SENT' },
        });
      } catch (err) {
        await prisma.message.update({
          where: { id: msg.id },
          data: { status: 'FAILED' },
        });
      }
    }
  });
};
