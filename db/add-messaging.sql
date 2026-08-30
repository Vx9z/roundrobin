-- =====================================================================
-- roundrobin: private messaging (1:1 DMs + group chat).
-- Run with the app server stopped, BEFORE deploying the new models.
-- sequelize.sync() will then see these tables already exist and skip them.
--   psql -U postgres -h localhost -d roundrobin -f db/add-messaging.sql
-- =====================================================================

BEGIN;

-- One table for both kinds of thread.
--   type 'dm'    -> exactly 2 participants, name NULL, dmkey set
--   type 'group' -> 2+ participants, name required, dmkey NULL
-- dmkey is the two participant uuids lowercased, sorted, joined with ':'.
-- It exists solely so "do these two already have a DM?" is one indexed
-- lookup, and so the UNIQUE constraint makes duplicate DMs impossible
-- even under a race.
CREATE TABLE public.conversations (
    conversationid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(10) NOT NULL,
    name character varying(100),
    dmkey text,
    createdby uuid,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (conversationid);

-- Postgres allows unlimited NULLs in a UNIQUE column, so every group row
-- (dmkey NULL) coexists fine while DM pairs stay unique.
ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_dmkey_key UNIQUE (dmkey);

-- createdby SET NULL (not CASCADE): deleting the person who created a group
-- must not delete the group out from under everyone else in it.
ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_createdby_fkey FOREIGN KEY (createdby)
    REFERENCES public.users(userid) ON DELETE SET NULL;

-- Who is in which thread. Composite PK, no surrogate id, like communitymembers.
CREATE TABLE public.conversationparticipants (
    conversationid uuid NOT NULL,
    userid uuid NOT NULL,
    joinedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY public.conversationparticipants
    ADD CONSTRAINT conversationparticipants_pkey PRIMARY KEY (conversationid, userid);

ALTER TABLE ONLY public.conversationparticipants
    ADD CONSTRAINT conversationparticipants_conversationid_fkey FOREIGN KEY (conversationid)
    REFERENCES public.conversations(conversationid) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversationparticipants
    ADD CONSTRAINT conversationparticipants_userid_fkey FOREIGN KEY (userid)
    REFERENCES public.users(userid) ON DELETE CASCADE;

CREATE TABLE public.messages (
    messageid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversationid uuid NOT NULL,
    senderid uuid,
    content text NOT NULL,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (messageid);

-- CASCADE: deleting a thread deletes its messages, there is nothing left to show.
ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversationid_fkey FOREIGN KEY (conversationid)
    REFERENCES public.conversations(conversationid) ON DELETE CASCADE;

-- senderid SET NULL (not CASCADE): deleting a user must not punch holes in
-- everyone else's conversation history. The thread renders "[deleted]" as
-- the sender, exactly like hydratePost does for orphaned posts.
ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_senderid_fkey FOREIGN KEY (senderid)
    REFERENCES public.users(userid) ON DELETE SET NULL;

-- The thread view reads one conversation's messages in time order, every load.
CREATE INDEX messages_conversation_created_idx
    ON public.messages (conversationid, createdat);

-- The inbox asks "which conversations am I in", which filters on userid alone
-- and cannot use the (conversationid, userid) primary key index.
CREATE INDEX conversationparticipants_userid_idx
    ON public.conversationparticipants (userid);

COMMIT;
