const { Op } = require("sequelize");
const Conversation = require("../models/conversation");
const ConversationParticipant = require("../models/conversationParticipant");
const Message = require("../models/message");
const User = require("../models/user");
const { getCurrentUserID } = require("../middleware/auth");
const { isBlockedBetween } = require("../middleware/permissions");
const { getFriends, areMutualFollows } = require("./userController");
const { createNotification } = require("./notificationController");

function dmKeyFor(userA, userB) {
  return [String(userA).toLowerCase(), String(userB).toLowerCase()].sort().join(":");
}

async function requireParticipant(conversationID, userID) {
  const participant = await ConversationParticipant.findOne({ where: { conversationID, userID } });
  return !!participant;
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
      await createNotification({
        recipientID: p.userID, actorID: currentUserID,
        type: "message", entityType: "conversation", entityID: conversationID,
        dedupeUnread: true
      });
    }

    try {
      const io = req.app.get("io");
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
