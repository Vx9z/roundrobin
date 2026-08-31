--
-- PostgreSQL database dump
--

\restrict SLuVP3ZPTO6V0pdWmOhCUS37Q60yq4YuhO93szuiKp5ysj4XSFIojFvRRlL1WFo

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bookmarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookmarks (
    userid uuid NOT NULL,
    postid uuid NOT NULL,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.bookmarks OWNER TO postgres;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    postid uuid NOT NULL,
    authorid uuid NOT NULL,
    content text,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: communities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.communities (
    communityid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    bannerurl text,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    createdby uuid
);


ALTER TABLE public.communities OWNER TO postgres;

--
-- Name: communitymembers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.communitymembers (
    communityid uuid NOT NULL,
    userid uuid NOT NULL,
    role character varying(20) DEFAULT 'member'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    joinedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.communitymembers OWNER TO postgres;

--
-- Name: conversationparticipants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversationparticipants (
    conversationid uuid NOT NULL,
    userid uuid NOT NULL,
    joinedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.conversationparticipants OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    conversationid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(10) NOT NULL,
    name character varying(100),
    dmkey text,
    createdby uuid,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    messageid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversationid uuid NOT NULL,
    senderid uuid,
    content text NOT NULL,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

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


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posts (
    postid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    authorid uuid,
    communityid uuid,
    content text,
    mediaurl text,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    codecontent text,
    codelanguage text,
    CONSTRAINT community_optional CHECK (((communityid IS NULL) OR (communityid IS NOT NULL)))
);


ALTER TABLE public.posts OWNER TO postgres;

--
-- Name: reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reactions (
    postid uuid NOT NULL,
    userid uuid NOT NULL,
    type character varying(20) NOT NULL,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.reactions OWNER TO postgres;

--
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    reportid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reporterid uuid NOT NULL,
    entitytype character varying(20) NOT NULL,
    entityid uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- Name: reposts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reposts (
    userid uuid NOT NULL,
    postid uuid NOT NULL,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.reposts OWNER TO postgres;

--
-- Name: userprofile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.userprofile (
    userid uuid NOT NULL,
    bio text,
    avatarurl text,
    themeid integer DEFAULT 0,
    privacylevel character varying(20) DEFAULT 'public'::character varying,
    notificationenabled boolean DEFAULT true,
    bannerurl text,
    isdeleted boolean,
    deletedat timestamp without time zone,
    lastarchive timestamp without time zone,
    backgroundurl text
);


ALTER TABLE public.userprofile OWNER TO postgres;

--
-- Name: userrelationships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.userrelationships (
    followerid uuid NOT NULL,
    followingid uuid NOT NULL,
    type character varying(20) NOT NULL,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.userrelationships OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    userid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(25) NOT NULL,
    email character varying(50),
    passwordhash text NOT NULL,
    clearancelevel integer DEFAULT 0,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (userid, postid);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (postid, authorid, createdat);


--
-- Name: communities communities_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_name_key UNIQUE (name);


--
-- Name: communities communities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_pkey PRIMARY KEY (communityid);


--
-- Name: communitymembers communitymembers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communitymembers
    ADD CONSTRAINT communitymembers_pkey PRIMARY KEY (communityid, userid);


--
-- Name: conversationparticipants conversationparticipants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversationparticipants
    ADD CONSTRAINT conversationparticipants_pkey PRIMARY KEY (conversationid, userid);


--
-- Name: conversations conversations_dmkey_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_dmkey_key UNIQUE (dmkey);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (conversationid);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (messageid);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (notificationid);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (postid);


--
-- Name: reactions reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (postid, userid, type);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (reportid);


--
-- Name: reports reports_reporter_entity_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_entity_key UNIQUE (reporterid, entitytype, entityid);


--
-- Name: reposts reposts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reposts
    ADD CONSTRAINT reposts_pkey PRIMARY KEY (userid, postid);


--
-- Name: userprofile userprofile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.userprofile
    ADD CONSTRAINT userprofile_pkey PRIMARY KEY (userid);


--
-- Name: userrelationships userrelationships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.userrelationships
    ADD CONSTRAINT userrelationships_pkey PRIMARY KEY (followerid, followingid, type);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (userid);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: communitymembers_userid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX communitymembers_userid_idx ON public.communitymembers USING btree (userid);


--
-- Name: conversationparticipants_userid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX conversationparticipants_userid_idx ON public.conversationparticipants USING btree (userid);


--
-- Name: messages_conversation_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX messages_conversation_created_idx ON public.messages USING btree (conversationid, createdat);


--
-- Name: notifications_recipient_unread_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_recipient_unread_idx ON public.notifications USING btree (recipientid, isread);


--
-- Name: posts_communityid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX posts_communityid_idx ON public.posts USING btree (communityid);


--
-- Name: reports_type_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reports_type_status_idx ON public.reports USING btree (entitytype, status);


--
-- Name: bookmarks bookmarks_postid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_postid_fkey FOREIGN KEY (postid) REFERENCES public.posts(postid) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: comments comments_authorid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_authorid_fkey FOREIGN KEY (authorid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: comments comments_postid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_postid_fkey FOREIGN KEY (postid) REFERENCES public.posts(postid) ON DELETE CASCADE;


--
-- Name: communities communities_createdby_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_createdby_fkey FOREIGN KEY (createdby) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: communitymembers communitymembers_communityid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communitymembers
    ADD CONSTRAINT communitymembers_communityid_fkey FOREIGN KEY (communityid) REFERENCES public.communities(communityid) ON DELETE CASCADE;


--
-- Name: communitymembers communitymembers_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communitymembers
    ADD CONSTRAINT communitymembers_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: conversationparticipants conversationparticipants_conversationid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversationparticipants
    ADD CONSTRAINT conversationparticipants_conversationid_fkey FOREIGN KEY (conversationid) REFERENCES public.conversations(conversationid) ON DELETE CASCADE;


--
-- Name: conversationparticipants conversationparticipants_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversationparticipants
    ADD CONSTRAINT conversationparticipants_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: conversations conversations_createdby_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_createdby_fkey FOREIGN KEY (createdby) REFERENCES public.users(userid) ON DELETE SET NULL;


--
-- Name: messages messages_conversationid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversationid_fkey FOREIGN KEY (conversationid) REFERENCES public.conversations(conversationid) ON DELETE CASCADE;


--
-- Name: messages messages_senderid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_senderid_fkey FOREIGN KEY (senderid) REFERENCES public.users(userid) ON DELETE SET NULL;


--
-- Name: notifications notifications_actorid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actorid_fkey FOREIGN KEY (actorid) REFERENCES public.users(userid) ON DELETE SET NULL;


--
-- Name: notifications notifications_recipientid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipientid_fkey FOREIGN KEY (recipientid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: posts posts_authorid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_authorid_fkey FOREIGN KEY (authorid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: posts posts_communityid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_communityid_fkey FOREIGN KEY (communityid) REFERENCES public.communities(communityid) ON DELETE CASCADE;


--
-- Name: reactions reactions_postid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_postid_fkey FOREIGN KEY (postid) REFERENCES public.posts(postid) ON DELETE CASCADE;


--
-- Name: reactions reactions_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: reports reports_reporterid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporterid_fkey FOREIGN KEY (reporterid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: reposts reposts_postid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reposts
    ADD CONSTRAINT reposts_postid_fkey FOREIGN KEY (postid) REFERENCES public.posts(postid) ON DELETE CASCADE;


--
-- Name: reposts reposts_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reposts
    ADD CONSTRAINT reposts_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: userprofile userprofile_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.userprofile
    ADD CONSTRAINT userprofile_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: userrelationships userrelationships_followerid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.userrelationships
    ADD CONSTRAINT userrelationships_followerid_fkey FOREIGN KEY (followerid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- Name: userrelationships userrelationships_followingid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.userrelationships
    ADD CONSTRAINT userrelationships_followingid_fkey FOREIGN KEY (followingid) REFERENCES public.users(userid) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict SLuVP3ZPTO6V0pdWmOhCUS37Q60yq4YuhO93szuiKp5ysj4XSFIojFvRRlL1WFo

