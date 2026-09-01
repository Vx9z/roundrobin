// Intercepts the post-card action forms (like/bookmark/repost/delete/report,
// comment add/delete) so they submit via fetch instead of a full-page
// redirect -- otherwise every click reloads the page and throws you back to
// the top of a scrolled feed. Every form keeps its real action/method/
// returnTo input, so with JS off this degrades to exactly the old (working,
// just scroll-jumpy) behaviour.
(function () {
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form.matches("[data-action]")) return;
    e.preventDefault();

    var action = form.dataset.action;

    if (action === "create-comment") {
      var contentField = form.elements.content;
      if (!contentField.value.trim()) return; // don't round-trip on whitespace-only input
    }

    var params = new URLSearchParams();
    Array.prototype.forEach.call(form.elements, function (el) {
      if (el.name) params.append(el.name, el.value);
    });

    var btn = form.querySelector("button");
    if (btn) btn.disabled = true; // guards against a double-click firing two requests in flight

    var succeeded = false;
    fetch(form.action, {
      method: form.method || "post",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    }).then(function (response) {
      if (!response.ok) {
        // Covers auth-expired (401) too: a real resubmit hits the same
        // server guard non-XHR and gets a proper redirect to /login.
        form.submit();
        return null;
      }
      succeeded = true;
      return response.json();
    }).then(function (data) {
      if (data) applyAction(action, form, data);
    }).catch(function () {
      // Only fall back if we never got a response -- these actions are not
      // idempotent, so resubmitting after a confirmed 2xx would double-apply
      // (e.g. silently toggle a like back off).
      if (!succeeded) form.submit();
    }).finally(function () {
      if (btn) btn.disabled = false;
    });
  });

  function applyAction(action, form, data) {
    switch (action) {
      case "like":
        setToggleButton(form, data.isLiked, (data.isLiked ? "♥" : "♡") + " " + data.likeCount);
        break;

      case "bookmark":
        setToggleButton(form, data.isBookmarked, data.isBookmarked ? "★ Bookmarked" : "☆ Bookmark");
        if (!data.isBookmarked && window.location.pathname === "/bookmarks") {
          removeCard(form);
        }
        break;

      case "repost": {
        setToggleButton(form, data.isReposted, data.isReposted ? "↻ Reposted" : "↻ Repost");
        var card = form.closest(".post-card");
        // .repost-tag ("Reposted by X") only ever appears on a profile's
        // repost entries -- its presence means this card exists BECAUSE of
        // the repost, so un-reposting should remove it here regardless of
        // which page we're on.
        if (!data.isReposted && card && card.querySelector(".repost-tag")) {
          card.remove();
        }
        break;
      }

      case "delete-post":
        removeCard(form);
        break;

      case "report-post": {
        var reportBtn = form.querySelector("button");
        reportBtn.type = "button";
        reportBtn.disabled = true;
        reportBtn.textContent = "⚑ Reported";
        reportBtn.classList.remove("d-btn-warning", "d-btn-outline");
        reportBtn.classList.add("d-btn-ghost");
        break;
      }

      case "delete-comment":
        if (data.success) form.closest(".comment").remove();
        break;

      case "create-comment":
        insertNewComment(form, data);
        form.reset();
        break;
    }
  }

  function setToggleButton(form, active, label) {
    var btn = form.querySelector("button");
    btn.classList.toggle("d-btn-secondary", active);
    btn.classList.toggle("d-btn-ghost", !active);
    btn.textContent = label;
  }

  function removeCard(form) {
    // community/dashboard.hbs wraps each post in an extra .mod-post-row that
    // carries its own sibling "Remove as moderator" form OUTSIDE the
    // partial -- removing only the inner .post-card there would leave that
    // button orphaned, pointing at a post that no longer exists.
    var wrapper = form.closest(".mod-post-row") || form.closest(".post-card");
    if (wrapper) wrapper.remove();
  }

  function insertNewComment(form, data) {
    var wrap = document.createElement("div");
    wrap.className = "comment mb-1.5 flex items-start gap-1 text-sm";

    var p = document.createElement("p");
    p.className = "flex-1 whitespace-pre-wrap break-words";
    var authorLink = document.createElement("a");
    authorLink.href = "/profile/" + data.authorID;
    authorLink.className = "font-semibold hover:underline";
    authorLink.textContent = data.authorUsername; // textContent, never innerHTML --
    p.appendChild(authorLink);                    // authorUsername and content are both
    p.appendChild(document.createTextNode(": " + data.content)); // user-controlled text.
    wrap.appendChild(p);

    var delForm = document.createElement("form");
    delForm.action = "/posts/" + form.dataset.postId + "/comments/delete";
    delForm.method = "post";
    delForm.className = "inline-form";
    delForm.dataset.action = "delete-comment";

    var createdAtInput = document.createElement("input");
    createdAtInput.type = "hidden";
    createdAtInput.name = "createdAt";
    createdAtInput.value = data.createdAtISO;
    var returnToInput = document.createElement("input");
    returnToInput.type = "hidden";
    returnToInput.name = "returnTo";
    returnToInput.value = form.elements.returnTo.value;
    var delBtn = document.createElement("button");
    delBtn.type = "submit";
    delBtn.className = "d-btn d-btn-xs d-btn-ghost";
    delBtn.textContent = "×";

    delForm.appendChild(createdAtInput);
    delForm.appendChild(returnToInput);
    delForm.appendChild(delBtn);
    wrap.appendChild(delForm);

    form.parentNode.insertBefore(wrap, form);
  }
})();
