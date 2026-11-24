# Amootech Frontend

Amootech is an educational management and student planning platform. This repository contains its web frontend, built with Next.js and React. It provides separate workflows for students, counselors, and administrators and communicates with the [Amootech Backend](https://github.com/3aDegH3/amootech-platform-backend), which owns the platform API and business data.

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Install and run locally](#install-and-run-locally)
- [Environment variables and backend API](#environment-variables-and-backend-api)
- [Build and run](#build-and-run)
- [Tests and linting](#tests-and-linting)
- [Contributing](#contributing)

## Features

The current application includes:

- **Student workflows:** profile and mobile verification, study plans and execution tracking, daily reports, progress views, and exam practice/reporting tools.
- **Counselor workflows:** student lists and detail views, academic plan creation, fixed schedule management, student progress and reports, exam creation and management, and follow-up/dashboard views.
- **Administrator workflows:** student and counselor management, academic catalog views, dashboard summaries, and Telegram controls.
- **Exam tools:** question-bank and exam builders, topic selection, scheduling and participant views, monitoring, analytics, and management panels.
- **Persian calendar support:** Jalali date utilities and date input components.

These are frontend workflows. Authentication, authorization, persistence, and domain rules are provided by the backend API.

## Technology stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 App Router |
| UI | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4, with application CSS modules/files |
| Drag and drop | `@dnd-kit/core` |
| Jalali date utilities | `jalaali-js` |
| Linting | ESLint 9 with Next.js configuration |
| Runtime in Docker | Node.js 22 Alpine |

Exact package versions and scripts are defined in [`package.json`](package.json) and `package-lock.json`.

## Project structure

```text
.
├── src/
│   ├── app/                 # Next.js routes and role-based application screens
│   │   ├── admin/            # Administrator dashboard and management pages
│   │   ├── counselor/        # Counselor dashboard, students, planning and exams
│   │   ├── student/          # Student profile, plans, reports and exams
│   │   └── register/         # Student registration
│   ├── components/           # Shared account, counselor, exam and report UI
│   └── lib/                  # API client and shared planning/report/date logic
├── tests/                    # Node test-runner unit and optional browser tests
├── public/                   # Static assets
├── Dockerfile                # Development container image
├── next.config.ts
├── package.json
└── .env.example              # Local backend API URL example
```

## Prerequisites

- Node.js 22 and npm (the same Node major version used by the Dockerfile)
- The Amootech backend running locally or at a reachable API URL
- Git

## Install and run locally

Clone the frontend repository and install the locked dependencies:

```bash
git clone https://github.com/heldajafari904-lgtm/amootech-platform-frontend.git
cd amootech-platform-frontend
npm ci
```

Create the local environment file, set the API URL as described below, and start the development server:

```bash
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For the complete local stack, including PostgreSQL and the backend, use the Docker Compose instructions in the [backend repository](https://github.com/3aDegH3/amootech-platform-backend). Compose expects the frontend and backend repositories to be sibling directories and starts the frontend development server on port 3000.

## Environment variables and backend API

The frontend reads `NEXT_PUBLIC_API_BASE_URL` in `src/lib/api.ts`. It defaults to `http://localhost:8000/api/v1` when unset. Set it in `.env.local` for local development:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

For another backend, use its API base URL, including the `/api/v1` prefix when applicable. The frontend calls backend endpoints for authentication and the student, counselor, administrator, academic, planning, report, exam, and Telegram workflows. The API schema and Swagger UI are documented by the backend repository.

`NEXT_PUBLIC_` values are included in browser-side code. Do not put passwords, private tokens, or other secrets in this variable or in any other public frontend environment variable. Configure the API URL before building, because public environment values may be embedded in the client bundle.

## Build and run

Create an optimized production build and run it locally:

```bash
npm run build
npm start
```

The production server listens on port 3000 by default. Set `NEXT_PUBLIC_API_BASE_URL` before `npm run build` to target the intended backend. The included Dockerfile defines a development image; it is not a production deployment image or deployment guide.

## Tests and linting

Run ESLint with:

```bash
npm run lint
```

The repository defines focused Node test commands in `package.json`, for example:

```bash
npm run test:planner
npm run test:reports
npm run test:dashboard
npm run test:question-bank
```

Browser-oriented tests are opt-in and use environment flags in their corresponding scripts. See `package.json` for the complete command list and requirements for each browser test.

## Contributing

Contributions should be scoped, reviewed, and tested before opening a pull request:

1. Fork the repository and create a topic branch from `main`.
2. Keep changes focused and follow the existing Next.js App Router and TypeScript patterns.
3. Run the relevant test command and `npm run lint`.
4. Open a pull request describing the change, affected user workflow, and verification performed.
5. Do not commit credentials, real student information, or production data.

Coordinate API contract changes with the backend repository so frontend and backend behavior remain compatible. Project-specific contribution, security reporting, and code-of-conduct documents are not currently included in this repository.
