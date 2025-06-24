import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import expressLayouts from 'express-ejs-layouts';
import path from 'path';
import { json, urlencoded } from 'body-parser';
import methodOverride from 'method-override';
import clientRoutes from './routes/clientRoutes';
import { initWhatsAppClients } from './services/whatsappClients';
import { initScheduler } from './services/scheduler';

const app = express();
// Pasang static *segera* agar /styles.css dan /socket.io/socket.io.js tidak di‐override
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
export const io = new IOServer(server);

// EJS layouts
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(json());
app.use(urlencoded({ extended: true }));

// Mount routes
app.use('/clients', clientRoutes);
app.get('/', (req, res) => res.redirect('/clients'));

// Init services
initWhatsAppClients();
initScheduler();

const PORT = process.env.PORT || 3005;
// **PENTING**: listen on server, bukan app
server.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
