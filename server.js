require("dotenv").config();
const express = require("express");

const path = require("path");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");
const cookieParser = require("cookie-parser");
const i18n = require("i18n");
const supabase = require("./config/supabase");
const http = require("http");
const { Server } = require("socket.io");
const hpp = require("hpp");

// --- MODULE NOI PENTRU PRODUCȚIE ---
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const indexRoutes = require("./routes/index");
const aiRoutes = require("./routes/aiRouter");
const requireAuth = require("./middleware/authMiddleware");
const chatRoutes = require('./routes/chatRoutes');
const presentationRoutes = require('./routes/presentationRoutes');
const notificationRoutes = require('./routes/notificationRouter');
const gamificationRoutes = require('./routes/gamificationRoutes'); 

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server);

// --- 2. OPTIMIZARE: COMPRESIE ---
app.use(compression());

// --- 3. SECURITATE: HELMET (CSP RELAXAT PENTRU DEVELOPMENT) ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", 
          "'unsafe-eval'", // Necesar uneori pentru JSXGraph / MathJax
          "https://cdn.quilljs.com",
          "https://cdn.jsdelivr.net", 
          "https://cdnjs.cloudflare.com",
          "https://kit.fontawesome.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.quilljs.com",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net", // CRITIC pentru JSXGraph CSS
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net", 
          "data:",
        ],
        // Am adăugat 'blob:' și 'https://*' pentru a acoperi mai multe surse de imagini (ex: Cloudinary)
        imgSrc: ["'self'", "data:", "blob:", "https://*"],
        mediaSrc: ["'self'", "https://cdn.pixabay.com", "https://*"],
        connectSrc: [
          "'self'",
          "https://generativelanguage.googleapis.com",
          "https://*.supabase.co",
          "https://0.peerjs.com",
          "ws:",
          "wss:",
        ],
        // --- ADĂUGAT: Permite iframe-uri de pe YouTube ---
        frameSrc: [
          "'self'",
          "https://www.youtube.com",
          "https://youtube.com",
          "https://youtu.be",
          "https://player.vimeo.com"
        ],
        // Fallback pentru browsere mai vechi sau comportamente specifice
        childSrc: [
          "'self'",
          "https://www.youtube.com",
          "https://youtube.com",
          "https://youtu.be",
          "https://player.vimeo.com"
        ]
      },
    },
    crossOriginEmbedderPolicy: false, // Dezactivam pentru a evita probleme cu resurse externe
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
  })
);


// --- 4. SECURITATE: RATE LIMITING ---
// Limitează cererile: max 100 request-uri pe 15 minute per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message:
    "Prea multe cereri de la acest IP, încearcă din nou peste 15 minute.",
});
// Aplică limita doar pe rutele API sau Auth pentru a nu bloca resursele statice
app.use("/auth", limiter);
app.use("/api", limiter);

app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("layout", "layouts/main");
app.set("views", path.join(__dirname, "views"));

// Folosim loguri 'short' sau 'combined' în producție, 'dev' doar local
app.use(morgan(process.env.NODE_ENV === "production" ? "short" : "dev"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(hpp());
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "1d",
  })
);
app.use(cookieParser());

i18n.configure({
  locales: ["ro", "it", "en"],
  directory: path.join(__dirname, "locales"),
  defaultLocale: "ro",
  cookie: "sapere_lang",
  queryParameter: "lang",
  objectNotation: true,
  updateFiles: false,
});
app.use(i18n.init);

app.use(async (req, res, next) => {
  res.locals.t = res.locals.__;
  const token = req.cookies.sb_token;
  res.locals.user = null;
  req.user = null;

  if (token) {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (user && !error) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (profile) {
          user.role = profile.role || "student";
          user.full_name = profile.full_name || user.email.split("@")[0];
          user.xp = profile.xp || 0;
          user.level = profile.level || 1;
          user.streak = profile.streak || 0;
        }
        req.user = user;
        res.locals.user = user;
      }
    } catch (err) {
      console.error("Auth Middleware Error:", err.message);
    }
  }

  const currentLang = req.cookies.sapere_lang || "ro";
  const langMap = {
    ro: { flag: "🇷🇴", name: "RO" },
    en: { flag: "🇬🇧", name: "EN" },
    it: { flag: "🇮🇹", name: "IT" },
  };
  res.locals.activeLang = langMap[currentLang] || langMap["ro"];
  next();
});

// ==========================================
// LOGICA REAL-TIME (SOCKET.IO)
// ==========================================

const groupStates = {};

io.on("connection", (socket) => {
  // ... (RESTUL CODULUI PENTRU SOCKET RĂMÂNE NESCHIMBAT) ...
  socket.on("join-group", (groupId, user) => {
    socket.data.userId = user.id;

    if (!groupStates[groupId]) {
      groupStates[groupId] = {
        presenterId: null,
        presenterName: null,
        activeView: "board",
        activeResource: null,
        settings: {
          notebookLocked: false,
          presentationLocked: false,
          videoLocked: false,
          exerciseInteractionLocked: true,
        },
        kickedUsers: new Set(),
        members: {},
      };
    }
    const state = groupStates[groupId];
    state.members[user.id] = user.role || "member";

    if (state.kickedUsers.has(user.id)) {
      socket.join(groupId);
      socket.emit("kicked-state", { isKicked: true });
      return;
    }

    socket.join(groupId);
    socket.to(groupId).emit("user-connected", user);

    if (state.presenterId) {
      socket.emit("control-changed", {
        presenterId: state.presenterId,
        presenterName: state.presenterName,
        message: {
          key: "session_active",
          params: { name: state.presenterName },
        },
      });
    }
    socket.emit("sync-settings", state.settings);

    if (state.activeView === "resource" && state.activeResource) {
      socket.emit("sync-resource", { ...state.activeResource, action: "load" });
    }
  });

  socket.on("request-reentry", (data) => {
    socket.to(data.groupId).emit("admin-reentry-request", {
      userId: data.userId,
      userName: data.userName,
    });
  });

  socket.on("approve-reentry", (data) => {
    const state = groupStates[data.groupId];
    if (state && state.kickedUsers.has(data.targetId)) {
      state.kickedUsers.delete(data.targetId);
      io.to(data.groupId).emit("reentry-accepted", { targetId: data.targetId });
    }
  });

  socket.on("force-control-and-share", (data) => {
    const state = groupStates[data.groupId];
    if (!state) return;

    state.presenterId = data.userId;
    state.presenterName = data.userName;

    const liveMsg = {
      key: "live_staff_resource",
      params: { name: data.userName },
    };

    if (data.type === "notebook") {
      state.activeView = "notebook";
      state.activeResource = null;
      io.to(data.groupId).emit("control-changed", {
        presenterId: data.userId,
        presenterName: data.userName,
        message: liveMsg,
      });
      io.to(data.groupId).emit("request-notebook-sync", {
        presenterId: data.userId,
      });
    } else {
      state.activeView = "resource";
      state.activeResource = {
        type: data.type,
        resourceId: data.resourceId,
        payload: null,
        index: 0,
        flipped: false,
      };
      io.to(data.groupId).emit("control-changed", {
        presenterId: data.userId,
        presenterName: data.userName,
        message: liveMsg,
      });
      io.to(data.groupId).emit("sync-resource", {
        senderId: data.userId,
        type: data.type,
        resourceId: data.resourceId,
        action: "load",
      });
    }
  });

  socket.on("request-share-permission", (data) => {
    socket.to(data.groupId).emit("admin-share-request", {
      requesterId: data.userId,
      requesterName: data.userName,
      resourceType: data.type,
      resourceId: data.resourceId,
      resourceTitle: data.title,
    });
  });

  socket.on("deny-share-permission", (data) => {
    io.to(data.groupId).emit("share-permission-denied", {
      targetId: data.targetId,
    });
  });

  socket.on("grant-share-permission", (data) => {
    const state = groupStates[data.groupId];
    if (!state) return;

    state.presenterId = data.targetId;

    io.to(data.groupId).emit("control-changed", {
      presenterId: data.targetId,
      presenterName: "Student",
      message: { key: "request_approved" },
    });

    if (data.type === "notebook") {
      state.activeView = "notebook";
      state.activeResource = null;
      io.to(data.groupId).emit("request-notebook-sync", {
        presenterId: data.targetId,
      });
    } else {
      state.activeView = "resource";
      state.activeResource = {
        type: data.type,
        resourceId: data.resourceId,
        index: 0,
        flipped: false,
      };
      io.to(data.groupId).emit("sync-resource", {
        senderId: data.targetId,
        type: data.type,
        resourceId: data.resourceId,
        action: "load",
      });
    }

    io.to(data.groupId).emit("share-permission-granted", {
      targetId: data.targetId,
    });
  });

  socket.on("update-settings", async (data) => {
    const state = groupStates[data.groupId];
    if (!state) return;

    if (data.setting === "presentationLocked" && data.value === true) {
      if (state.presenterId) {
        state.presenterId = null;
        state.presenterName = null;
        io.to(data.groupId).emit("control-released", { forced: true });
      }
    }

    state.settings[data.setting] = data.value;
    io.to(data.groupId).emit("sync-settings", state.settings);
  });

  socket.on("toggle-exercise-lock", (data) => {
    const state = groupStates[data.groupId];
    if (state) {
      state.settings.exerciseInteractionLocked = data.locked;
      io.to(data.groupId).emit("sync-settings", state.settings);
    }
  });

  socket.on("admin-action", (data) => {
    const state = groupStates[data.groupId];
    if (!state) return;

    const performerRole = data.performerRole || "member";
    const targetRole = state.members[data.targetUserId] || "member";

    if (performerRole === "moderator") {
      if (["admin", "owner", "moderator"].includes(targetRole)) return;
    }

    if (data.action === "kick") {
      state.kickedUsers.add(data.targetUserId);
    } else if (data.action === "unban_all") {
      state.kickedUsers.clear();
      io.to(data.groupId).emit("receive-message", {
        user: "Sistem",
        message: { key: "restrictions_reset" },
        type: "text",
      });
      return;
    }
    io.to(data.groupId).emit("admin-command", data);
  });

  socket.on("request-control", (data) => {
    const state = groupStates[data.groupId];
    const isStaff = ["admin", "owner", "moderator"].includes(data.role);

    if (state?.settings?.presentationLocked && !isStaff) {
      socket.emit("receive-message", {
        user: "Sistem",
        message: { key: "presentation_blocked" },
        type: "text",
      });
      return;
    }

    if (isStaff) {
      state.presenterId = data.userId;
      state.presenterName = data.userName;
      io.to(data.groupId).emit("control-changed", {
        presenterId: data.userId,
        presenterName: data.userName,
        message: { key: "live_staff", params: { name: data.userName } },
      });
    } else {
      io.to(data.groupId).emit("control-request", {
        requesterId: data.userId,
        requesterName: data.userName,
      });
    }
  });

  socket.on("release-control", (data) => {
    const state = groupStates[data.groupId];
    if (state && state.presenterId === data.userId) {
      state.presenterId = null;
      io.to(data.groupId).emit("control-released", {});
    }
  });

  socket.on("sync-resource", (data) => {
    const state = groupStates[data.groupId];
    if (!state) return;
    if (state.presenterId === socket.data.userId) {
      state.activeView = "resource";
      if (data.action === "load") {
        state.activeResource = {
          type: data.type,
          resourceId: data.resourceId,
          payload: data.payload,
          index: 0,
          flipped: false,
        };
      } else if (data.type === "flashcard" && data.action === "sync_state") {
        if (state.activeResource) {
          state.activeResource.index = data.payload.index;
          state.activeResource.flipped = data.payload.flipped;
        }
      }
      socket.to(data.groupId).emit("sync-resource", data);
    }
  });

  socket.on("sync-notebook-focus", (data) => {
    const state = groupStates[data.groupId];
    if (!state || state.presenterId === socket.data.userId) {
      if (state) state.activeView = "notebook";
      socket.to(data.groupId).emit("sync-notebook-focus", {});
    }
  });

  socket.on("notebook-change", (data) => {
    const state = groupStates[data.groupId];
    if (state && state.presenterId === socket.data.userId) {
      socket.to(data.groupId).emit("notebook-update", data.delta);
    }
  });

  socket.on("notebook-full-content", (data) => {
    const state = groupStates[data.groupId];
    if (state && state.presenterId === socket.data.userId) {
      socket.to(data.groupId).emit("notebook-set-content", data.content);
    }
  });

  socket.on("exercise-change", (data) => {
    const state = groupStates[data.groupId];
    if (state && state.presenterId === socket.data.userId) {
      socket.to(data.groupId).emit("exercise-update", data);
    }
  });

  socket.on("share-exercise-result", (data) => {
    io.to(data.groupId).emit("exercise-show-result", data);
  });

  socket.on("send-message", (data) =>
    io.to(data.groupId).emit("receive-message", data)
  );
  socket.on("draw-data", (data) =>
    socket.to(data.groupId).emit("draw-data", data)
  );
  socket.on("start-timer", (data) =>
    socket.to(data.groupId).emit("sync-timer", data)
  );
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use('/api/chat', chatRoutes);
app.use('/notifications', notificationRoutes);
app.use('/api/gamification', gamificationRoutes);

// MONTARE RUTE PREZENTARE LA /fizica (și mutare înainte de indexRoutes)
app.use('/fizica', presentationRoutes);

app.use("/", indexRoutes);

app.get("/lang/:locale", (req, res) => {
  const locale = req.params.locale;
  const supported = ["ro", "it", "en"];
  if (supported.includes(locale)) {
    res.cookie("sapere_lang", locale, { maxAge: 90000000, httpOnly: true });
  }
  const backURL = req.get("Referer") || "/";
  res.redirect(backURL);
});
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("pages/404", {
    title: "Eroare Server",
    user: req.user || null,
  });
});

app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// Scriptul de auto-apelare (doar în producție sau dacă vrei și local)
const APP_URL = "https://saperehub.onrender.com";

// Pornim timer-ul doar dacă URL-ul este setat (poți scoate if-ul dacă vrei să ruleze mereu)
if (APP_URL && !APP_URL.includes("localhost")) {
  console.log(`[KeepAlive] Pornit pentru: ${APP_URL}`);

  setInterval(async () => {
    try {
      const response = await fetch(`${APP_URL}/ping`);
      if (response.ok) {
        console.log(`[KeepAlive] Ping succes la ${new Date().toISOString()}`);
      } else {
        console.log(`[KeepAlive] Ping primit status: ${response.status}`);
      }
    } catch (error) {
      console.error(`[KeepAlive] Eroare la ping: ${error.message}`);
    }
  }, 14 * 60 * 1000); // 14 minute (Render adoarme la 15 minute)
}

server.listen(PORT, () => {
  console.log(
    `🚀 Serverul rulează în modul ${
      process.env.NODE_ENV || "development"
    } pe portul ${PORT}`
  );
});