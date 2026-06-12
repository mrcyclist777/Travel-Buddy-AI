import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import pg from 'pg'; 
import path from 'path';
import { fileURLToPath } from 'url'; 
import { dirname } from 'path';      

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Połączenie z Neon.tech PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 1 
});

pool.connect()
  .then(() => console.log('Połączono pomyślnie z bazą PostgreSQL na Neon.tech!'))
  .catch(err => console.error('Błąd połączenia z Postgres:', err));


const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/plan', async (req, res) => {
  try {
    const { destination, days, budget, style } = req.body;

    if (!destination || !days) {
      return res.status(400).json({ error: 'Cel podróży i liczba dni są wymagane!' });
    }

    const prompt = `Stwórz szczegółowy plan podróży do: ${destination}. 
    Czas trwania: ${days} dni. 
    Budżet: ${budget || 'standardowy'}. 
    Styl podróży: ${style || 'mieszany'}.
    
    Odpowiedz WYŁĄCZNIE w formacie JSON (czysty obiekt, bez żadnego dodatkowego tekstu na początku i końcu).
    Struktura obiektu JSON musi być dokładnie taka:
    {
      "destination": "${destination}",
      "daysCount": ${days},
      "itinerary": [
        {
          "day": 1,
          "activities": [
            { "time": "09:00", "title": "Nazwa atrakcji", "description": "Opis atrakcji" }
          ]
        }
      ]
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Jesteś doświadczonym, profesjonalnym przewodnikiem turystycznym. Generujesz odpowiedzi tylko jako czysty format JSON.',
      }
    });

    let cleanText = response.text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7, cleanText.length - 3).trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3, cleanText.length - 3).trim();
    }

    const planJson = JSON.parse(cleanText);

    // UNSPLASH API
    const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
    let destinationImage = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200"; 

    try {
      const unsplashResponse = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(destination)}&per_page=1&orientation=landscape`,
        {
          headers: {
            Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`
          }
        }
      );

      if (unsplashResponse.ok) {
        const unsplashData = await unsplashResponse.json();
        if (unsplashData.results && unsplashData.results.length > 0) {
          destinationImage = unsplashData.results[0].urls.regular;
        }
      }
    } catch (photoError) {
      console.error("Błąd podczas pobierania zdjęcia z Unsplash:", photoError);
    }

    planJson.imageUrl = destinationImage;
    res.json(planJson);

  } catch (error) {
    console.error('BŁĄD BACKENDU:', error);
    res.status(500).json({ error: 'Wystąpił błąd serwera podczas generowania planu.' });
  }
});

app.post('/api/save-plan', async (req, res) => {
  try {
    const newPlan = req.body;
    if (!newPlan || !newPlan.destination) {
      return res.status(400).json({ error: 'Nieprawidłowe dane planu.' });
    }

    const query = `
      INSERT INTO travel_plans (user_id, destination, days_count, itinerary)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    
    const { userId, destination, daysCount, ...restDetails } = newPlan;

    const values = [
      userId || 'anonymous',
      destination,
      daysCount || 0,
      JSON.stringify(restDetails) 
    ];

    const result = await pool.query(query, values);
    const savedRow = result.rows[0];

    const responseData = {
      id: savedRow.id.toString(),
      createdAt: savedRow.created_at,
      userId: savedRow.user_id,
      destination: savedRow.destination,
      daysCount: savedRow.days_count,
      ...savedRow.itinerary
    };

    res.json({ success: true, message: 'Plan został pomyślnie zapisany!', savedPlan: responseData });
  } catch (error) {
    console.error('Błąd podczas zapisu do bazy:', error);
    res.status(500).json({ error: 'Nie udało się zapisać planu.' });
  }
});

app.get('/api/saved-plans', async (req, res) => {
  try {
    const { userId } = req.query; 

    if (!userId) {
      return res.status(400).json({ error: 'Brak zdefiniowanego identyfikatora użytkownika!' });
    }

    const query = 'SELECT * FROM travel_plans WHERE user_id = $1 ORDER BY created_at DESC;';
    const result = await pool.query(query, [userId]);

    const formattedPlans = result.rows.map(row => ({
      id: row.id.toString(),
      createdAt: row.created_at,
      userId: row.user_id,
      destination: row.destination,
      daysCount: row.days_count,
      ...row.itinerary
    }));

    res.json(formattedPlans);
  } catch (error) {
    console.error('Błąd podczas pobierania z bazy:', error);
    res.status(500).json({ error: 'Nie udało się pobrać zapisanych planów.' });
  }
});

app.delete('/api/delete-plan/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM travel_plans WHERE id = $1 RETURNING *;';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono planu o podanym ID.' });
    }
    
    res.json({ success: true, message: 'Plan został usunięty!' });
  } catch (error) {
    console.error('Błąd podczas usuwania z bazy:', error);
    res.status(500).json({ error: 'Nie udało się usunąć planu.' });
  }
});

app.put('/api/update-plan/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    
    const selectQuery = 'SELECT * FROM travel_plans WHERE id = $1;';
    const selectResult = await pool.query(selectQuery, [id]);

    if (selectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono planu do edycji.' });
    }

    const currentPlan = selectResult.rows[0];
    const { destination, daysCount, userId, ...restDetails } = updatedData;
    const newItinerary = { ...currentPlan.itinerary, ...restDetails };

    const updateQuery = `
      UPDATE travel_plans 
      SET destination = $1, days_count = $2, itinerary = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *;
    `;
    const values = [
      destination || currentPlan.destination,
      daysCount || currentPlan.days_count,
      JSON.stringify(newItinerary),
      id
    ];

    const updateResult = await pool.query(updateQuery, values);
    const updatedRow = updateResult.rows[0];

    const responsePlan = {
      id: updatedRow.id.toString(),
      createdAt: updatedRow.created_at,
      updatedAt: updatedRow.updated_at,
      userId: updatedRow.user_id,
      destination: updatedRow.destination,
      daysCount: updatedRow.days_count,
      ...updatedRow.itinerary
    };
    
    res.json({ success: true, message: 'Plan został zaktualizowany!', updatedPlan: responsePlan });
  } catch (error) {
    console.error('Błąd podczas aktualizacji bazy:', error);
    res.status(500).json({ error: 'Nie udało się zaktualizować planu.' });
  }
});

app.use(express.static(path.join(__dirname, '../client/dist')));

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  }
  next();
});


if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Sukces! Serwer TravelBuddy AI działa lokalnie na porcie: ${PORT}`);
  });
}

export default app;