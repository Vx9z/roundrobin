// Debounced live search: as-you-type results from /search?q=..., fetched
// with the same X-Requested-With signal post-actions.js uses so the server
// can tell an AJAX call from a real page load. The input still sits inside
// a real <form method="get">, so pressing Enter (or JS failing to load)
// falls back to a normal full-page search -- this only makes that faster.
(function () {
  var input = document.getElementById("searchInput");
  var results = document.getElementById("searchResults");
  if (!input || !results) return;

  var timer = null;
  var DEBOUNCE_MS = 250;

  input.addEventListener("input", function () {
    clearTimeout(timer);
    var q = input.value.trim();
    timer = setTimeout(function () { runSearch(q); }, DEBOUNCE_MS);
  });

  function runSearch(q) {
    fetch("/search?q=" + encodeURIComponent(q), {
      headers: { "X-Requested-With": "XMLHttpRequest" }
    })
      .then(function (response) { return response.ok ? response.json() : { users: [] }; })
      .then(function (data) { renderResults(data.users || [], q); })
      .catch(function () { /* live search failed silently -- Enter still works */ });
  }

  function renderResults(users, q) {
    results.textContent = ""; // clear previous results

    if (!users.length) {
      var empty = document.createElement("li");
      empty.className = "text-center opacity-60";
      empty.textContent = q ? "No users found." : "Type a username to search.";
      results.appendChild(empty);
      return;
    }

    users.forEach(function (u) {
      var li = document.createElement("li");

      var a = document.createElement("a");
      a.href = "/profile/" + u.userID;
      a.className = "flex items-center gap-2 no-underline hover:opacity-80";

      var img = document.createElement("img");
      img.src = u.avatarURL;
      img.alt = "";
      img.className = "h-9 w-9 rounded-full object-cover";

      var name = document.createElement("span");
      name.className = "font-semibold";
      name.textContent = u.username; // textContent, never innerHTML -- username is user-controlled

      a.appendChild(img);
      a.appendChild(name);
      li.appendChild(a);
      results.appendChild(li);
    });
  }
})();
