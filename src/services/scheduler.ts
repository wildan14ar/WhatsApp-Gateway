import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendWhatsAppMessage } from './whatsappClients';

function parseToList(to: string | string[]): string[] {
  if (Array.isArray(to)) return to;

  // split berdasarkan koma, spasi, atau kombinasi
  return to
    .split(/[\s,]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

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
        await sendWhatsAppMessage({
          clientId: msg.clientId,
          to: parseToList(msg.to),
          template: msg.body
        });
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
