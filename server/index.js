require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const assessmentRoutes = require('./routes/assessment');
const candidateRoutes = require('./routes/candidates');
const sessionRoutes = require('./routes/session');
const authRoutes = require('./routes/auth');

// ── ASCII Banner ──────────────────────────────────────────────────────────────
function printBanner(port) {
  console.log(`
\x1b[35m
  ██╗  ██╗██╗██████╗ ███████╗ █████╗ ██╗
  ██║  ██║██║██╔══██╗██╔════╝██╔══██╗██║
  ███████║██║██████╔╝█████╗  ███████║██║
  ██╔══██║██║██╔══██╗██╔══╝  ██╔══██║██║
  ██║  ██║██║██║  ██║███████╗██║  ██║██║
  ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝
\x1b[0m\x1b[1m  Autonomous AI Interview & Proctoring Platform\x1b[0m
  ${'─'.repeat(46)}
  \x1b[32m✔\x1b[0m  Express server     → http://localhost:${port}
  \x1b[32m✔\x1b[0m  Socket.IO (WebRTC) → ws://localhost:${port}
  \x1b[32m✔\x1b[0m  Gemini API key     → ${process.env.GEMINI_API_KEY ? '\x1b[32mconfigured\x1b[0m' : '\x1b[31mNOT SET — add to .env\x1b[0m'}
  \x1b[32m✔\x1b[0m  Environment        → ${process.env.NODE_ENV || 'development'}
  ${'─'.repeat(46)}
`);
}

// ── App Setup ─────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5000',
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── File Upload Config ────────────────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── In-Memory Stores ──────────────────────────────────────────────────────────
const sessions = new Map();       // sessionId -> session object
const candidates = new Map();     // candidateId -> assessment object
const mobileSessions = new Map(); // sessionId -> { hostSocketId, mobileSocketId }

app.locals.sessions = sessions;
app.locals.candidates = candidates;
app.locals.io = io;

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api', assessmentRoutes(upload));
app.use('/api', candidateRoutes);
app.use('/api', sessionRoutes);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    time: new Date().toISOString(),
    candidates: candidates.size,
    sessions: sessions.size,
    activeSockets: io.engine.clientsCount,
  })
);

// ── Production: Serve React build ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  // Catch-all: serve index.html for any non-API route (SPA routing)
  app.get('*', (req, res) => {
    if (
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/socket.io') &&
      !req.path.startsWith('/health')
    ) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ── Live Stats Broadcast (every 5 seconds) ────────────────────────────────────
setInterval(() => {
  const allCandidates = [...candidates.values()];
  const totalCandidates = allCandidates.length;

  const avgScore = totalCandidates
    ? (allCandidates.reduce((sum, c) => sum + parseFloat(c.avgScore || 0), 0) / totalCandidates).toFixed(2)
    : '0.00';

  const avgTrust = totalCandidates
    ? (allCandidates.reduce((sum, c) => sum + (c.trustScore || 100), 0) / totalCandidates).toFixed(1)
    : '100.0';

  const hireCount   = allCandidates.filter(c => c.aiReport?.recommendation === 'HIRE').length;
  const holdCount   = allCandidates.filter(c => c.aiReport?.recommendation === 'HOLD').length;
  const rejectCount = allCandidates.filter(c => c.aiReport?.recommendation === 'REJECT').length;

  io.emit('stats:update', {
    total:           totalCandidates,
    hired:           hireCount,
    hold:            holdCount,
    rejected:        rejectCount,
    totalCandidates,
    avgScore:        parseFloat(avgScore),
    avgTrust:        parseFloat(avgTrust),
    hireCount,
    holdCount,
    rejectCount,
    activeSessions:   sessions.size,
    connectedSockets: io.engine.clientsCount,
    timestamp:        new Date().toISOString(),
  });
}, 5000);

// ── Socket.IO — WebRTC Signaling & Proctoring ─────────────────────────────────
io.on('connection', (socket) => {
  console.log(`\x1b[36m[Socket]\x1b[0m Connected:    ${socket.id}`);

  // Host (laptop) registers a session
  socket.on('host:register', ({ sessionId }) => {
    if (!sessionId) return;
    if (!mobileSessions.has(sessionId)) {
      mobileSessions.set(sessionId, { hostSocketId: socket.id, mobileSocketId: null });
    } else {
      mobileSessions.get(sessionId).hostSocketId = socket.id;
    }
    socket.join(`session:${sessionId}`);
    console.log(`\x1b[36m[Socket]\x1b[0m Host registered  session=${sessionId}`);
    socket.emit('host:registered', { sessionId });
  });

  // Mobile joins a session
  socket.on('mobile:join', ({ sessionId }) => {
    if (!sessionId) return;
    if (!mobileSessions.has(sessionId)) {
      mobileSessions.set(sessionId, { hostSocketId: null, mobileSocketId: socket.id });
    } else {
      mobileSessions.get(sessionId).mobileSocketId = socket.id;
    }
    socket.join(`session:${sessionId}`);
    const hostId = mobileSessions.get(sessionId)?.hostSocketId;
    if (hostId) {
      io.to(hostId).emit('mobile:connected', { sessionId, mobileSocketId: socket.id });
    }
    socket.emit('mobile:joined', { sessionId });
    console.log(`\x1b[36m[Socket]\x1b[0m Mobile joined    session=${sessionId}`);
  });

  // WebRTC Offer (mobile -> host)
  socket.on('webrtc:offer', ({ sessionId, offer }) => {
    const sess = mobileSessions.get(sessionId);
    if (sess?.hostSocketId) {
      io.to(sess.hostSocketId).emit('webrtc:offer', { offer, mobileSocketId: socket.id });
    }
  });

  // WebRTC Answer (host -> mobile)
  socket.on('webrtc:answer', ({ sessionId, answer }) => {
    const sess = mobileSessions.get(sessionId);
    if (sess?.mobileSocketId) {
      io.to(sess.mobileSocketId).emit('webrtc:answer', { answer });
    }
  });

  // ICE Candidates
  socket.on('webrtc:ice', ({ sessionId, candidate, target }) => {
    const sess = mobileSessions.get(sessionId);
    if (!sess) return;
    const targetId = target === 'host' ? sess.hostSocketId : sess.mobileSocketId;
    if (targetId) {
      io.to(targetId).emit('webrtc:ice', { candidate });
    }
  });

  // Proctoring Events
  socket.on('proctor:event', ({ sessionId, event }) => {
    const payload = { event, timestamp: Date.now() };
    io.to(`hr:${sessionId}`).emit('proctor:event', payload);
    const candidate = [...candidates.values()].find(c => c.sessionId === sessionId);
    if (candidate) {
      if (!candidate.proctorEvents) candidate.proctorEvents = [];
      candidate.proctorEvents.push({ ...event, timestamp: Date.now() });
    }
  });

  // Candidate Submitted (re-broadcast for HR dashboards)
  socket.on('candidate:submitted', ({ candidateId, name, jobTitle, avgScore, recommendation }) => {
    io.emit('candidate:submitted', { candidateId, name, jobTitle, avgScore, recommendation });
  });

  // Interview lifecycle events
  socket.on('interview:started', ({ sessionId }) => {
    io.emit('interview:started', { sessionId });
  });
  socket.on('interview:ended', ({ sessionId }) => {
    io.emit('interview:ended', { sessionId });
  });

  // HR Monitor Joins Session Room
  socket.on('hr:monitor', ({ sessionId }) => {
    if (!sessionId) return;
    socket.join(`hr:${sessionId}`);
    socket.emit('hr:monitoring', { sessionId });
    console.log(`\x1b[36m[Socket]\x1b[0m HR monitoring    session=${sessionId}`);
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`\x1b[33m[Socket]\x1b[0m Disconnected: ${socket.id} (${reason})`);
    for (const [sessionId, sess] of mobileSessions.entries()) {
      if (sess.mobileSocketId === socket.id) {
        sess.mobileSocketId = null;
        if (sess.hostSocketId) {
          io.to(sess.hostSocketId).emit('mobile:disconnected', {
            sessionId,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (sess.hostSocketId === socket.id) {
        sess.hostSocketId = null;
      }
    }
  });
});

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\x1b[31m[Error]\x1b[0m Port ${PORT} is already in use. Stop the existing server first.\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

server.listen(PORT, () => {
  printBanner(PORT);
});

// Graceful shutdown
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { server.close(() => process.exit(0)); });
