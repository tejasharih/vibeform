import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const GROQ_KEY = process.env.GROQ_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CLIENT_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];

app.use(
  cors({
    origin: CLIENT_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST'],
  })
);
app.use(express.json());

let cachedSpotifyToken = null;
let cachedSpotifyExpiresAt = 0;

const requiredSections = ['playlist', 'recipe', 'movie', 'colorPalette', 'meditation', 'outfit', 'writing'];

function hasSpotifyCredentials() {
  return Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
}

function hasGroqCredentials() {
  return Boolean(GROQ_KEY);
}

function sanitizeMood(rawMood) {
  if (typeof rawMood !== 'string') return '';
  return rawMood.trim().slice(0, 80);
}

function sanitizeIngredients(rawIngredients) {
  if (!Array.isArray(rawIngredients)) return [];
  return rawIngredients
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 20);
}

function safeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeColorPalette(rawPalette) {
  const colors = safeArray(rawPalette?.colors)
    .map((color) => ({
      name: safeText(color?.name, 'Unnamed color'),
      hex: safeText(color?.hex, '#555555'),
    }))
    .slice(0, 6);

  return {
    name: safeText(rawPalette?.name, 'Mood palette'),
    colors: colors.length > 0 ? colors : [{ name: 'Fallback', hex: '#555555' }],
  };
}

function normalizeExperience(rawExperience, mood) {
  return {
    playlist: {
      name: safeText(rawExperience?.playlist?.name, `${mood} Mix`),
      description: safeText(rawExperience?.playlist?.description, 'A playlist crafted for your mood.'),
      genre: safeText(rawExperience?.playlist?.genre, 'Mixed'),
      theme: safeText(rawExperience?.playlist?.theme, mood),
      url: safeText(rawExperience?.playlist?.url, ''),
    },
    recipe: {
      title: safeText(rawExperience?.recipe?.title, 'Comfort Bowl'),
      ingredients: safeArray(rawExperience?.recipe?.ingredients).map((item) => safeText(item)).filter(Boolean),
      instructions: safeText(rawExperience?.recipe?.instructions, 'Combine ingredients and adjust to taste.'),
    },
    movie: {
      title: safeText(rawExperience?.movie?.title, 'Anytime Favorite'),
      year: Number(rawExperience?.movie?.year) || '',
      description: safeText(rawExperience?.movie?.description, 'A film that complements your mood.'),
      genre: safeText(rawExperience?.movie?.genre, 'Drama'),
      streaming: safeText(rawExperience?.movie?.streaming, 'Any streaming service'),
    },
    colorPalette: normalizeColorPalette(rawExperience?.colorPalette),
    meditation: {
      prompt: safeText(rawExperience?.meditation?.prompt, 'Take five slow breaths and notice your surroundings.'),
      duration: safeText(rawExperience?.meditation?.duration, '5-7 minutes'),
    },
    outfit: {
      description: safeText(rawExperience?.outfit?.description, 'Wear pieces that match your energy today.'),
      season: safeText(rawExperience?.outfit?.season, 'All seasons'),
      style: safeText(rawExperience?.outfit?.style, 'Casual'),
      colors: safeArray(rawExperience?.outfit?.colors).map((color) => safeText(color)).filter(Boolean),
    },
    writing: {
      snippet: safeText(rawExperience?.writing?.snippet, 'Write about what this mood reminds you of.'),
      theme: safeText(rawExperience?.writing?.theme, mood),
    },
  };
}

function extractJsonObject(text) {
  if (typeof text !== 'string') {
    throw new Error('Model response is not text');
  }

  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with extraction attempts.
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // Continue with brace extraction.
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const maybeJson = trimmed.slice(firstBrace, lastBrace + 1);
    return JSON.parse(maybeJson);
  }

  throw new Error('Could not extract JSON from model response');
}

async function getSpotifyToken() {
  const now = Date.now();
  if (cachedSpotifyToken && now < cachedSpotifyExpiresAt - 60_000) {
    return cachedSpotifyToken;
  }

  if (!hasSpotifyCredentials()) {
    throw new Error('Spotify credentials are not configured');
  }

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await axios.post(SPOTIFY_TOKEN_URL, 'grant_type=client_credentials', {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10_000,
  });

  const token = response.data?.access_token;
  const expiresInSeconds = Number(response.data?.expires_in) || 3600;

  if (!token) {
    throw new Error('Spotify token response missing access_token');
  }

  cachedSpotifyToken = token;
  cachedSpotifyExpiresAt = now + expiresInSeconds * 1000;
  return token;
}

async function fetchPlaylistForMood(mood) {
  const token = await getSpotifyToken();

  const moodQuery = mood.toLowerCase().replace(/[^a-z0-9\s-]/gi, '').trim();
  const queries = [`${moodQuery} playlist`, `${moodQuery} vibes`, `${moodQuery} mix`, 'mood booster playlist'];

  for (const query of queries) {
    const response = await axios.get(`${SPOTIFY_API_URL}/search`, {
      params: {
        q: query,
        type: 'playlist',
        limit: 6,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 10_000,
    });

    const candidate = response.data?.playlists?.items?.find(
      (playlist) => playlist?.external_urls?.spotify && playlist?.name
    );

    if (candidate) {
      return {
        name: safeText(candidate.name, `${mood} Mix`),
        description: safeText(candidate.description, `A playlist for ${mood}.`),
        url: safeText(candidate.external_urls.spotify, ''),
      };
    }
  }

  return null;
}

function buildSystemPrompt(longMode) {
  const detailInstructions = longMode
    ? `Return rich detail:
- recipe: at least 7 ingredients and 7+ clear steps
- movie: 3-4 sentence synopsis and why it matches the mood
- meditation: 7-10 sentence guided script with breath cues
- outfit: specific clothing pieces, textures, and color logic
- writing: 6-8 sentence poetic or narrative snippet`
    : `Return concise detail:
- recipe: short practical version
- movie, meditation, outfit, writing: under 3 sentences each`;

  return `You are an expert creative recommender.
Return only valid JSON with exactly this top-level structure:
{
  "playlist": { "name": "", "description": "", "genre": "", "theme": "", "url": "" },
  "recipe": { "title": "", "ingredients": [""], "instructions": "" },
  "movie": { "title": "", "year": 0, "description": "", "genre": "", "streaming": "" },
  "colorPalette": { "name": "", "colors": [{ "name": "", "hex": "" }] },
  "meditation": { "prompt": "", "duration": "" },
  "outfit": { "description": "", "season": "", "style": "", "colors": [""] },
  "writing": { "snippet": "", "theme": "" }
}
${detailInstructions}`;
}

async function generateExperienceWithGroq({ mood, ingredients, longMode }) {
  if (!hasGroqCredentials()) {
    throw new Error('GROQ_KEY is not configured');
  }

  const userPrompt = `Create a vibe card for mood: "${mood}"${
    ingredients.length ? ` with ingredients: ${ingredients.join(', ')}` : ''
  }.`;

  const response = await axios.post(
    GROQ_API_URL,
    {
      model: 'llama3-8b-8192',
      messages: [
        { role: 'system', content: buildSystemPrompt(longMode) },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: longMode ? 2600 : 1700,
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq API returned an empty completion');
  }

  return extractJsonObject(content);
}

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'vibeform-api',
    hasGroqKey: hasGroqCredentials(),
    hasSpotifyCredentials: hasSpotifyCredentials(),
  });
});

app.get('/api/playlist', async (req, res) => {
  try {
    const mood = sanitizeMood(req.query.mood);
    if (!mood) {
      return res.status(400).json({ error: 'Mood is required.' });
    }

    const playlist = await fetchPlaylistForMood(mood);
    if (!playlist) {
      return res.status(404).json({ error: 'No playlist found for that mood.' });
    }

    return res.status(200).json(playlist);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch playlist.',
      details: error.message,
    });
  }
});

app.get('/api/experience', async (req, res) => {
  try {
    const mood = sanitizeMood(req.query.mood);
    if (!mood) {
      return res.status(400).json({ error: 'Mood is required and must be a valid string.' });
    }

    let parsedIngredients = [];
    if (req.query.ingredients) {
      try {
        parsedIngredients = JSON.parse(req.query.ingredients);
      } catch {
        return res.status(400).json({ error: 'Ingredients must be a valid JSON array.' });
      }
    }

    const ingredients = sanitizeIngredients(parsedIngredients);
    const longMode = req.query.longMode === 'true';

    const rawExperience = await generateExperienceWithGroq({ mood, ingredients, longMode });
    const experience = normalizeExperience(rawExperience, mood);

    // Validate top-level sections exist after normalization.
    for (const section of requiredSections) {
      if (!experience[section]) {
        throw new Error(`Normalized experience is missing section: ${section}`);
      }
    }

    try {
      const spotifyPlaylist = await fetchPlaylistForMood(mood);
      if (spotifyPlaylist) {
        experience.playlist = {
          ...experience.playlist,
          ...spotifyPlaylist,
        };
      }
    } catch {
      // Playlist enhancement is best effort; return the generated experience anyway.
    }

    return res.status(200).json(experience);
  } catch (error) {
    const status = error?.response?.status;

    if (status === 401) {
      return res.status(401).json({ error: 'Unauthorized. Check GROQ and Spotify credentials.' });
    }

    if (status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again shortly.' });
    }

    return res.status(500).json({
      error: 'Failed to generate experience.',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`VibeForm API listening on http://localhost:${PORT}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
