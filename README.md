# VibeForm

VibeForm turns one mood into a complete multi-sensory experience:
- Spotify playlist recommendation
- Mood-matched recipe
- Movie recommendation
- Color palette
- Short meditation script
- Outfit direction
- Creative writing prompt

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- APIs: Groq + Spotify

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create `.env` in the project root:
```env
PORT=3001
GROQ_KEY=your_groq_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

3. Start backend:
```bash
npm run server
```

4. Start frontend (new terminal):
```bash
npm run dev
```

5. Open `http://localhost:5174`

## API Endpoints

- `GET /api/health`
- `GET /api/playlist?mood=focused`
- `GET /api/experience?mood=calm&ingredients=["tomato","basil"]&longMode=true`

## Notes

- Vite proxy forwards `/api` to `http://localhost:3001`.
- App stores recent generation history in `localStorage`.
