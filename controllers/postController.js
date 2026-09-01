const { Op } = require("sequelize");
const hljs = require("highlight.js/lib/core");
const Post = require("../models/post");
const User = require("../models/user");
const Comment = require("../models/comment");
const Reaction = require("../models/reaction");
const Bookmark = require("../models/bookmark");
const Repost = require("../models/repost");
const UserRelationship = require("../models/userRelationships");
const CommunityMember = require("../models/communityMember");
const { getCurrentUserID, requireAuthOrXhr } = require("../middleware/auth");
const { hasReported } = require("./reportController");
const { CODE_LANGUAGES, isValidLanguage } = require("../config/codeLanguages");
const { getEmbedding } = require("../config/ollama");

// Only the languages actually offered in the compose dropdown get registered --
// avoids pulling in all ~190 grammars the full "highlight.js" package ships.
hljs.registerLanguage("javascript", require("highlight.js/lib/languages/javascript"));
hljs.registerLanguage("typescript", require("highlight.js/lib/languages/typescript"));
hljs.registerLanguage("python", require("highlight.js/lib/languages/python"));
hljs.registerLanguage("java", require("highlight.js/lib/languages/java"));
hljs.registerLanguage("c", require("highlight.js/lib/languages/c"));
hljs.registerLanguage("cpp", require("highlight.js/lib/languages/cpp"));
hljs.registerLanguage("csharp", require("highlight.js/lib/languages/csharp"));
hljs.registerLanguage("go", require("highlight.js/lib/languages/go"));
hljs.registerLanguage("sql", require("highlight.js/lib/languages/sql"));
hljs.registerLanguage("bash", require("highlight.js/lib/languages/bash"));
hljs.registerLanguage("json", require("highlight.js/lib/languages/json"));
hljs.registerLanguage("html", require("highlight.js/lib/languages/xml")); // xml.js covers html
hljs.registerLanguage("css", require("highlight.js/lib/languages/css"));

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Re-validates at READ time, not just write time (config/codeLanguages.js's
// list could theoretically change after a post was written). ignoreIllegals
// because we're force-highlighting arbitrary user text against a possibly-
// mismatched language choice -- hljs throws by default on grammar mismatches,
// which would otherwise take down an entire list page since hydratePost runs
// inside Promise.all for every post in it. try/catch is defense in depth
// beyond that: a bad snippet must never break the page, worst case it just
// renders unhighlighted.
function highlightCode(code, language) {
  if (!code) return null;
  const lang = isValidLanguage(language) ? language : "plaintext";
  if (lang === "plaintext") return escapeHtml(code);
  try {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  } catch (err) {
    return escapeHtml(code);
  }
}

async function hydratePost(post, currentUserID) {
  const author = await User.findByPk(post.authorID);

  const commentCount = await Comment.count({ where: { postID: post.postID } });
  const likeCount = await Reaction.count({ where: { postID: post.postID, type: "like" } });
  const isLiked = !!(await Reaction.findOne({ where: { postID: post.postID, userID: currentUserID, type: "like" } }));
  const isBookmarked = !!(await Bookmark.findOne({ where: { postID: post.postID, userID: currentUserID } }));
  const isReposted = !!(await Repost.findOne({ where: { postID: post.postID, userID: currentUserID } }));
  const isReportedByMe = await hasReported(currentUserID, "post", post.postID);

  return {
    postID: post.postID,
    content: post.content,
    mediaURL: post.mediaURL,
    codeContent: post.codeContent,
    codeLanguage: post.codeLanguage,
    codeHTML: highlightCode(post.codeContent, post.codeLanguage),
    codeLanguageLabel: (CODE_LANGUAGES.find(l => l.id === post.codeLanguage) || {}).label,
    createdAtDisplay: post.createdAt.toLocaleString(),
    authorID: post.authorID,
    authorUsername: author ? author.username : "[deleted]",
    isOwnPost: post.authorID === currentUserID,
    likeCount,
    isLiked,
    isBookmarked,
    isReposted,
    isReportedByMe,
    commentCount
  };
}
exports.hydratePost = hydratePost;

// Full comment thread with author names, used only by the single-post detail
// page -- hydratePost above only needs a count for list views. Same field
// shapes hydratePost used to return under `comments`, unchanged.
exports.getPostComments = async (postID, currentUserID) => {
  const comments = await Comment.findAll({ where: { postID }, order: [["createdAt", "ASC"]] });
  const authorIDs = [...new Set(comments.map(c => c.authorID))];
  const authors = authorIDs.length ? await User.findAll({ where: { userID: authorIDs } }) : [];
  const usernameByID = Object.fromEntries(authors.map(u => [u.userID, u.username]));

  return comments.map(c => ({
    authorID: c.authorID,
    authorUsername: usernameByID[c.authorID] || "[deleted]",
    content: c.content,
    createdAtDisplay: c.createdAt.toLocaleString(),
    createdAtISO: c.createdAt.toISOString(),
    isOwnComment: c.authorID === currentUserID
  }));
};

// Own posts + posts from users this account follows + posts from communities
// this account is an active member of, newest first. No ranking/algorithm.
exports.getFeedPosts = async (currentUserID) => {
  const followedRels = await UserRelationship.findAll({
    where: { followerID: currentUserID, type: "follow" },
    attributes: ["followingID"]
  });
  const authorIDs = [...followedRels.map(r => r.followingID), currentUserID];

  const memberships = await CommunityMember.findAll({
    where: { userID: currentUserID, status: "active" },
    attributes: ["communityID"]
  });
  const communityIDs = memberships.map(m => m.communityID);

  const posts = await Post.findAll({
    where: { [Op.or]: [{ authorID: authorIDs }, { communityID: communityIDs }] },
    order: [["createdAt", "DESC"]]
  });

  return Promise.all(posts.map(p => hydratePost(p, currentUserID)));
};

// A profile's own posts merged with posts they reposted, sorted by the relevant timestamp.
exports.getProfilePosts = async (profileUserID, currentUserID) => {
  const ownPosts = await Post.findAll({ where: { authorID: profileUserID } });
  const reposts = await Repost.findAll({
    where: { userID: profileUserID },
    include: [{ model: Post }]
  });
  const reposter = await User.findByPk(profileUserID);

  const ownEntries = await Promise.all(ownPosts.map(async p => ({
    ...(await hydratePost(p, currentUserID)),
    sortDate: p.createdAt
  })));

  const repostEntries = await Promise.all(reposts.map(async r => ({
    ...(await hydratePost(r.Post, currentUserID)),
    repostedByUsername: reposter ? reposter.username : null,
    sortDate: r.createdAt
  })));

  return [...ownEntries, ...repostEntries].sort((a, b) => b.sortDate - a.sortDate);
};

exports.getBookmarkedPosts = async (currentUserID) => {
  const bookmarks = await Bookmark.findAll({
    where: { userID: currentUserID },
    include: [{ model: Post }],
    order: [["createdAt", "DESC"]]
  });
  return Promise.all(bookmarks.map(b => hydratePost(b.Post, currentUserID)));
};

exports.showFeed = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const posts = await exports.getFeedPosts(currentUserID);
    const trending = await exports.getTrendingHashtags();
    res.render("feed", { title: "Home Feed", currentUserID, returnTo: "/feed", posts, trending, codeLanguages: CODE_LANGUAGES });
  } catch (err) {
    res.status(500).send("Error loading feed: " + err.message);
  }
};

exports.showPostDetail = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const post = await Post.findByPk(req.params.id);
    // returnTo comes from a query string here (unlike every other returnTo in
    // this app, which is always server-generated) -- only accept a same-origin
    // relative path, closing an open-redirect angle a crafted link could
    // otherwise use to make the Back button point off-site.
    const rt = req.query.returnTo;
    const returnTo = (rt && rt.startsWith("/") && !rt.startsWith("//")) ? rt : "/feed";
    if (!post) return res.redirect(returnTo);

    const hydrated = await hydratePost(post, currentUserID);
    const comments = await exports.getPostComments(post.postID, currentUserID);

    res.render("postDetail", {
      title: "Post",
      currentUserID,
      post: hydrated,
      comments,
      returnTo
    });
  } catch (err) {
    res.status(500).send("Error loading post: " + err.message);
  }
};

exports.createPost = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const { content, communityID, codeContent, codeLanguage } = req.body;
    const mediaURL = req.file ? "/uploads/" + req.file.filename : null;
    const returnTo = communityID ? `/communities/${communityID}` : "/feed";

    const trimmedCode = codeContent && codeContent.trim() ? codeContent : null;
    const finalCodeLanguage = trimmedCode ? (isValidLanguage(codeLanguage) ? codeLanguage : "plaintext") : null;

    if (!content && !mediaURL && !trimmedCode) return res.redirect(returnTo);

    // Posting into a community requires an active (non-banned) membership.
    if (communityID) {
      const membership = await CommunityMember.findOne({
        where: { communityID, userID: currentUserID, status: "active" }
      });
      if (!membership) return res.redirect(returnTo);
    }

    const newPost = await Post.create({
      authorID: currentUserID, content, mediaURL,
      codeContent: trimmedCode, codeLanguage: finalCodeLanguage,
      communityID: communityID || null
    });

    // Fire-and-forget, same "the redirect must not wait on a local model
    // call" precedent as the AI chat reply -- embeds the post for RAG
    // retrieval without holding up the response.
    if (content && content.trim()) {
      getEmbedding(content)
        .then(embedding => newPost.update({ embedding }))
        .catch(err => console.error("Post embedding failed:", err.message));
    }

    res.redirect(returnTo);
  } catch (err) {
    res.status(500).send("Error creating post: " + err.message);
  }
};

exports.deletePost = async (req, res) => {
  try {
    const currentUserID = requireAuthOrXhr(req, res);
    if (!currentUserID) return;

    await Post.destroy({ where: { postID: req.params.id, authorID: currentUserID } });
    if (req.xhr) return res.json({ success: true });
    res.redirect(req.body.returnTo || "/feed");
  } catch (err) {
    res.status(500).send("Error deleting post: " + err.message);
  }
};

// Posts from users you don't already follow and haven't blocked (either
// direction), from the last few days, ranked by likes + comments computed
// fresh -- no stored score, no new tables.
exports.getSuggestedPosts = async (currentUserID) => {
  const followed = await UserRelationship.findAll({ where: { followerID: currentUserID, type: "follow" }, attributes: ["followingID"] });
  const blocksOut = await UserRelationship.findAll({ where: { followerID: currentUserID, type: "block" }, attributes: ["followingID"] });
  const blocksIn = await UserRelationship.findAll({ where: { followingID: currentUserID, type: "block" }, attributes: ["followerID"] });

  const excludedIDs = [
    currentUserID,
    ...followed.map(r => r.followingID),
    ...blocksOut.map(r => r.followingID),
    ...blocksIn.map(r => r.followerID)
  ];

  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // last 3 days

  const candidates = await Post.findAll({
    where: { authorID: { [Op.notIn]: excludedIDs }, createdAt: { [Op.gte]: since } },
    order: [["createdAt", "DESC"]],
    limit: 50
  });

  const scored = await Promise.all(candidates.map(async p => ({
    post: p,
    score: (await Reaction.count({ where: { postID: p.postID, type: "like" } }))
         + (await Comment.count({ where: { postID: p.postID } }))
  })));

  scored.sort((a, b) => b.score - a.score);
  return Promise.all(scored.slice(0, 15).map(s => hydratePost(s.post, currentUserID)));
};

exports.showSuggested = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const posts = await exports.getSuggestedPosts(currentUserID);
    res.render("suggested", { title: "Suggested Posts", currentUserID, returnTo: "/suggested", posts });
  } catch (err) {
    res.status(500).send("Error loading suggested posts: " + err.message);
  }
};

// Lowercased so #JS and #js are one tag; de-duplicated per post so a post
// that says "#js #js #js" counts once -- trending measures how many POSTS
// use a tag, not how many times it was typed.
function extractHashtags(content) {
  if (!content) return [];
  const matches = content.match(/#(\w+)/g) || [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}
exports.extractHashtags = extractHashtags;

exports.getTrendingHashtags = async (limit = 10) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

  const posts = await Post.findAll({
    where: { createdAt: { [Op.gte]: since }, content: { [Op.ne]: null } },
    attributes: ["postID", "content"]
  });

  const counts = {};
  for (const p of posts) {
    for (const tag of extractHashtags(p.content)) counts[tag] = (counts[tag] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) // alphabetical tiebreak, stable order
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count, postLabel: count === 1 ? "1 post" : `${count} posts` }));
};

// Every post using this tag, all time. The ILIKE is a cheap SQL pre-filter
// ONLY -- it's allowed to return too many rows, never too few. Correctness
// comes from re-running extractHashtags on each candidate and checking
// membership, which is what stops "#java" wrongly matching a post that only
// contains "#javascript" (a plain ILIKE substring match would not).
exports.getPostsByHashtag = async (tag, currentUserID) => {
  const normalized = tag.toLowerCase();

  const candidates = await Post.findAll({
    where: { content: { [Op.iLike]: `%#${normalized}%` } },
    order: [["createdAt", "DESC"]],
    limit: 100
  });

  const matches = candidates.filter(p => extractHashtags(p.content).includes(normalized));
  return Promise.all(matches.map(p => hydratePost(p, currentUserID)));
};

exports.showHashtag = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const raw = req.params.tag || "";
    // Not producible by our own tokenizer -> reject before it reaches SQL.
    if (!/^\w+$/.test(raw)) return res.redirect("/feed");
    const tag = raw.toLowerCase();

    const posts = await exports.getPostsByHashtag(tag, currentUserID);
    const trending = await exports.getTrendingHashtags();

    res.render("hashtags/show", {
      title: `#${tag}`,
      currentUserID,
      tag,
      returnTo: `/hashtags/${tag}`,
      posts,
      trending
    });
  } catch (err) {
    res.status(500).send("Error loading hashtag: " + err.message);
  }
};

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Rudimentary RAG retrieval for the AI assistant: embed the query, score
// every embedded candidate post in plain JS (no pgvector on this DB -- see
// db/add-post-embeddings.sql), return the top matches. Excludes posts from
// either-direction-blocked users -- same lookup getSuggestedPosts already
// does above, reused rather than duplicated, so someone's private AI chat
// can't surface content from/to a user they've blocked or been blocked by.
exports.getRelevantPosts = async (queryText, currentUserID, limit = 4) => {
  const blocksOut = await UserRelationship.findAll({ where: { followerID: currentUserID, type: "block" }, attributes: ["followingID"] });
  const blocksIn = await UserRelationship.findAll({ where: { followingID: currentUserID, type: "block" }, attributes: ["followerID"] });
  const excludedIDs = [...blocksOut.map(r => r.followingID), ...blocksIn.map(r => r.followerID)];

  const queryEmbedding = await getEmbedding(queryText);

  const candidates = await Post.findAll({
    where: {
      authorID: excludedIDs.length ? { [Op.notIn]: excludedIDs } : { [Op.ne]: null },
      embedding: { [Op.ne]: null }
    },
    attributes: ["postID", "authorID", "content", "embedding"]
  });

  const scored = candidates.map(p => ({ post: p, score: cosineSimilarity(queryEmbedding, p.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.post);
};
