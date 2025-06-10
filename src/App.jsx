import { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingCard from './components/LoadingCard';

// Axios setup
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['Accept'] = 'application/json';

axios.interceptors.request.use(
  config => {
    console.log('API Request:', config.method.toUpperCase(), config.url);
    return config;
  },
  error => Promise.reject(error)
);

axios.interceptors.response.use(
  response => response,
  error => Promise.reject(error)
);

const ERROR_MESSAGES = {
  PLAYLIST: "\u26a0\ufe0f Couldn't find a playlist, but we can still suggest a dish!",
  RECIPE: "\u26a0\ufe0f Couldn't find a recipe, but we found a great playlist!",
  GENERAL: '❌ Failed to fetch data',
  INVALID_MOOD: '❌ Please enter a valid mood',
  INVALID_INGREDIENTS: '❌ Invalid ingredients format',
  RATE_LIMIT: '⏳ Rate limit exceeded. Please try again in a few minutes.',
  UNAUTHORIZED: '🔒 Authentication error. Please check your API credentials.'
};

function App() {
  const [mood, setMood] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [experience, setExperience] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('vibeHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    playlist: false,
    recipe: false,
    movie: false,
    colorPalette: false,
    meditation: false,
    outfit: false,
    writing: false
  });
  const [expandedPlaylist, setExpandedPlaylist] = useState(false);
  const [expandedRecipe, setExpandedRecipe] = useState(false);
  const [expandedMovie, setExpandedMovie] = useState(false);
  const [expandedColorPalette, setExpandedColorPalette] = useState(false);
  const [expandedMeditation, setExpandedMeditation] = useState(false);
  const [expandedOutfit, setExpandedOutfit] = useState(false);
  const [expandedWriting, setExpandedWriting] = useState(false);
  const [longMode, setLongMode] = useState(true);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('vibeHistory', JSON.stringify(history));
  }, [history]);

  const handleSubmit = async () => {
    if (!mood.trim()) {
      setError(ERROR_MESSAGES.INVALID_MOOD);
      return;
    }

    const ingredientsArray = ingredients.trim().split(',').map(i => i.trim()).filter(Boolean);
    
    setLoading(true);
    setError('');
    setExperience(null);
    setLoadingStates({
      playlist: true,
      recipe: true,
      movie: true,
      colorPalette: true,
      meditation: true,
      outfit: true,
      writing: true
    });

    try {
      const response = await axios.get('/api/experience', { 
        params: {
          mood,
          ingredients: JSON.stringify(ingredientsArray),
          longMode
        } 
      });
      
      // Validate response
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response format');
      }
      
      setExperience(response.data);
      setHistory(prev => {
        const newHistory = [...prev, { 
          id: Date.now(),
          mood, 
          experience: response.data,
          timestamp: new Date().toISOString()
        }];
        // Keep only last 10 items
        return newHistory.slice(-10);
      });
    } catch (error) {
      console.error('Error generating experience:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      // Handle specific error cases
      if (error.response?.status === 429) {
        setError(ERROR_MESSAGES.RATE_LIMIT);
      } else if (error.response?.status === 401) {
        setError(ERROR_MESSAGES.UNAUTHORIZED);
      } else if (error.response) {
        // Use the specific error message from the backend if available
        setError(error.response.data.error || error.response.data.details || ERROR_MESSAGES.GENERAL);
      } else {
        setError(ERROR_MESSAGES.GENERAL);
      }
    } finally {
      setLoading(false);
      setLoadingStates({
        playlist: false,
        recipe: false,
        movie: false,
        colorPalette: false,
        meditation: false,
        outfit: false,
        writing: false
      });
    }
  };

  const replayHistory = (index) => {
    const { mood, experience } = history[index];
    setMood(mood);
    setExperience(experience);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('vibeHistory');
  };

  // Function to extract Spotify playlist ID from various URL formats
  const getSpotifyPlaylistId = (url) => {
    try {
      if (!url) return null;
      const playlistMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
      if (playlistMatch && playlistMatch[1]) {
        return playlistMatch[1];
      }
      // Handle potential direct embed URLs if necessary, though typically less common for sharing
      const embedMatch = url.match(/embed\/playlist\/([a-zA-Z0-9]+)/);
       if (embedMatch && embedMatch[1]) {
        return embedMatch[1];
      }
    } catch (e) {
       console.error('Error extracting Spotify playlist ID:', e);
       return null;
    }
    return null; // No ID found
  };

  const togglePlaylistExpand = () => {
    setExpandedPlaylist(!expandedPlaylist);
  };

  const toggleRecipeExpand = () => {
    setExpandedRecipe(!expandedRecipe);
  };

  const toggleMovieExpand = () => {
    setExpandedMovie(!expandedMovie);
  };

  const toggleColorPaletteExpand = () => {
    setExpandedColorPalette(!expandedColorPalette);
  };

  const toggleMeditationExpand = () => {
    setExpandedMeditation(!expandedMeditation);
  };

  const toggleOutfitExpand = () => {
    setExpandedOutfit(!expandedOutfit);
  };

  const toggleWritingExpand = () => {
    setExpandedWriting(!expandedWriting);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-900 text-white p-6">
        <div className="">
          <h1 className="text-4xl font-bold text-center mb-2 text-gradient">🎵 Vibeform</h1>
          <p className="text-center text-sm text-zinc-400 mb-6">Multi-sensory experiences from a single vibe</p>

          <div className="space-y-6">
            <div className="card">
              <div className="space-y-4">
                <input
                  type="text"
                  value={mood}
                  onChange={e => setMood(e.target.value)}
                  placeholder="Type your mood..."
                  className="w-full p-3 rounded-md text-black text-white bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  disabled={loading}
                />
                <input
                  type="text"
                  value={ingredients}
                  onChange={e => setIngredients(e.target.value)}
                  placeholder="Optional ingredients (comma separated)"
                  className="w-full p-3 rounded-md text-black text-white bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  disabled={loading}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!mood.trim() || loading}
                  className={`w-full py-2 rounded-md transition-colors ${
                    loading 
                      ? 'bg-purple-800 cursor-not-allowed' 
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="loading-spinner mr-2"></div>
                      <span>Creating your vibe...</span>
                    </div>
                  ) : (
                    '🎵 Get Matched'
                  )}
                </button>
              </div>
            </div>

            {/* Long Mode Toggle */}
            <div className="flex items-center justify-center mb-6">
              <input
                type="checkbox"
                id="longModeToggle"
                checked={longMode}
                onChange={e => setLongMode(e.target.checked)}
                className="mr-2 leading-tight"
                disabled={loading}
              />
              <label htmlFor="longModeToggle" className="text-sm text-white cursor-pointer">
                Detailed Descriptions
              </label>
            </div>

            {error && (
              <div className="card bg-red-700/20 animate-fadeIn">
                <p className="text-yellow-400 text-center">{error}</p>
              </div>
            )}

            {/* Mood Banner */}
            {mood && !loading && !error && (
               <div className="text-center text-xl font-semibold text-purple-400 mb-6 animate-fadeIn">
                 You're feeling: {mood} {mood === 'excited' && '🌟'} {mood === 'calm' && '😌'} {mood === 'happy' && '😊'} {/* Add more emojis */} 
               </div>
            )}

            {loading ? (
              <div className="space-y-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <LoadingCard icon="🎶" />
                <LoadingCard icon="✨" />
                <LoadingCard icon="🎬" />
                <LoadingCard icon="🎨" />
                <LoadingCard icon="🧘‍♀️" />
                <LoadingCard icon="👕" />
                <LoadingCard icon="✍️" />
              </div>
            ) : experience && (
              <div className="experience-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                {/* Playlist Card */}
                <div className={`card card-playlist ${loadingStates.playlist ? 'animate-pulse' : ''} animate-floatUp col-span-1 md:col-span-2`} onClick={togglePlaylistExpand}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h2 className="font-semibold text-xl">🎶 {experience.playlist.name}</h2>
                      <span className="text-purple-400 text-sm flex items-center">
                        {expandedPlaylist ? 'Show Less' : 'Show More'}
                        <svg className={`w-4 h-4 ml-1 transition-transform ${expandedPlaylist ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </span>
                    </div>
                    {/* Collapsed view */}
                    {!expandedPlaylist && (
                       <div className="space-y-2 mt-2">
                        <p className="text-sm text-zinc-300">{experience.playlist.description || 'No description'}</p>
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <span>Genre: {experience.playlist.genre}</span>
                          <span>Theme: {experience.playlist.theme}</span>
                        </div>
                        {experience.playlist.url && (
                          <a 
                            href={experience.playlist.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-400 underline hover:text-blue-300 text-sm inline-block mt-2"
                          >
                            <span className="mr-1">🎵</span>Listen on Spotify
                          </a>
                        )}
                      </div>
                    )}

                    {/* Full details shown when expanded */}
                    <div className={`expandable-content ${expandedPlaylist ? 'expanded' : ''}`}>
                      {experience.playlist.url && (
                        <div className="mt-4 pt-4 border-t border-zinc-700/50">
                          {console.log('Attempting to embed Spotify URL:', experience.playlist.url)}
                          {getSpotifyPlaylistId(experience.playlist.url) ? (
                            <iframe 
                               src={`https://open.spotify.com/embed/playlist/${getSpotifyPlaylistId(experience.playlist.url)}?utm_source=generator`}
                               width="100%" 
                               height="352" 
                               frameBorder="0" 
                               allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                               loading="lazy">
                             </iframe>
                          ) : (
                            // Fallback to a link if playlist ID extraction fails
                            <div className="text-center py-4">
                              <p className="text-red-400 mb-2">Could not embed playlist preview.</p>
                              <a 
                                href={experience.playlist.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-400 underline hover:text-blue-300 text-sm inline-block"
                              >
                                <span className="mr-1">🎵</span>Listen on Spotify
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recipe Card */}
                <div className={`card card-recipe ${loadingStates.recipe ? 'animate-pulse' : ''} animate-floatUp col-span-1 md:col-span-1`} onClick={toggleRecipeExpand}>
                  <div className="space-y-4 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <h2 className="font-semibold text-xl">✨ {experience.recipe.title}</h2>
                      <span className="text-purple-400 text-sm flex items-center">
                        {expandedRecipe ? 'Show Less' : 'Show More'}
                        <svg className={`w-4 h-4 ml-1 transition-transform ${expandedRecipe ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </span>
                    </div>
                    {/* Collapsed view */}
                    {!expandedRecipe && (
                       <div className="space-y-2 mt-2">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {experience.recipe.ingredients.map((ing, i) => (
                            <span key={i} className="px-2 py-1 bg-zinc-700/50 rounded-full text-sm">
                              {ing}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-zinc-300">{experience.recipe.instructions}</p>
                      </div>
                    )}

                    {/* Full instructions shown when expanded */}
                    <div className={`expandable-content ${expandedRecipe ? 'expanded' : ''}`}>
                      <div className="mt-4 pt-4 border-t border-zinc-700/50">
                        <h3 className="font-semibold text-lg mb-2">Instructions:</h3>
                        <pre className="whitespace-pre-wrap text-sm text-zinc-200">{experience.recipe.instructions}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Movie Card */}
                <div className={`card card-movie ${loadingStates.movie ? 'animate-pulse' : ''} animate-floatUp col-span-1 md:col-span-1`} onClick={toggleMovieExpand}>
                  <div className="space-y-4 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <h2 className="font-semibold text-xl">🎬 {experience.movie.title} ({experience.movie.year})</h2>
                      <span className="text-purple-400 text-sm flex items-center">
                        {expandedMovie ? 'Show Less' : 'Show More'}
                        <svg className={`w-4 h-4 ml-1 transition-transform ${expandedMovie ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </span>
                    </div>
                    {/* Collapsed view */}
                    {!expandedMovie && (
                      <div className="space-y-2 mt-2">
                        <p className="text-sm text-zinc-300">{experience.movie.description}</p>
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <span>Genre: {experience.movie.genre}</span>
                          <span>Streaming: {experience.movie.streaming}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {expandedMovie && (
                    <div className={`expandable-content ${expandedMovie ? 'expanded' : ''}`}>
                      <div className="mt-4 pt-4 border-t border-zinc-700/50">
                        <p className="text-sm text-zinc-300">{experience.movie.description}</p>
                        <div className="flex items-center gap-2 text-sm text-zinc-400 mt-2">
                          <span className="font-semibold">Genre:</span> {experience.movie.genre}
                          <span className="font-semibold">Streaming:</span> {experience.movie.streaming}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Color Palette Card */}
                <div className={`card card-colorPalette ${loadingStates.colorPalette ? 'animate-pulse' : ''} animate-floatUp col-span-1 md:col-span-1`} onClick={toggleColorPaletteExpand}>
                  <div className="space-y-4 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <h2 className="font-semibold text-xl">🎨 {experience.colorPalette.name}</h2>
                      <span className="text-purple-400 text-sm flex items-center">
                        {expandedColorPalette ? 'Show Less' : 'Show More'}
                        <svg className={`w-4 h-4 ml-1 transition-transform ${expandedColorPalette ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </span>
                    </div>
                    {/* Collapsed view */}
                    {!expandedColorPalette && (
                       <div className="flex gap-4 mt-2">
                        {experience.colorPalette.colors.map((color, i) => (
                          <div key={i} className="flex flex-col items-center gap-2">
                            <div 
                              className="w-16 h-16 rounded-full transition-transform hover:scale-110" 
                              style={{ backgroundColor: color.hex }}
                            />
                            <p className="text-sm text-center">
                              {color.name}<br/>
                              <span className="text-xs text-zinc-400">{color.hex}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {expandedColorPalette && (
                    <div className={`expandable-content ${expandedColorPalette ? 'expanded' : ''}`}>
                      <div className="mt-4 pt-4 border-t border-zinc-700/50">
                        <div className="flex flex-wrap gap-4">
                          {experience.colorPalette.colors.map((color, i) => (
                            <div key={i} className="flex flex-col items-center gap-2">
                              <div 
                                className="w-20 h-20 rounded-full transition-transform hover:scale-110" 
                                style={{ backgroundColor: color.hex }}
                              />
                              <p className="text-base font-medium text-center">
                                <span className="font-semibold">{color.name}</span><br/>
                                <span className="text-sm text-zinc-400">{color.hex}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                        {/* Add color palette description */}
                        {experience.colorPalette.description && (
                           <p className="text-sm text-zinc-300 mt-4">{experience.colorPalette.description}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Meditation Card */}
                <div className={`card card-meditation ${loadingStates.meditation ? 'animate-pulse' : ''} animate-floatUp col-span-1 md:col-span-1`} onClick={toggleMeditationExpand}>
                  <div className="space-y-4 cursor-pointer">
                     <div className="flex justify-between items-center">
                      <h2 className="font-semibold text-xl">🧘‍♀️ Mini Meditation</h2>
                      <span className="text-purple-400 text-sm flex items-center">
                        {expandedMeditation ? 'Show Less' : 'Show More'}
                        <svg className={`w-4 h-4 ml-1 transition-transform ${expandedMeditation ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </span>
                    </div>
                    {/* Collapsed view */}
                    {!expandedMeditation && (
                      <div className="space-y-2 mt-2">
                        <p className="text-sm text-zinc-300">{experience.meditation.prompt}</p>
                        <p className="text-sm text-zinc-400"><span className="font-semibold">Duration:</span> {experience.meditation.duration}</p>
                      </div>
                    )}
                  </div>
                  {expandedMeditation && (
                    <div className={`expandable-content ${expandedMeditation ? 'expanded' : ''}`}>
                      <div className="mt-4 pt-4 border-t border-zinc-700/50">
                        <p className="text-sm text-zinc-300">{experience.meditation.prompt}</p>
                        <p className="text-sm text-zinc-400 mt-2"><span className="font-semibold">Duration:</span> {experience.meditation.duration}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Outfit Card */}
                <div className={`card card-outfit ${loadingStates.outfit ? 'animate-pulse' : ''} animate-floatUp col-span-1 md:col-span-1`} onClick={toggleOutfitExpand}>
                  <div className="space-y-4 cursor-pointer">
                     <div className="flex justify-between items-center">
                      <h2 className="font-semibold text-xl">👕 Style Suggestion</h2>
                      <span className="text-purple-400 text-sm flex items-center">
                        {expandedOutfit ? 'Show Less' : 'Show More'}
                        <svg className={`w-4 h-4 ml-1 transition-transform ${expandedOutfit ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </span>
                    </div>
                    {/* Collapsed view */}
                    {!expandedOutfit && (
                      <div className="space-y-2 mt-2">
                        <p className="text-sm text-zinc-300">{experience.outfit.description}</p>
                        <div className="flex flex-wrap gap-2 text-sm text-zinc-400">
                          <span className="font-semibold">Season:</span> {experience.outfit.season}
                          <span className="font-semibold">Style:</span> {experience.outfit.style}
                          <span className="font-semibold">Colors:</span> {experience.outfit.colors.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                  {expandedOutfit && (
                    <div className={`expandable-content ${expandedOutfit ? 'expanded' : ''}`}>
                       <div className="mt-4 pt-4 border-t border-zinc-700/50">
                          <div className="space-y-2">
                            <p className="text-sm text-zinc-300">{experience.outfit.description}</p>
                            <div className="flex flex-wrap gap-2 text-sm text-zinc-400 mt-2">
                              <span className="font-semibold">Season:</span> {experience.outfit.season}
                              <span className="font-semibold">Style:</span> {experience.outfit.style}
                              <span className="font-semibold">Colors:</span> {experience.outfit.colors.join(', ')}
                            </div>
                          </div>
                        </div>
                    </div>
                  )}
                </div>

                {/* Writing Card */}
                <div className={`card card-writing ${loadingStates.writing ? 'animate-pulse' : ''} animate-floatUp col-span-1 md:col-span-1`} onClick={toggleWritingExpand}>
                  <div className="space-y-4 cursor-pointer">
                     <div className="flex justify-between items-center">
                      <h2 className="font-semibold text-xl">✍️ Creative Snippet</h2>
                      <span className="text-purple-400 text-sm flex items-center">
                        {expandedWriting ? 'Show Less' : 'Show More'}
                        <svg className={`w-4 h-4 ml-1 transition-transform ${expandedWriting ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </span>
                    </div>
                    {/* Collapsed view */}
                    {!expandedWriting && (
                      <div className="space-y-2 mt-2">
                        <p className="text-sm text-zinc-300">{experience.writing.snippet}</p>
                        <p className="text-sm text-zinc-400"><span className="font-semibold">Theme:</span> {experience.writing.theme}</p>
                      </div>
                    )}
                  </div>
                  {expandedWriting && (
                    <div className={`expandable-content ${expandedWriting ? 'expanded' : ''}`}>
                      <div className="mt-4 pt-4 border-t border-zinc-700/50">
                        <div className="space-y-2">
                          <p className="text-sm text-zinc-300">{experience.writing.snippet}</p>
                          <p className="text-sm text-zinc-400 mt-2"><span className="font-semibold">Theme:</span> {experience.writing.theme}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {history.length > 0 && (
              <div className="card">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">🔄 Past Vibe Cards</h3>
                    <button
                      onClick={clearHistory}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear History
                    </button>
                  </div>
                  {history.map((h, i) => (
                    <div 
                      key={h.id}
                      className="flex justify-between items-center p-4 border-b border-zinc-700/30 last:border-b-0 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      onClick={() => replayHistory(i)}
                    >
                      <div className="flex items-center">
                         {/* Add a small color swatch based on card type? Or mood color? */}
                        {/* For simplicity, let's add a colored border based on the first card type in the experience */}
                         <div className={`w-2 h-full mr-3 ${h.experience?.playlist ? 'bg-purple-600' : h.experience?.recipe ? 'bg-amber-600' : h.experience?.movie ? 'bg-red-600' : h.experience?.colorPalette ? 'bg-purple-600' : h.experience?.meditation ? 'bg-green-600' : h.experience?.outfit ? 'bg-blue-600' : h.experience?.writing ? 'bg-pink-600' : 'bg-zinc-600'}`}></div>
                        <div>
                          <p className="font-medium text-purple-400">{h.mood} {h.mood === 'excited' && '🌟'} {h.mood === 'calm' && '😌'} {h.mood === 'happy' && '😊'} {/* Add more emojis */}</p>
                          <p className="text-sm text-zinc-400">
                            {new Date(h.timestamp).toLocaleDateString()} - {h.experience?.playlist?.name || h.experience?.recipe?.title || h.experience?.movie?.title || 'Vibe Card'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App; 