-- =====================================================================
-- roundrobin: one-time DB fix for the Sequelize shadow-table bug.
--
-- sequelize.sync() previously created quoted, mixed-case duplicate
-- tables ("Users", "userProfile", "userRelationships") alongside the
-- real, FK-constrained lowercase tables from schema.sql, because the
-- models didn't match quoteIdentifiers:false. This migrates the real
-- data out of the shadow tables and drops them. Run this BEFORE
-- deploying the config/database.js and models/userRelationships.js
-- fixes, with the app server stopped.
--
--   psql -U postgres -h localhost -d roundrobin -f db/fix-shadow-tables.sql
--
-- Also bundles an unrelated pre-existing bug fix: reposts.postid's
-- foreign key pointed at users(userid) instead of posts(postid).
-- =====================================================================

BEGIN;

INSERT INTO users (userid, username, email, passwordhash, clearancelevel, createdat, updatedat)
SELECT "userID", username, email, "passwordHash", "clearanceLevel", "createdAt", "updatedAt"
FROM "Users"
ON CONFLICT (userid) DO NOTHING;

INSERT INTO userprofile (userid, bio, avatarurl, themeid, privacylevel, notificationenabled, bannerurl)
SELECT "userID", bio, "avatarURL", "themeID", "privacyLevel", "notificationEnabled", "bannerURL"
FROM "userProfile"
ON CONFLICT (userid) DO NOTHING;

INSERT INTO userrelationships (followerid, followingid, type, createdat)
SELECT "followerID", "followingID", type, "createdAt"
FROM "userRelationships"
ON CONFLICT (followerid, followingid, type) DO NOTHING;

DROP TABLE IF EXISTS "userProfile";
DROP TABLE IF EXISTS "userRelationships";
DROP TABLE IF EXISTS "Users";

-- unrelated pre-existing bug: reposts.postid pointed at users(userid) instead of posts(postid)
ALTER TABLE public.reposts DROP CONSTRAINT reposts_postid_fkey;
ALTER TABLE public.reposts
  ADD CONSTRAINT reposts_postid_fkey
  FOREIGN KEY (postid) REFERENCES public.posts(postid) ON DELETE CASCADE;

COMMIT;
