const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const ConversationParticipant = require("../models/conversationParticipant");

// A socket handshake never passes through Express, so cookie-parser never
// runs -- the raw Cookie header is parsed manually here, then verified with
// the same secret middleware/auth.js uses.
function attachSocket(server) {
  const io = new Server(server);

  io.use((socket, next) => {
    try {
      const token = cookie.parse(socket.handshake.headers.cookie || "").token;
      if (!token) return next(new Error("unauthorized"));
      socket.userID = jwt.verify(token, "SECRET_KEY").id;
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // Rooms are "conversation:<uuid>". The server verifies participation
    // before joining -- nobody can eavesdrop on a thread by guessing its id.
    socket.on("join-conversation", async (conversationID) => {
      try {
        if (!conversationID) return;
        const participant = await ConversationParticipant.findOne({
          where: { conversationID, userID: socket.userID }
        });
        if (participant) socket.join(`conversation:${conversationID}`);
      } catch (err) {
        console.error("join-conversation failed:", err.message);
      }
    });
  });

  return io;
}

module.exports = { attachSocket };
