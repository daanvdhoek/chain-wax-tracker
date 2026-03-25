# 🚴‍♂️ Chain Wax Tracker

A simple web app to track road bike chain usage and waxing intervals, with automatic ride import via Strava.

---

## ✨ Features

- Track multiple chains (e.g. Chain A / Chain B)
- Automatically import ride distance from Strava
- Monitor:
  - Total km per chain
  - Km since last wax
- Visual alerts when:
  - A chain should be switched (≥270 km)
  - A removed chain should be rewaxed
- Manual controls:
  - Switch active chain
  - Mark chain as rewaxed
  - Edit starting km

---

## ⚙️ How it works

1. Connect your Strava account
2. Complete a ride (e.g. via Garmin → Strava)
3. Strava sends a webhook to the app
4. The app:
   - fetches the activity
   - adds distance to the installed chain
5. When a chain reaches the threshold:
   - you get a clear warning to switch chains

---

## 🧠 Core logic

- Only the **installed chain** accumulates distance
- Each chain tracks:
  - `totalKm` → lifetime usage
  - `kmSinceWax` → maintenance threshold
- Webhooks enable **automatic tracking (no manual input needed)**

---

## 🚀 Getting Started (Local)

### 1. Install dependencies

```bash
npm install