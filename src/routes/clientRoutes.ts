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
  createWebhook,
  updateWebhook,
  deleteWebhook,
} from '../controllers/clientController';
import { create } from 'axios';

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
router.post('/:id/webhook', createWebhook); // Assuming createWebhook is a function to create a new webhook
router.put('/webhook/:webhookId', updateWebhook);
router.delete('/webhook/:webhookId', deleteWebhook);

export default router;
