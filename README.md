# Campus Event Hub

> A high-performance, production-grade Campus Event Management & Ticketing Platform built with Next.js 15, Node.js/Express, TypeScript, Prisma ORM, and PostgreSQL.

---

## 1. Project Overview

**Campus Event Hub** streamlines the entire lifecycle of university and college events. From event proposal and automated venue conflict resolution to administrative approvals, concurrency-safe registration ticketing, real-time waitlists, and QR-based attendee check-in, Campus Event Hub provides a secure, role-based platform for campus administrators, student organizers, and attendees.

---

## 2. Main Features & Functionalities

### 🛡️ Role-Based Access Control (RBAC)
- **Campus Administrators**: Review and approve/reject event proposals, manage user roles across departments, monitor campus-wide venue usage, and audit system activities.
- **Event Organizers**: Draft event proposals, perform venue conflict pre-checks, track live registrations, broadcast announcements, scan and check in attendees via QR tokens, and export registration manifests.
- **Students & Attendees**: Discover campus events with dynamic filtering, register for events with immediate ticket issuance, join automated waitlists when capacity is reached, form team registrations, download verified PDF certificates, and submit event ratings.

### ⚡ Core Capabilities
- **Venue Conflict Prevention Engine**: Automated time-slot and capacity verification preventing double-booking of campus auditoriums and seminar halls.
- **Concurrency-Safe Registrations**: Atomic registration workflow using PostgreSQL row locks and transactions to guarantee zero over-booking.
- **Dynamic PDF Certificate Generation**: Instant PDF generation (`pdfkit`) with unique verification tokens upon event completion.
- **Real-Time Announcements**: Server-Sent Events (SSE) delivering live broadcasts and notifications to registered participants.
- **QR Code Check-in**: Secure token generation and instant validation scanner for organizers at event venue entrances.
- **AI Suggestion Engine**: Automated title, description, and agenda formatting suggestions for organizers.

---

## 3. Technologies & Tools

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 15 (App Router) | React Server & Client components, modern routing architecture |
| **Frontend State & Styling** | React 18, Tailwind CSS, Lucide React | Modern responsive interface with dynamic dark/light aesthetics |
| **Backend API** | Node.js, Express, TypeScript | RESTful API with strict type safety and middleware layering |
| **Database & ORM** | PostgreSQL, Prisma ORM 5 | Schema modeling, automated migrations, type-safe query client |
| **Security & Auth** | JWT, bcryptjs, Helmet, CORS, cookie-parser | HTTP-only session cookies, bcrypt password hashing (12 rounds) |
| **Rate Limiting** | express-rate-limit | Abuse protection for authentication and API endpoints |
| **Document Generation** | PDFKit | Dynamic certificate generation with verification metadata |
| **Hosting & Cloud** | Vercel (Frontend), Render (Backend), Neon (Database) | Serverless PostgreSQL and global CDN edge distribution |

---

## 4. Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Vercel)"]
        UI["Next.js 15 App Router"]
        AC["Auth Context & State"]
        API_LIB["Universal API Fetcher"]
        UI --> AC
        AC --> API_LIB
    end

    subgraph Backend["Backend Service (Render)"]
        EXPRESS["Express Application"]
        HELMET["Helmet & CORS Security"]
        RATE["Rate Limiters"]
        ROUTERS["REST API Routers"]
        SERVICES["Services (Conflict & Registration)"]
        
        EXPRESS --> HELMET
        HELMET --> RATE
        RATE --> ROUTERS
        ROUTERS --> SERVICES
    end

    subgraph Database["PostgreSQL (Neon Serverless)"]
        PRISMA["Prisma ORM Client"]
        PG[("Neon Cloud Database")]
        PRISMA <--> PG
    end

    API_LIB -- "HTTPS / JSON / Cookies" --> EXPRESS
    SERVICES <--> PRISMA
```

---

## 5. Repository & Directory Structure

```
campus-event-hub/
├── client/                     # Next.js 15 Frontend
│   ├── src/
│   │   ├── app/                # App Router Pages (admin, organizer, student, events)
│   │   ├── components/         # Shared UI, layout, navbar, event cards
│   │   ├── context/            # Authentication React Context
│   │   ├── hooks/              # Custom React hooks (useAuth)
│   │   ├── lib/                # API client & mock utilities
│   │   └── types/              # Frontend TypeScript definitions
│   ├── public/                 # Static assets
│   ├── Dockerfile              # Production Dockerfile
│   └── package.json            # Client dependencies
│
├── server/                     # Express & TypeScript Backend
│   ├── src/
│   │   ├── config/             # Environment configuration & Prisma instance
│   │   ├── controllers/        # Route controllers (auth, events, venues, teams, etc.)
│   │   ├── middleware/         # Auth, validation, rate limiting, error handlers
│   │   ├── routes/             # REST API endpoint definitions
│   │   ├── services/           # Concurrency-safe business logic & conflict detection
│   │   ├── utils/              # JWT, cookie signing, response formatters
│   │   └── validators/         # Zod request payload schemas
│   ├── prisma/
│   │   ├── schema.prisma       # PostgreSQL schema definition
│   │   └── seed.ts             # Demo data seed script
│   ├── tests/                  # Integration & unit test suites
│   ├── Dockerfile              # Production Dockerfile
│   └── package.json            # Server dependencies
│
├── docker-compose.prod.yml     # Multi-container production orchestration
├── render.yaml                 # Render Blueprint specification
├── deploy.ps1                  # PowerShell automated deployment engine
└── package.json                # Monorepo workspaces definition
```

---

## 6. Database Schema & Entities

The platform uses PostgreSQL with the following core entities:

- **User**: Authentication credentials, roles (`ADMIN`, `ORGANIZER`, `STUDENT`), and department.
- **Venue**: Room/auditorium capacities, locations, and booking availability flags.
- **Event**: Schedules, categories, approval statuses (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`), organizer relations, and waitlist allocations.
- **Registration**: Participant links, QR check-in tokens, waitlist positions, seat numbers, and timestamps.
- **Team & TeamMember**: Multi-member team formations with unique entry codes for competitive events.
- **Announcement**: Event-specific broadcasts with real-time SSE streaming.
- **Feedback**: Post-event participant ratings and qualitative reviews.
- **AuditLog**: Complete system traceability for administrator interventions and approvals.

---

## 7. Local Development Setup

### Prerequisites
- Node.js `20.x` or higher
- npm `10.x` or higher
- PostgreSQL instance or Neon Serverless database URL

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/Lahari-333/campus-event-hub.git
cd campus-event-hub
npm install
```

### 2. Configure Backend Environment
Navigate to `server` and copy the environment template:
```bash
cd server
cp .env.example .env
```
Fill in the required values in `server/.env`:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@localhost:5432/campus_event_hub?schema=public"
JWT_SECRET="your-256-bit-jwt-secret-min-32-chars"
JWT_EXPIRES_IN="7d"
COOKIE_SECRET="your-cookie-signing-secret"
CLIENT_ORIGIN="http://localhost:3000"
```

### 3. Initialize Prisma & Seed Database
```bash
npx prisma db push
npm run prisma:seed
```

### 4. Configure Frontend Environment
Navigate to `client` and copy the environment template:
```bash
cd ../client
cp .env.local.example .env.local
```
Set the API base URL in `client/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 5. Run Development Servers
From the root directory:
```bash
# Terminal 1: Run Backend API
npm run dev:server

# Terminal 2: Run Frontend Client
npm run dev:client
```
The frontend is available at `http://localhost:3000` and the API at `http://localhost:4000`.

---

## 8. Deployment Architecture

Campus Event Hub is architected for decoupling:
1. **Backend**: Deployed on **Render** as a Node.js Web Service from directory `server`.
2. **Frontend**: Deployed on **Vercel** with Next.js edge caching and serverless routes from directory `client`.
3. **Database**: Managed **Neon Serverless PostgreSQL** database.

### Render Backend Configuration
- **Root Directory**: `server`
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm run start`
- **Health Check Route**: `/api/venues` (or `/health`)
- **Required Environment Variables**:
  - `PORT`: `10000`
  - `NODE_ENV`: `production`
  - `DATABASE_URL`: `postgresql://...`
  - `JWT_SECRET`: `...`
  - `COOKIE_SECRET`: `...`
  - `CLIENT_URL`: `https://campus-event-hub-web-single3.vercel.app`

### Vercel Frontend Configuration
- **Root Directory**: `client`
- **Framework Preset**: Next.js
- **Build Command**: `next build`
- **Output Directory**: `.next`
- **Required Environment Variables**:
  - `NEXT_PUBLIC_API_URL`: Render Backend URL (e.g. `https://campus-event-hub-api.onrender.com/api`)

---

## 9. Production Deployments & Live URLs

| Service | Target Platform | Live Production URL |
| :--- | :--- | :--- |
| **Frontend Web** | Vercel | [https://campus-event-hub-web-single3.vercel.app](https://campus-event-hub-web-single3.vercel.app) |
| **Backend API** | Render | *(Configured during Phase 4 deployment)* |
| **Database** | Neon PostgreSQL | Cloud Managed Instance |

---

## 10. Default Seed Accounts (For Evaluation & Testing)

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Campus Administrator** | `admin@campus.edu` | `Admin@12345` | Global approval, analytics, and user role management |
| **Event Organizer** | `organizer@campus.edu` | `Organizer@12345` | Event proposal submission, check-in scanner, team oversight |
| **Student Attendee 1** | `alice@campus.edu` | `Student@12345` | Event discovery, registration, ticket access |
| **Student Attendee 2** | `bob@campus.edu` | `Student@12345` | Event discovery, registration, team creation |

---

## 11. Testing & Quality Assurance

```bash
# Run backend test suite
cd server
npm test

# Run TypeScript type check
cd ../client
npm run type-check
```

---

## 12. Contributing & License

Contributions are welcome. Please open an issue or submit a pull request describing any improvements or bug fixes.
This project is licensed under the **ISC License**.
