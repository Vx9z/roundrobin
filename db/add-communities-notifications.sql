-- =====================================================================
-- roundrobin: communities membership + notifications.
-- Run with the app server stopped, BEFORE deploying the new models.
-- sequelize.sync() will then see these tables already exist and skip them.
--   psql -U postgres -h localhost -d roundrobin -f db/add-communities-notifications.sql
-- =====================================================================

BEGIN;

-- Who is in which community, and in what capacity.
-- No row      = not a member
-- 'active'    = normal member ('member') or community moderator ('moderator')
-- 'banned'    = removed and blocked from rejoining (row is kept so join can refuse)
CREATE TABLE public.communitymembers (
    communityid uuid NOT NULL,
    userid uuid NOT NULL,
    role character varying(20) DEFAULT 'member' NOT NULL,
    status character varying(20) DEFAULT 'active' NOT NULL,
    joinedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY public.communitymembers
    ADD CONSTRAINT communitymembers_pkey PRIMARY KEY (communityid, userid);

ALTER TABLE ONLY public.communitymembers
    ADD CONSTRAINT communitymembers_communityid_fkey FOREIGN KEY (communityid)
    REFERENCES public.communities(communityid) ON DELETE CASCADE;

ALTER TABLE ONLY public.communitymembers
    ADD CONSTRAINT communitymembers_userid_fkey FOREIGN KEY (userid)
    REFERENCES public.users(userid) ON DELETE CASCADE;

-- One generic notifications table for every notification kind.
-- entitytype/entityid are polymorphic (post | user | community) and have NO
-- foreign key on purpose, because they point at different tables.
CREATE TABLE public.notifications (
    notificationid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    recipientid uuid NOT NULL,
    actorid uuid,
    type character varying(30) NOT NULL,
    entitytype character varying(20),
    entityid uuid,
    isread boolean DEFAULT false NOT NULL,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (notificationid);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipientid_fkey FOREIGN KEY (recipientid)
    REFERENCES public.users(userid) ON DELETE CASCADE;

-- actorid SET NULL (not CASCADE): if the actor is deleted we keep the
-- notification and show "Someone" instead of destroying the recipient's history.
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actorid_fkey FOREIGN KEY (actorid)
    REFERENCES public.users(userid) ON DELETE SET NULL;

-- The navbar counts unread notifications on EVERY page load.
CREATE INDEX notifications_recipient_unread_idx
    ON public.notifications (recipientid, isread);

-- The home feed and the community board both filter posts by community.
CREATE INDEX posts_communityid_idx ON public.posts (communityid);

-- "which communities am I in" filters on userid alone, which the
-- (communityid, userid) primary key index cannot serve.
CREATE INDEX communitymembers_userid_idx ON public.communitymembers (userid);

COMMIT;
