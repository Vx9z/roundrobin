// One-off: embeds every existing post that predates the RAG feature (run
// once, by hand, after db/add-post-embeddings.sql has been applied).
//   node scripts/backfill-post-embeddings.js
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const Post = require("../models/post");
const { getEmbedding } = require("../config/ollama");

(async () => {
  const candidates = await Post.findAll({ where: { content: { [Op.ne]: null }, embedding: null } });
  // Matches createPost's "only embed if there's real text" guard -- a post
  // submitted with an empty textarea has content: "" (not null), which the
  // SQL filter above alone wouldn't exclude.
  const posts = candidates.filter(p => p.content && p.content.trim());
  console.log(`Backfilling embeddings for ${posts.length} post(s)...`);

  for (const post of posts) {
    try {
      const embedding = await getEmbedding(post.content);
      await post.update({ embedding });
      console.log("  ok:", post.postID);
    } catch (err) {
      console.error("  failed:", post.postID, "--", err.message);
    }
  }

  await sequelize.close();
  console.log("Done.");
})();
