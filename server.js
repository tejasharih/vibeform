import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';
import process from 'process';

// Load environment variables with path
const envPath = '.env';
try {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('Successfully loaded .env file');
  }
} catch (error) {
  console.error('Failed to load .env file:', error);
}

// Verify environment variables are loaded
console.log('Environment Variables Loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ? '***' + process.env.SPOTIFY_CLIENT_ID.slice(-3) : 'MISSING',
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET ? '***' + process.env.SPOTIFY_CLIENT_SECRET.slice(-3) : 'MISSING',
  GROQ_KEY: process.env.GROQ_KEY ? '***' + process.env.GROQ_KEY.slice(-3) : 'MISSING',
  CWD: process.cwd()
});

// Log all environment variables (without sensitive values)
console.log('All environment variables:', Object.keys(process.env).filter(k => !k.toLowerCase().includes('secret') && !k.toLowerCase().includes('key') && !k.toLowerCase().includes('token')));

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins in development
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST'],
  credentials: true
};

console.log('CORS configuration:', corsOptions);
app.use(cors(corsOptions));
app.use(express.json());

// Spotify API configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

// Validate required environment variables
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('Missing required environment variables: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET');
  process.exit(1);
}

if (!process.env.GROQ_KEY) {
  console.error('Missing required environment variable: GROQ_KEY');
  process.exit(1);
}

// Get Spotify access token
async function getSpotifyToken() {
  try {
    console.log('Getting Spotify token...');
    console.log('Using Client ID:', SPOTIFY_CLIENT_ID ? `${SPOTIFY_CLIENT_ID.substring(0, 5)}...${SPOTIFY_CLIENT_ID.substring(SPOTIFY_CLIENT_ID.length - 3)}` : 'MISSING');
    
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      console.error('Missing Spotify credentials');
      throw new Error('Missing Spotify API credentials');
    }

    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    console.log('Sending token request to Spotify...');
    
    const response = await axios.post(SPOTIFY_TOKEN_URL, 'grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 5000 // 5 second timeout
    });
    
    console.log('Spotify API Response Status:', response.status);
    
    if (!response.data || !response.data.access_token) {
      console.error('Invalid response from Spotify API:', response.data);
      throw new Error('Invalid response from Spotify API: No access token received');
    }
    
    console.log('Successfully obtained Spotify token');
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Spotify token:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config
    });
    throw new Error(`Failed to get Spotify token: ${error.message}`);
  }
}

// Search for playlists
app.get('/api/playlist', async (req, res) => {
  try {
    console.log('Playlist request received:', req.query);
    const { mood } = req.query;
    if (!mood) {
      return res.status(400).json({ error: 'Mood is required' });
    }

    console.log('Searching for playlist with mood:', mood);
    
    const token = await getSpotifyToken();
    console.log('Successfully obtained Spotify token');

    // Format the mood for better search results
    const formattedMood = mood.toLowerCase()
      .replace(/[^a-z\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Remove extra spaces
      .trim();

    // Try multiple search strategies
    const searchQueries = [
      // Try mood + playlist
      `${formattedMood} playlist`,
      // Try mood + vibe
      `${formattedMood} vibe playlist`,
      // Try mood + mood
      `${formattedMood} ${formattedMood} playlist`,
      // Try mood + feel
      `${formattedMood} feel playlist`
    ];

    let playlist;
    for (const query of searchQueries) {
      try {
        const searchResponse = await axios.get(`${SPOTIFY_API_URL}/search`, {
          params: {
            q: query,
            type: 'playlist',
            limit: 5
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (searchResponse.data?.playlists?.items?.length > 0) {
          playlist = searchResponse.data.playlists.items[0];
          break;
        }
      } catch (error) {
        console.error(`Error searching with query "${query}":`, error.message);
      }
    }

    if (!playlist) {
      console.log('No playlists found after multiple search attempts');
      return res.status(404).json({ 
        error: 'No playlists found. Try a different mood or check back later.' 
      });
    }

    // If we found a playlist, return it
    try {
      const playlistData = {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        external_urls: playlist.external_urls,
        images: playlist.images,
        owner: playlist.owner
      };
      return res.json({ playlist: playlistData });
    } catch (error) {
      console.error('Error returning playlist:', error);
      return res.status(500).json({
        error: 'Failed to process playlist data'
      });
    }

    // Validate playlist data
    if (!selectedPlaylist || !selectedPlaylist.name || !selectedPlaylist.external_urls?.spotify) {
      console.error('Invalid playlist data:', selectedPlaylist);
      throw new Error('Invalid playlist data received from Spotify');
    }

    // Generate mood description
    try {
      console.log('Generating mood description for:', mood);
      const moodResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama3-8b-8192',
          messages: [
            {
              role: 'system',
              content: 'You are a creative mood describer. Generate a short, engaging description of what this mood feels like and what kind of music would suit it. Keep it under 100 words.'
            },
            {
              role: 'user',
              content: `Describe the mood: ${mood}`
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_KEY}`
          }
        }
      );

      if (!moodResponse.data || !moodResponse.data.choices || !moodResponse.data.choices[0]) {
        throw new Error('Invalid response from Groq API - no choices found');
      }

      const moodDesc = moodResponse.data.choices[0].message.content;
      console.log('Generated mood description:', moodDesc);

      // Only use the mood description if the playlist doesn't have one
      const finalDescription = selectedPlaylist.description 
        ? selectedPlaylist.description 
        : moodDesc;

      // Log the final playlist data before sending
      console.log('Sending playlist response:', {
        name: selectedPlaylist.name,
        description: finalDescription,
        url: selectedPlaylist.external_urls.spotify,
        moodDescription: moodDesc
      });

      return res.status(200).json({
        name: selectedPlaylist.name,
        description: finalDescription,
        url: selectedPlaylist.external_urls.spotify,
        moodDescription: moodDesc
      });

    } catch (error) {
      console.error('Error generating mood description:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
      throw new Error(`Failed to generate mood description: ${error.message}`);
    }

  } catch (error) {
    console.error('Error in playlist endpoint:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config
    });
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        error: 'Unauthorized - Please check your API credentials'
      });
    }
    return res.status(500).json({
      error: 'Failed to fetch playlist. Please try again later.'
    });
  }
});

// Generate experience using Groq
app.get('/api/experience', async (req, res) => {
  console.log('Experience endpoint called with:', {
    query: req.query,
    headers: req.headers
  });

  try {
    // Validate mood
    const mood = req.query.mood;
    if (!mood || typeof mood !== 'string') {
      console.error('Invalid mood:', {
        value: mood,
        type: typeof mood
      });
      return res.status(400).json({ 
        error: 'Mood is required and must be a string',
        details: 'Please provide a valid mood parameter'
      });
    }

    // Parse ingredients safely
    let ingredients = [];
    try {
      if (req.query.ingredients) {
        ingredients = JSON.parse(req.query.ingredients);
        if (!Array.isArray(ingredients)) {
          throw new Error('Ingredients must be an array');
        }
      }
    } catch (error) {
      console.error('Error parsing ingredients:', error);
      return res.status(400).json({
        error: 'Invalid ingredients format',
        details: 'Ingredients must be a valid JSON array'
      });
    }

    const longMode = req.query.longMode === 'true'; // Get longMode parameter

    // Generate experience using Groq
    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: `You are a creative experience generator that strictly follows instructions.
            Generate a complete vibe card based on the user's mood and available ingredients.
            You MUST return ONLY a JSON object with the following structure and no other text:
            {
              "playlist": {
                "name": "string",
                "description": "string",
                "genre": "string",
                "theme": "string",
                "url": "string"
              },
              "recipe": {
                "title": "string",
                "ingredients": ["string"],
                "instructions": "string"
              },
              "movie": {
                "title": "string",
                "year": "number",
                "description": "string",
                "genre": "string",
                "streaming": "string"
              },
              "colorPalette": {
                "name": "string",
                "colors": [
                  {
                    "name": "string",
                    "hex": "string"
                  }
                ]
              },
              "meditation": {
                "prompt": "string",
                "duration": "string"
              },
              "outfit": {
                "description": "string",
                "season": "string",
                "style": "string",
                "colors": ["string"]
              },
              "writing": {
                "snippet": "string",
                "theme": "string"
              }
            }
            
            ${longMode ? 
              `For the recipe, generate a complete creative recipe, with a fun name, a detailed list of at least 7 ingredients, and 7+ well-written cooking steps. Include serving suggestions and optional toppings.
              For the movie, recommend a movie matching the mood with a detailed 3-4 sentence synopsis, the genre, streaming platform, and a deep explanation of why this movie fits the mood emotionally.
              For the meditation, write a 7-10 sentence mini meditation script, with vivid calming imagery and specific breathing cues appropriate for the mood and duration.
              For the color palette, include a detailed mood-based description of the color scheme and when/where someone might feel inspired by it, mentioning the emotional impact of the colors.
              For the outfit, give a full outfit suggestion with 2-3 sentences on why it fits the mood and occasion, including specific clothing items, textures, and accessories.
              For the writing snippet, provide a 6-8 sentence micro-poem or story excerpt that deeply emotionally resonates with the mood and strongly matches the tone (motivational, romantic, nostalgic, etc.), focusing on evocative language.` 
              : 
              `Keep descriptions concise, under 3 sentences for movie, meditation, outfit, and writing snippet. For the recipe, provide a brief summary and a short list of key ingredients and steps.`
            }`
          },
          {
            role: 'user',
            content: `Generate a vibe card for mood: "${mood}"${ingredients.length ? ` with ingredients: ${ingredients.join(', ')}` : ''}`
          }
        ],
        temperature: 0.7,
        max_tokens: longMode ? 3000 : 2000 // Increase max tokens for long mode
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Validate and parse Groq response
    if (!groqResponse.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from Groq API');
    }

    let experience;
    try {
      experience = JSON.parse(groqResponse.data.choices[0].message.content);
    } catch (error) {
      console.error('Error parsing Groq response:', error);
      throw new Error('Failed to parse AI response');
    }

    // Validate experience structure
    const requiredSections = ['playlist', 'recipe', 'movie', 'colorPalette', 'meditation', 'outfit', 'writing'];
    for (const section of requiredSections) {
      if (!experience[section]) {
        throw new Error(`Missing required section: ${section}`);
      }
    }

    // Get Spotify playlist using direct API call instead of recursive endpoint
    try {
      const token = await getSpotifyToken();
      const playlistSearch = await axios.get(`${SPOTIFY_API_URL}/search`, {
        params: {
          q: `${mood} playlist`,
          type: 'playlist',
          limit: 1
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (playlistSearch.data?.playlists?.items?.[0]) {
        const playlist = playlistSearch.data.playlists.items[0];
        experience.playlist = {
          ...experience.playlist,
          name: playlist.name,
          description: playlist.description,
          url: playlist.external_urls.spotify,
          images: playlist.images
        };
      }
    } catch (error) {
      console.error('Error fetching playlist:', error);
      // Continue without playlist data
    }

    return res.status(200).json(experience);

  } catch (error) {
    console.error('Detailed error in experience endpoint:', {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config,
      name: error.name,
      cause: error.cause,
      environment: process.env.NODE_ENV,
      requestDetails: {
        mood: req.query.mood,
        ingredients: req.query.ingredients,
        headers: req.headers
      }
    });

    // Log the full error object
    console.error('Full error object:', error);

    // Handle specific error cases
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Unauthorized - Please check your API credentials'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded - Please try again later'
      });
    }

    // Handle Groq API specific errors
    if (error.message?.includes('Groq')) {
      return res.status(500).json({
        error: 'Failed to generate experience. Please try again later.'
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch experience. Please try again later.',
      details: error.message
    });
  }
});

// Start the server
// Add error handling for server startup
app.on('error', (error) => {
  console.error('Server error:', error);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('API endpoints available at:');
  console.log(`http://localhost:${PORT}/api/experience`);
  console.log(`http://localhost:${PORT}/api/playlist`);
});

// Export app for testing
export default app;

// Global error handler
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 