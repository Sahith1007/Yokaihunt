

This file provides guidance when working with code in this repository.

## Commands

- Install deps (npm is the package manager for this repo):
  - npm install
- Dev server (Next.js 15 with Turbopack):
  - npm run dev
  - App serves at http://localhost:3000
- Production build:
  - npm run build
- Start production server (after build):
  - npm start
- Lint (Biome):
  - npm run lint
- Format (Biome):
  - npm run format
- Tests:
  - No test runner is configured in this repo. There are no test scripts in package.json.

## Architecture overview

- Framework: Next.js (App Router) with TypeScript. Turbopack is enabled in dev/build via package.json scripts.
- Styling: Tailwind CSS v4 via PostCSS plugin (@tailwindcss/postcss). Global styles and design tokens are defined in app/globals.css using CSS variables and @theme inline.
- Fonts/Metadata: next/font loads Geist and metadata is set in app/layout.tsx. The layout wraps all routes and applies font CSS variables.
- Routing/UI: app/page.tsx is the home route using Next Image and a simple landing layout.
- Game integration: components/Game.tsx is a client component that embeds a Phaser 3 game.
  - Creates a Phaser.Game in a ref-attached div with Arcade physics, FIT scaling, and auto-centering.
  - Cleans up the Phaser instance on unmount to prevent resource leaks.
  - Expects a scene exported as GameScene from lib/phaser/GameScene (this module is currently not present in the repo; create it or adjust the import to avoid runtime errors).
- Assets: public/ contains static SVGs; next/image is used for optimized images.
- Tooling:
  - Biome is used for linting/formatting (no ESLint/Prettier configs present).
  - TypeScript: Next.js will auto-generate tsconfig.json on first run if missing.
  - Package manager: package-lock.json is present; use npm for scripts and installs.

## Notes pulled from README

- Run the dev server and visit http://localhost:3000. Live reload is enabled when editing app/page.tsx.
