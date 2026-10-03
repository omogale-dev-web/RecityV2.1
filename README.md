# RECITY Waste Intelligence OS

New Vercel-ready foundation for RECITY v2.1. It contains the citizen-side product shell, RECITY ID onboarding, report lifecycle, offline queue boundary, and serverless API contracts. Add Supabase and Groq credentials only as Vercel environment variables.

## Environment variables

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`

`SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` must only be used by `/api/*` server routes.

## Deployment

Import this folder into a new Vercel project. Deploy as a static site with Vercel Functions. The client UI works with local demo data until the Supabase integration phase.
