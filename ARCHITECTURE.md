# 🏗️ CONDEVOTE ARCHITECTURE & PERFORMANCE DESIGN

This document explains the technical architecture, offline state synchronization, cache optimization layers, and database structure of the CondeVote platform.

---

## 1. System Topology Overview

CondeVote is engineered as a full-stack, decoupled platform combining:
- **Client Web Application**: Responsive React (Vite) interface styled with Tailwind CSS, utilizing high-performance micro-animations via `motion`.
- **Durable Cloud Database**: Google Firebase Firestore storing real-time assembly states, voter registry, and ballot configurations.
- **Micro-service Backend**: Google Cloud Functions performing atomic writes and cryptographic audit logging.

```
                    ┌────────────────────────┐
                    │      React Client      │
                    └───────────┬────────────┘
                                │
                  ├─── READS    │    ─── CALLS (HTTP CALLABLE)
                  │             ▼
       ┌──────────────────┐   ┌──────────────────┐
       │ Firestore (Live) │   │ Cloud Functions  │
       └──────────────────┘   └────────┬─────────┘
                                       │
                                       │  (Admin SDK)
                                       ▼
                              ┌──────────────────┐
                              │    Firestore     │
                              │ (Atomic Writes)  │
                              └──────────────────┘
```

---

## 2. Redundancy & Cache Synchronization Flow

To guarantee high availability during unpredictable local connectivity failures, CondeVote implements a hybrid local-to-cloud sync engine:

1. **State Persistence Cache**: All crucial collections (residents, votes, system configurations) are instantly buffered in a high-efficiency memory state (`cachedResidents`, `cachedVotes`) and debounced to client `localStorage`.
2. **Debounced Disk Writes**: Frequent user interactions (such as presence check-in edits or administrative actions) utilize a **1000ms debounce buffer** before disk operations are requested. This reduces client CPU bottlenecking and disk writing fatigue.
3. **Optimized Listener Snapshot**: To support massive physical/online assemblies (with hundreds of units subscribing simultaneously), high-frequency listener streams inside `App.tsx` are bound with custom `debounce(..., 250ms)` handlers. This prevents UI flickering and rapid re-render loops on busy networks.

---

## 3. Database Schema Overview

```
/system/
  └── system_configs        <-- Global settings and global features
/authorized_admins/
  └── {uid}                 <-- Administrative profile and RBAC roles
/audit_logs/
  └── {logId}               <-- Immutable cryptographic audit trails
/assemblies/
  └── {assemblyId}/
        ├── residents_list/
        │     └── {unit}    <-- Resident data, CPF, accessPassword, check-in state
        └── votes/
              └── {voteId}  <-- Individual ballots processed by Cloud Functions
```
