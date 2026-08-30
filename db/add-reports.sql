-- =====================================================================
-- roundrobin: user-submitted reports (posts, users, communities).
-- Run with the app server stopped, BEFORE deploying the new model.
-- sequelize.sync() will then see this table already exists and skip it.
--   psql -U postgres -h localhost -d roundrobin -f db/add-reports.sql
-- =====================================================================

BEGIN;

-- One generic table for every reportable kind, same shape as notifications:
-- entitytype/entityid are polymorphic ('post' | 'user' | 'community'), no FK.
--   status 'pending'   = still needs a moderator's attention
--   status 'dismissed' = reviewed; kept for history, filtered out of dashboards
CREATE TABLE public.reports (
    reportid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reporterid uuid NOT NULL,
    entitytype character varying(20) NOT NULL,
    entityid uuid NOT NULL,
    status character varying(20) DEFAULT 'pending' NOT NULL,
    createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (reportid);

-- CASCADE: a report only means "one distinct account complained about this",
-- so a report with no reporter is not evidence of anything and must not keep
-- inflating a count. Same reasoning as bookmarks/communitymembers cascading.
ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporterid_fkey FOREIGN KEY (reporterid)
    REFERENCES public.users(userid) ON DELETE CASCADE;

-- One report per reporter per entity, forever. Deliberately NOT scoped to
-- status: once a moderator dismisses a complaint, the same account
-- re-clicking Report must not resurrect it as a fresh pending row. This
-- constraint is also what makes "count the pending rows for an entity" a
-- count of distinct complainants rather than a count of clicks.
-- Its backing btree also serves the per-viewer "have I already reported
-- this?" lookup the post partial / profile / board do on every render,
-- so no second index is needed for that.
ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_entity_key
    UNIQUE (reporterid, entitytype, entityid);

-- Both dashboards read "every pending report of this kind" on load.
CREATE INDEX reports_type_status_idx ON public.reports (entitytype, status);

COMMIT;
