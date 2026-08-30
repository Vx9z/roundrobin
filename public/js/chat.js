// The only client-side JavaScript in this app. Sending a message is still a
// plain form POST; this script exists purely to append messages that OTHER
// participants send while this thread is open. With JS off, everything still
// works -- you just have to hit Refresh to see new messages.
(function () {
  var list = document.getElementById("message-list");
  if (!list || typeof io !== "function") return; // socket.io bundle missing: degrade silently

  var conversationID = list.dataset.conversationId;
  var currentUserID = list.dataset.currentUserId;

  list.scrollTop = list.scrollHeight; // start at the newest message

  var socket = io(); // same origin; the JWT rides along in the cookie header

  socket.on("connect", function () {
    // The server verifies participation before honouring this.
    socket.emit("join-conversation", conversationID);
  });

  socket.on("new-message", function (msg) {
    if (!msg || msg.conversationID !== conversationID) return;
    // The sender already sees their own message via the POST-redirect-GET cycle.
    if (msg.senderID === currentUserID) return;

    var wrap = document.createElement("div");
    wrap.className = "message message-other";

    var who = document.createElement("span");
    who.className = "message-sender";
    who.textContent = msg.senderUsername;

    var body = document.createElement("p");
    body.className = "message-content";
    body.textContent = msg.content; // textContent, never innerHTML -- this is the
                                    // only place user text is inserted client-side,
                                    // so it is the only place XSS could enter.

    var when = document.createElement("span");
    when.className = "message-date";
    when.textContent = msg.createdAtDisplay;

    wrap.appendChild(who);
    wrap.appendChild(body);
    wrap.appendChild(when);
    list.appendChild(wrap);
    list.scrollTop = list.scrollHeight;
  });
})();
