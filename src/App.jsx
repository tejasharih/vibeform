import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingCard from './components/LoadingCard';

const ERROR_MESSAGES = {
  GENERAL: 'Failed to generate your vibe. Try again in a moment.',
  INVALID_MOOD: 'Please enter a mood before generating.',
  RATE_LIMIT: 'Rate limit reached. Please wait and retry.',
  UNAUTHORIZED: 'Server authentication failed. Verify API keys.',
};

const MOOD_SUGGESTIONS = [
  'focused',
  'nostalgic',
  'confident',
  'cozy',
  'adventurous',
  'romantic',
  'calm',
  'hyped',
];

const HISTORY_STORAGE_KEY = 'vibeform_history_v2';
const MAX_HISTORY_ITEMS = 12;

const api = axios.create({
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

const normalizeArray = (value) => (Array.isArray(value) ? value : []);
const safeText = (value, fallback = 'Not available') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const parseIngredients = (rawInput) =>
  rawInput
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);

const formatTimestamp = (isoTime) => {
  try {
    return new Date(isoTime).toLocaleString();
  } catch {
    return 'Unknown time';
  }
};

const buildShareSummary = (mood, experience) => {
  const playlistName = safeText(experience?.playlist?.name);
  const recipeName = safeText(experience?.recipe?.title);
  const movieName = safeText(experience?.movie?.title);

  return [
    `VibeForm mood: ${mood}`,
    `Playlist: ${playlistName}`,
    `Recipe: ${recipeName}`,
    `Movie: ${movieName}`,
  ].join('\n');
};

function SectionCard({ title, subtitle, children }) {
  return (
    <article className="vf-card">
      <header className="vf-card-header">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div>{children}</div>
    </article>
  );
}

function AppShell() {
  const [mood, setMood] = useState('');
  const [ingredientsInput, setIngredientsInput] = useState('');
  const [longMode, setLongMode] = useState(true);
  const [experience, setExperience] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const ingredientList = useMemo(() => parseIngredients(ingredientsInput), [ingredientsInput]);

  const handleGenerate = async () => {
    const normalizedMood = mood.trim();
    if (!normalizedMood) {
      setError(ERROR_MESSAGES.INVALID_MOOD);
      return;
    }

    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const response = await api.get('/api/experience', {
        params: {
          mood: normalizedMood,
          ingredients: JSON.stringify(ingredientList),
          longMode,
        },
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response payload');
      }

      setExperience(response.data);
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            id: Date.now(),
            mood: normalizedMood,
            longMode,
            createdAt: new Date().toISOString(),
            experience: response.data,
          },
        ];

        return next.slice(-MAX_HISTORY_ITEMS);
      });
    } catch (requestError) {
      if (requestError.response?.status === 429) {
        setError(ERROR_MESSAGES.RATE_LIMIT);
      } else if (requestError.response?.status === 401) {
        setError(ERROR_MESSAGES.UNAUTHORIZED);
      } else if (requestError.response?.data?.error) {
        setError(requestError.response.data.error);
      } else {
        setError(ERROR_MESSAGES.GENERAL);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReplay = (entry) => {
    setMood(entry.mood);
    setLongMode(Boolean(entry.longMode));
    setExperience(entry.experience);
    setError('');
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  const handleCopy = async () => {
    if (!experience) return;

    try {
      await navigator.clipboard.writeText(buildShareSummary(mood, experience));
      setCopied(true);
    } catch {
      setError('Could not copy summary to clipboard.');
    }
  };

  return (
    <div className="vf-page">
      <div className="vf-background" />

      <main className="vf-container">
        <section className="vf-hero">
          <p className="vf-kicker">Mood-powered recommendation engine</p>
          <h1>VibeForm</h1>
          <p>
            Turn one mood into a full multi-sensory plan: music, food, film, color palette, meditation, outfit,
            and a writing prompt. Designed for inspiration, not generic suggestions.
          </p>
        </section>

        <section className="vf-panel">
          <label htmlFor="mood-input">Mood</label>
          <input
            id="mood-input"
            type="text"
            value={mood}
            onChange={(event) => setMood(event.target.value)}
            placeholder="Examples: mellow, laser-focused, dreamy"
            disabled={loading}
            maxLength={80}
          />

          <div className="vf-suggestions">
            {MOOD_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="vf-chip"
                onClick={() => setMood(suggestion)}
                disabled={loading}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <label htmlFor="ingredients-input">Ingredients (optional)</label>
          <input
            id="ingredients-input"
            type="text"
            value={ingredientsInput}
            onChange={(event) => setIngredientsInput(event.target.value)}
            placeholder="tomato, basil, garlic"
            disabled={loading}
          />

          {ingredientList.length > 0 ? (
            <p className="vf-hint">Using {ingredientList.length} ingredient{ingredientList.length > 1 ? 's' : ''}.</p>
          ) : null}

          <div className="vf-toggle-row">
            <label htmlFor="long-mode-toggle" className="vf-toggle-label">
              <input
                id="long-mode-toggle"
                type="checkbox"
                checked={longMode}
                onChange={(event) => setLongMode(event.target.checked)}
                disabled={loading}
              />
              Detailed mode
            </label>
            <span className="vf-hint">More depth and longer creative output.</span>
          </div>

          <button
            type="button"
            className="vf-generate-btn"
            onClick={handleGenerate}
            disabled={!mood.trim() || loading}
          >
            {loading ? 'Generating your vibe...' : 'Generate Experience'}
          </button>

          {error ? <p className="vf-error">{error}</p> : null}
        </section>

        {loading ? (
          <section className="vf-grid vf-results">
            <LoadingCard icon="1" />
            <LoadingCard icon="2" />
            <LoadingCard icon="3" />
            <LoadingCard icon="4" />
          </section>
        ) : null}

        {experience ? (
          <section className="vf-results">
            <div className="vf-results-header">
              <h2>{mood.trim()} vibe</h2>
              <div className="vf-results-actions">
                <button type="button" className="vf-secondary-btn" onClick={handleCopy}>
                  {copied ? 'Copied' : 'Copy Summary'}
                </button>
                {experience?.playlist?.url ? (
                  <a href={experience.playlist.url} target="_blank" rel="noreferrer" className="vf-secondary-btn">
                    Open Playlist
                  </a>
                ) : null}
              </div>
            </div>

            <div className="vf-grid">
              <SectionCard
                title={safeText(experience?.playlist?.name, 'Playlist')}
                subtitle={safeText(experience?.playlist?.genre, 'Genre unavailable')}
              >
                <p>{safeText(experience?.playlist?.description)}</p>
                <p className="vf-muted">Theme: {safeText(experience?.playlist?.theme, 'Not specified')}</p>
              </SectionCard>

              <SectionCard title={safeText(experience?.recipe?.title, 'Recipe')}>
                <p className="vf-muted">Ingredients</p>
                <div className="vf-tags">
                  {normalizeArray(experience?.recipe?.ingredients).map((ingredient) => (
                    <span key={ingredient} className="vf-tag">
                      {ingredient}
                    </span>
                  ))}
                </div>
                <pre>{safeText(experience?.recipe?.instructions)}</pre>
              </SectionCard>

              <SectionCard
                title={`${safeText(experience?.movie?.title, 'Movie')} ${experience?.movie?.year ? `(${experience.movie.year})` : ''}`}
                subtitle={safeText(experience?.movie?.genre, 'Genre unavailable')}
              >
                <p>{safeText(experience?.movie?.description)}</p>
                <p className="vf-muted">Streaming: {safeText(experience?.movie?.streaming, 'Unknown')}</p>
              </SectionCard>

              <SectionCard title={safeText(experience?.colorPalette?.name, 'Color Palette')}>
                <div className="vf-swatches">
                  {normalizeArray(experience?.colorPalette?.colors).map((color) => (
                    <div key={`${color.name}-${color.hex}`} className="vf-swatch-item">
                      <div className="vf-swatch" style={{ backgroundColor: color.hex || '#555' }} />
                      <span>{safeText(color.name, 'Color')}</span>
                      <small>{safeText(color.hex, '#000000')}</small>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Meditation">
                <p>{safeText(experience?.meditation?.prompt)}</p>
                <p className="vf-muted">Duration: {safeText(experience?.meditation?.duration, 'Flexible')}</p>
              </SectionCard>

              <SectionCard title="Outfit Suggestion">
                <p>{safeText(experience?.outfit?.description)}</p>
                <p className="vf-muted">
                  Season: {safeText(experience?.outfit?.season, 'Any')} | Style:{' '}
                  {safeText(experience?.outfit?.style, 'Flexible')}
                </p>
                <div className="vf-tags">
                  {normalizeArray(experience?.outfit?.colors).map((color) => (
                    <span key={color} className="vf-tag">
                      {color}
                    </span>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Writing Snippet" subtitle={safeText(experience?.writing?.theme, 'Theme not specified')}>
                <p>{safeText(experience?.writing?.snippet)}</p>
              </SectionCard>
            </div>
          </section>
        ) : null}

        <section className="vf-panel">
          <div className="vf-history-header">
            <h2>Recent moods</h2>
            {history.length > 0 ? (
              <button type="button" className="vf-link-btn" onClick={handleClearHistory}>
                Clear
              </button>
            ) : null}
          </div>

          {history.length === 0 ? <p className="vf-muted">No saved vibe history yet.</p> : null}

          <div className="vf-history-list">
            {history
              .slice()
              .reverse()
              .map((entry) => (
                <button key={entry.id} type="button" className="vf-history-item" onClick={() => handleReplay(entry)}>
                  <div>
                    <strong>{entry.mood}</strong>
                    <p>{safeText(entry?.experience?.playlist?.name, 'Generated vibe')}</p>
                  </div>
                  <small>{formatTimestamp(entry.createdAt)}</small>
                </button>
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
