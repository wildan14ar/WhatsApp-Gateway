import express from 'express';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  sendMessage,
  scheduleMessage,
  updateAutoReply,
  updateWebhook,
} from '../controllers/clientController';

const router = express.Router();

// CRUD WhatsAppClient
router.get('/', getClients);
router.get('/:id', getClient);
router.post('/', createClient);
router.put('/:id', updateClient); // Assuming update is the same as create for this case
router.delete('/:id', deleteClient);
router.post('/:id/messages/send', sendMessage);
router.post('/:id/messages/schedule', scheduleMessage);
router.patch('/:id/auto-reply', updateAutoReply);
router.patch('/:id/webhook', updateWebhook);

export default router;
