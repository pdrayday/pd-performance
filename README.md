# pd / performance

Personal training app — 6-day split (Hyrox-style legs Monday, push/pull), AI-generated custom splits and diet plans, progress tracking, group feed, and trainer tools.

## Features

- **Profile** — athlete stats, BMI + AI body-comp check from front/back/side photos, weigh-in tracking, membership plans with Venmo/Stripe payment
- **AI platform picker** — choose your preferred AI (ChatGPT default, plus Google, Gemini, Claude, Perplexity, Grok); its logo becomes the AI button throughout the app
- **Train** — weekly split with coach video demos and an AI split builder
- **Fuel** — AI diet plan builder with likes/dislikes/allergy filtering
- **Track** — daily commitments with streaks and reminders
- **Groups** — community feed with posts, photos, and likes
- **Dark/light theme** — light mode is an exact inversion of dark
- **Trainer mode** — PIN-protected settings for payments, calendar, and video uploads

## Live site

https://pdrayday.github.io/pd-performance/ — runs entirely in the browser with a built-in coaching engine (no external AI required); when hosted in an environment that provides Claude API access, AI features automatically upgrade.

## Stack

Single-file React component (`pd-performance.jsx`), lucide-react icons, Claude API for AI features.
