# 🌾 Agri-Track

### AI-Powered Market Intelligence & Procurement Queue Platform for Farmers

**Agri-Track** is a unified digital platform designed to help farmers make better selling decisions by comparing **mandi markets and government procurement centres** using price, expected net return, waiting time, availability, and location-related factors.

Instead of forcing farmers to choose a selling location based only on the highest displayed price, Agri-Track evaluates the **overall selling opportunity** and recommends the most suitable option.

> **Sell Smarter. Earn Better.**

---

## 🚜 Problem

Farmers often face several challenges when deciding where to sell their produce:

* Market prices vary significantly between locations.
* The highest price does not always result in the highest actual return.
* Transportation costs reduce the effective selling price.
* Government procurement centres may have queues and limited availability.
* Farmers may not have timely information about centre status or waiting times.
* Market and procurement information is scattered across different sources.

As a result, farmers can lose both **time and potential income** while choosing where to sell.

---

## 💡 Our Solution

Agri-Track brings the relevant information together into a single platform.

The system:

1. Collects market and procurement information.
2. Takes the farmer's crop and quantity into account.
3. Compares available selling options.
4. Calculates expected financial outcomes.
5. Considers estimated waiting time and centre availability.
6. Ranks the available options.
7. Recommends the best option.
8. Allows farmers to join a procurement queue digitally.
9. Provides a queue token and estimated waiting time.
10. Gives farmers alternative options when the preferred centre is unavailable.

---

## ⭐ Key Features

### 📊 Market & Procurement Comparison

Compare multiple selling options based on:

* Market/procurement price
* Quantity
* Estimated transportation impact
* Expected net return
* Waiting time
* Centre availability

---

### 🧠 Recommendation Engine

Agri-Track uses a deterministic scoring engine to rank selling options.

The current prototype considers:

| Factor              | Weight |
| ------------------- | -----: |
| Expected Net Return |    70% |
| Waiting Time        |    20% |
| Availability        |    10% |

The recommendation is therefore based on the **overall expected benefit**, rather than simply selecting the location with the highest displayed price.

---

### 🎫 Digital Procurement Queue

Farmers can digitally join a procurement queue and receive a token.

The queue system supports:

* Digital queue joining
* Token generation
* Queue position
* Estimated waiting time
* Queue status
* Notifications
* Queue movement
* Processing status

---

### 🏢 Procurement Centre Dashboard

The centre/admin side provides visibility into:

* Active queue
* Farmer entries
* Queue positions
* Processing status
* Estimated waiting time
* Centre activity
* Processing history

---

### 📱 Farmer-Friendly Interface

The platform is designed around a simple workflow:

**Enter Crop Details → Compare Options → Get Recommendation → Join Queue → Track Status**

The goal is to keep complex market information understandable and actionable for farmers.

---

## 🔄 System Workflow

```text
                    ┌─────────────────────┐
                    │     Farmer Input    │
                    │ Crop + Quantity     │
                    │ Location / Need     │
                    └──────────┬──────────┘
                               │
                               ▼
                 ┌──────────────────────────┐
                 │ Market & Procurement Data│
                 │ Price + Availability     │
                 │ Waiting Time + Location  │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │ Financial Calculation    │
                 │ Expected Net Return      │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │ Recommendation Engine    │
                 │ 70% Return               │
                 │ 20% Waiting Time         │
                 │ 10% Availability         │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │ Ranked Selling Options   │
                 └────────────┬─────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
             Best Option          Alternatives
                    │
                    ▼
          ┌────────────────────┐
          │ Join Digital Queue │
          └─────────┬──────────┘
                    │
                    ▼
          ┌────────────────────┐
          │ Token + Live Queue │
          │ + Estimated Wait   │
          └────────────────────┘
```

---

## 🏗️ Architecture

```text
┌───────────────────────────────────────────────┐
│                  Frontend                     │
│             Next.js + React                   │
│                                               │
│ Farmer UI │ Comparison │ Queue │ Admin Panel │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│              Application Logic                │
│                                               │
│ Recommendation Engine                         │
│ Financial Calculations                        │
│ Queue Engine                                  │
│ Validation                                    │
└───────────────────────┬───────────────────────┘
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
   ┌──────────────────┐   ┌──────────────────┐
   │   Demo Mode      │   │   Supabase       │
   │ In-memory Store  │   │ Production Data  │
   └──────────────────┘   └──────────────────┘
```

The project supports two data modes:

* **Demo Mode** — designed for hackathon demonstrations without requiring external credentials.
* **Supabase Mode** — intended for persistent production-style data storage.

---

## 🛠️ Tech Stack

### Frontend

* Next.js 14
* React 18
* TypeScript
* Tailwind CSS

### Backend / Application Logic

* Next.js server-side functionality
* TypeScript
* Zod validation

### Database

* Supabase
* PostgreSQL

### Core Modules

* Recommendation Engine
* Financial Calculation Engine
* Procurement Queue Engine
* Centre Management
* Farmer Session Management
* Demo Data Layer

---

## 📁 Project Structure

```text
src/
├── app/
│   ├── admin/
│   ├── api/
│   ├── compare/
│   ├── dashboard/
│   ├── queue/
│   ├── actions/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── ComparisonTable.tsx
│   ├── RecommendationCard.tsx
│   ├── QueueTicket.tsx
│   ├── AdminQueueTable.tsx
│   └── ...
│
└── lib/
    ├── calculations.ts
    ├── recommendation-engine.ts
    ├── types.ts
    ├── data/
    ├── demo/
    └── supabase/
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/mohit-jdv/Agristack.git
cd Agristack
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

The application runs on:

```text
http://localhost:8080
```

### 4. Production build

```bash
npm run build
```

### 5. Start production server

```bash
npm run start
```

---

## 🧪 Demo Mode

Agri-Track is configured to support a **demo-first workflow** for hackathon presentations.

Demo mode uses in-memory data, allowing the core farmer → recommendation → queue workflow to run without requiring a production database.

This makes it possible to demonstrate the system even when external services are unavailable.

The prototype includes sample:

* Farmers
* Procurement centres
* Market options
* Queue entries
* Processing history
* Notifications

---

## 🗄️ Supabase Mode

For persistent data, the application can be configured to use Supabase.

Required environment variables include:

```env
AGRISTACK_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

For the hackathon demonstration, the default demo configuration can be used instead.

> Never commit secret keys or `.env` files to GitHub.

---

## 🧮 Recommendation Logic

The recommendation engine calculates a score for every available selling option.

### Current scoring model

```text
Final Score =
    70% × Net Return Score
  + 20% × Waiting Time Score
  + 10% × Availability Score
```

### Why net return matters

A higher headline price does not necessarily mean a better selling option.

The platform focuses on the **expected net benefit** after considering relevant selling costs and operational factors.

Waiting time and availability are then incorporated to make the recommendation more practical.

The recommendation engine is intentionally deterministic and transparent so that its calculations can be inspected and explained.

---

## 🎫 Queue Management

The digital queue system supports the complete procurement workflow:

```text
Join Queue
     ↓
Token Generated
     ↓
Queue Position Assigned
     ↓
Estimated Waiting Time
     ↓
Position Updates
     ↓
Processing
     ↓
Completed
```

The prototype also supports queue movement and farmer notifications as their turn approaches.

---

## 🔐 Data & Security

The project is designed with separation between:

* UI components
* Application logic
* Demo data
* Persistent database access
* Server-side operations

Production deployments should use environment variables for credentials and should never expose service-role secrets to client-side code.

---

## 📈 Future Scope

Agri-Track can be extended with:

* Real-time mandi price APIs
* Government procurement APIs
* Weather data integration
* GPS-based transport estimation
* Live procurement-centre capacity
* Regional-language AI assistant
* Voice-based farmer interaction
* SMS/WhatsApp notifications
* Predictive price trends
* More advanced optimization models
* Offline-first support for low-connectivity regions
* Integration with government agriculture platforms

---

## 🎯 Hackathon Prototype Scope

The current implementation focuses on demonstrating the core concept:

**Market/Procurement Comparison → Recommendation → Procurement Queue → Queue Tracking → Centre Dashboard**

The prototype uses demo data where live integrations are not available, allowing the complete workflow to be demonstrated reliably during evaluation.

---

## 👥 Team

**Team MIRAI**

Project: **Agri-Track**

Developed for **Smart India Hackathon 2026**

---

## 📄 License

This project is currently developed as a hackathon prototype.

If this project is later released publicly, an appropriate open-source license can be added here.

---

## 🌱 Vision

> **Make the right selling decision easier for every farmer.**

Agri-Track aims to turn fragmented market and procurement information into a simple, actionable decision—helping farmers spend less time waiting, make better selling choices, and improve their expected returns.
