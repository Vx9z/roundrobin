const { Op } = require("sequelize");
const Conversation = require("../models/conversation");
const ConversationParticipant = require("../models/conversationParticipant");
const Message = require("../models/message");
const User = require("../models/user");
const { getCurrentUserID } = require("../middleware/auth");
const { isBlockedBetween } = require("../middleware/permissions");
const { getFriends, areMutualFollows } = require("./userController");
const { createNotification } = require("./notificationController");
const { getAIResponse, AI_BOT_USER_ID } = require("../config/ollama");
const { getRelevantPosts } = require("./postController");

function dmKeyFor(userA, userB) {
  return [String(userA).toLowerCase(), String(userB).toLowerCase()].sort().join(":");
}

async function requireParticipant(conversationID, userID) {
  const participant = await ConversationParticipant.findOne({ where: { conversationID, userID } });
  return !!participant;
}

// Asks Ollama for a reply and inserts it as a message from the bot, then
// pushes it through the same socket room a human's message would use. A
// failed Ollama call (server down, model not pulled, timeout) still
// produces a real message the user can see, rather than silence.
async function generateAIReply(conversationID, io) {
  const history = await Message.findAll({
    where: { conversationID },
    order: [["createdAt", "DESC"]],
    limit: 20
  });

  // Rudimentary RAG: ground the reply in whatever's actually been posted on
  // the platform, using the user's own latest message as the retrieval
  // query. history is DESC, so the first non-bot entry is the most recent
  // human message. Retrieval failure degrades to no context, never a hard
  // failure -- the reply must still happen even if Ollama's embed endpoint
  // is unreachable.
  const lastUserMsg = history.find(m => m.senderID !== AI_BOT_USER_ID);
  let ragContext = null;
  if (lastUserMsg) {
    try {
      const relevantPosts = await getRelevantPosts(lastUserMsg.content, lastUserMsg.senderID);
      if (relevantPosts.length) {
        const authors = await User.findAll({ where: { userID: relevantPosts.map(p => p.authorID) } });
        const usernameByID = Object.fromEntries(authors.map(u => [u.userID, u.username]));
        // Author names are load-bearing here, not decoration: without them the
        // model has no way to tell "context I retrieved" from "things I did
        // myself" and answers in the first person as if it were the post's author.
        ragContext = "Relevant posts made on this platform (these are NOT things you, the assistant, said or did -- " +
          "attribute each one to its author by name if you reference it):\n" +
          relevantPosts.map((p, i) => `${i + 1}. ${usernameByID[p.authorID] || "[deleted]"}: ${p.content}`).join("\n");
      }
    } catch (err) {
      console.error("RAG retrieval failed:", err.message);
    }
  }

  const chatMessages = history.reverse().map(m => ({
    role: m.senderID === AI_BOT_USER_ID ? "assistant" : "user",
    content: m.content
  }));

  let replyContent;
  try {
    replyContent = await getAIResponse(chatMessages, ragContext);
  } catch (err) {
    console.error("Ollama call failed:", err.message);
    replyContent = "Sorry, I'm having trouble responding right now. Please try again in a moment.";
  }

  const reply = await Message.create({ conversationID, senderID: AI_BOT_USER_ID, content: replyContent });

  if (io) {
    io.to(`conversation:${conversationID}`).emit("new-message", {
      conversationID,
      messageID: reply.messageID,
      senderID: AI_BOT_USER_ID,
      senderUsername: "AI Assistant",
      content: reply.content,
      createdAtDisplay: reply.createdAt.toLocaleString()
    });
  }
}

exports.showInbox = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const myParticipations = await ConversationParticipant.findAll({ where: { userID: currentUserID } });

    const rows = [];
    for (const p of myParticipations) {
      const conversation = await Conversation.findByPk(p.conversationID);
      if (!conversation) continue;

      const others = await ConversationParticipant.findAll({
        where: { conversationID: conversation.conversationID, userID: { [Op.ne]: currentUserID } },
        include: [{ model: User }]
      });
      const otherUsernames = others.map(o => (o.User ? o.User.username : "[deleted]"));

      const lastMessage = await Message.findOne({
        where: { conversationID: conversation.conversationID },
        order: [["createdAt", "DESC"]]
      });

      const isGroup = conversation.type === "group";
      const displayName = isGroup ? conversation.name : (otherUsernames[0] || "[deleted]");
      const sortDate = lastMessage ? lastMessage.createdAt : conversation.createdAt;

      rows.push({
        conversationID: conversation.conversationID,
        isGroup,
        displayName,
        otherCount: others.length,
        lastMessagePreview: lastMessage ? lastMessage.content.slice(0, 60) : null,
        lastMessageAtDisplay: sortDate.toLocaleString(),
        sortDate
      });
    }

    rows.sort((a, b) => b.sortDate - a.sortDate);

    res.render("messages/inbox", { title: "Messages", currentUserID, conversations: rows });
  } catch (err) {
    res.status(500).send("Error loading messages: " + err.message);
  }
};

exports.showNewDMForm = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const friends = await getFriends(currentUserID);
    const usable = [];
    for (const f of friends) {
      if (!(await isBlockedBetween(currentUserID, f.userID))) usable.push(f);
    }

    res.render("messages/newDM", { title: "New Message", currentUserID, friends: usable });
  } catch (err) {
    res.status(500).send("Error loading friends list: " + err.message);
  }
};

exports.startDM = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const friendID = req.body.userID;
    if (!friendID || friendID === currentUserID) return res.redirect("/messages/new");
    if (!(await areMutualFollows(currentUserID, friendID))) return res.redirect("/messages/new");
    if (await isBlockedBetween(currentUserID, friendID)) return res.redirect("/messages/new");

    const dmKey = dmKeyFor(currentUserID, friendID);
    let conversation = await Conversation.findOne({ where: { dmKey } });

    if (!conversation) {
      try {
        conversation = await Conversation.create({ type: "dm", name: null, dmKey, createdBy: currentUserID });
        await ConversationParticipant.create({ conversationID: conversation.conversationID, userID: currentUserID });
        await ConversationParticipant.create({ conversationID: conversation.conversationID, userID: friendID });
      } catch (err) {
        // Lost a race against a simultaneous startDM for the same pair.
        conversation = await Conversation.findOne({ where: { dmKey } });
        if (!conversation) throw err;
      }
    }

    res.redirect(`/messages/${conversation.conversationID}`);
  } catch (err) {
    res.status(500).send("Error starting conversation: " + err.message);
  }
};

// Same find-or-create-by-dmKey shape as startDM, but WITHOUT the friend/block
// gates -- the AI bot isn't a peer relationship. Redirects into the same
// showThread every other DM uses; nothing about the thread view needs to
// know this conversation is special.
exports.showAIChat = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const dmKey = dmKeyFor(currentUserID, AI_BOT_USER_ID);
    let conversation = await Conversation.findOne({ where: { dmKey } });

    if (!conversation) {
      try {
        conversation = await Conversation.create({ type: "dm", name: null, dmKey, createdBy: currentUserID });
        await ConversationParticipant.create({ conversationID: conversation.conversationID, userID: currentUserID });
        await ConversationParticipant.create({ conversationID: conversation.conversationID, userID: AI_BOT_USER_ID });
      } catch (err) {
        conversation = await Conversation.findOne({ where: { dmKey } });
        if (!conversation) throw err;
      }
    }

    res.redirect(`/messages/${conversation.conversationID}`);
  } catch (err) {
    res.status(500).send("Error starting AI chat: " + err.message);
  }
};

exports.showNewGroupForm = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const friends = await getFriends(currentUserID);
    const usable = [];
    for (const f of friends) {
      if (!(await isBlockedBetween(currentUserID, f.userID))) usable.push(f);
    }

    res.render("messages/newGroup", { title: "New Group", currentUserID, friends: usable });
  } catch (err) {
    res.status(500).send("Error loading friends list: " + err.message);
  }
};

exports.createGroup = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const friends = await getFriends(currentUserID);

    const rerenderWithError = (error) =>
      res.render("messages/newGroup", { title: "New Group", currentUserID, friends, error });

    const { name } = req.body;
    if (!name || !name.trim()) return rerenderWithError("Group name is required");

    // A single checked box submits as a bare string, not an array.
    const requested = [].concat(req.body.memberIDs || []);
    const ids = [...new Set(requested)].filter(id => id && id !== currentUserID);
    if (!ids.length) return rerenderWithError("Pick at least one member");

    for (const id of ids) {
      if (!(await areMutualFollows(currentUserID, id))) return rerenderWithError("You can only add friends to a group");
      if (await isBlockedBetween(currentUserID, id)) return rerenderWithError("You can only add friends to a group");
    }

    const conversation = await Conversation.create({ type: "group", name, dmKey: null, createdBy: currentUserID });
    await ConversationParticipant.create({ conversationID: conversation.conversationID, userID: currentUserID });
    for (const id of ids) {
      await ConversationParticipant.create({ conversationID: conversation.conversationID, userID: id });
      await createNotification({
        recipientID: id, actorID: currentUserID,
        type: "group_added", entityType: "conversation", entityID: conversation.conversationID
      });
    }

    res.redirect(`/messages/${conversation.conversationID}`);
  } catch (err) {
    res.status(500).send("Error creating group: " + err.message);
  }
};

exports.showThread = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const conversationID = req.params.id;
    if (!(await requireParticipant(conversationID, currentUserID))) return res.redirect("/messages");

    const conversation = await Conversation.findByPk(conversationID);
    if (!conversation) return res.redirect("/messages");

    const isGroup = conversation.type === "group";

    const participants = await ConversationParticipant.findAll({
      where: { conversationID },
      include: [{ model: User }]
    });
    const others = participants.filter(p => p.userID !== currentUserID);
    const members = participants.map(p => ({ userID: p.userID, username: p.User ? p.User.username : "[deleted]" }));
    const headerName = isGroup
      ? conversation.name
      : (others[0] && others[0].User ? others[0].User.username : "[deleted]");

    const rawMessages = await Message.findAll({
      where: { conversationID },
      include: [{ model: User, as: "Sender", attributes: ["userID", "username"] }],
      order: [["createdAt", "ASC"]],
      limit: 200
    });

    const messages = rawMessages.map(m => ({
      messageID: m.messageID,
      content: m.content,
      createdAtDisplay: m.createdAt.toLocaleString(),
      senderUsername: m.Sender ? m.Sender.username : "[deleted]",
      isMine: m.senderID === currentUserID
    }));

    res.render("messages/thread", {
      title: headerName,
      currentUserID,
      conversationID,
      headerName,
      isGroup,
      members,
      messages,
      returnTo: `/messages/${conversationID}`
    });
  } catch (err) {
    res.status(500).send("Error loading conversation: " + err.message);
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const conversationID = req.params.id;
    if (!(await requireParticipant(conversationID, currentUserID))) return res.redirect("/messages");

    const content = (req.body.content || "").trim();
    if (!content) return res.redirect(`/messages/${conversationID}`);

    const conversation = await Conversation.findByPk(conversationID);
    if (!conversation) return res.redirect("/messages");

    const otherParticipants = await ConversationParticipant.findAll({
      where: { conversationID, userID: { [Op.ne]: currentUserID } }
    });

    // Block re-check for DMs only: an existing DM must not become a bypass
    // after a block happens later. Group-level blocking is out of scope.
    if (conversation.type === "dm" && otherParticipants[0]) {
      if (await isBlockedBetween(currentUserID, otherParticipants[0].userID)) {
        return res.redirect(`/messages/${conversationID}`);
      }
    }

    const message = await Message.create({ conversationID, senderID: currentUserID, content });

    for (const p of otherParticipants) {
      if (p.userID === AI_BOT_USER_ID) continue; // the bot never reads notifications
      await createNotification({
        recipientID: p.userID, actorID: currentUserID,
        type: "message", entityType: "conversation", entityID: conversationID,
        dedupeUnread: true
      });
    }

    const io = req.app.get("io");

    try {
      if (io) {
        const sender = await User.findByPk(currentUserID);
        io.to(`conversation:${conversationID}`).emit("new-message", {
          conversationID,
          messageID: message.messageID,
          senderID: currentUserID,
          senderUsername: sender ? sender.username : "[deleted]",
          content: message.content,
          createdAtDisplay: message.createdAt.toLocaleString()
        });
      }
    } catch (err) {
      console.error("socket emit failed:", err.message); // best-effort, never breaks the POST
    }

    // Not awaited: the redirect below must not wait on a local model
    // generation. The reply arrives later purely through the same socket.io
    // push used above, whenever it's ready.
    if (conversation.type === "dm" && otherParticipants[0] && otherParticipants[0].userID === AI_BOT_USER_ID) {
      generateAIReply(conversationID, io).catch(err => console.error("AI reply failed:", err.message));
    }

    res.redirect(`/messages/${conversationID}`);
  } catch (err) {
    res.status(500).send("Error sending message: " + err.message);
  }
};

exports.leaveGroup = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const conversationID = req.params.id;
    if (!(await requireParticipant(conversationID, currentUserID))) return res.redirect("/messages");

    const conversation = await Conversation.findByPk(conversationID);
    if (!conversation) return res.redirect("/messages");

    // DMs cannot be left -- that would break the dmKey dedup invariant and
    // leave a half-empty DM one side can never reopen.
    if (conversation.type !== "group") return res.redirect(`/messages/${conversationID}`);

    await ConversationParticipant.destroy({ where: { conversationID, userID: currentUserID } });
    res.redirect("/messages");
  } catch (err) {
    res.status(500).send("Error leaving group: " + err.message);
  }
};
