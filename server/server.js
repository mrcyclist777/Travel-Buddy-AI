import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Inicjalizacja klienta Gemini AI
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
      model: 'gemini-flash-latest',
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
    const UNSPLASH_ACCESS_KEY = "qHotu62xlMHthF3y16oP7scY_Cxjk6vLnKrjBrHIWv8";
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

const DATABASE_FILE = path.join(process.cwd(), 'baza_podrozy.json');

const readDatabase = () => {
  if (!fs.existsSync(DATABASE_FILE)) {
    return [];
  }
  const data = fs.readFileSync(DATABASE_FILE, 'utf8');
  return JSON.parse(data || '[]');
};

const writeDatabase = (data) => {
  fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 2), 'utf8');
};

// Zapis planu
app.post('/api/save-plan', (req, res) => {
  try {
    const newPlan = req.body;
    if (!newPlan || !newPlan.destination) {
      return res.status(400).json({ error: 'Nieprawidłowe dane planu.' });
    }

    const db = readDatabase();
    const planToSave = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...newPlan
    };

    db.push(planToSave);
    writeDatabase(db);

    res.json({ success: true, message: 'Plan został pomyślnie zapisany!', savedPlan: planToSave });
  } catch (error) {
    console.error('Błąd podczas zapisu do bazy:', error);
    res.status(500).json({ error: 'Nie udało się zapisać planu.' });
  }
});

// Pobieranie planów po ID użytkownika (Firebase UID)
app.get('/api/saved-plans', (req, res) => {
  try {
    const { userId } = req.query; 

    if (!userId) {
      return res.status(400).json({ error: 'Brak zdefiniowanego identyfikatora użytkownika!' });
    }

    const db = readDatabase();
    const userPlans = db.filter(plan => plan.userId === userId);
    res.json(userPlans);
  } catch (error) {
    console.error('Błąd podczas pobierania z bazy:', error);
    res.status(500).json({ error: 'Nie udało się pobrać zapisanych planów.' });
  }
});

// Usuwanie planu po ID
app.delete('/api/delete-plan/:id', (req, res) => {
  try {
    const { id } = req.params;
    let db = readDatabase();
    const initialLength = db.length;
    db = db.filter(plan => plan.id !== id);
    
    if (db.length === initialLength) {
      return res.status(404).json({ error: 'Nie znaleziono planu o podanym ID.' });
    }
    
    writeDatabase(db);
    res.json({ success: true, message: 'Plan został usunięty!' });
  } catch (error) {
    console.error('Błąd podczas usuwania z bazy:', error);
    res.status(500).json({ error: 'Nie udało się usunąć planu.' });
  }
});

// Aktualizacja istniejącego planu
app.put('/api/update-plan/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    let db = readDatabase();
    
    const index = db.findIndex(plan => plan.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Nie znaleziono planu do edycji.' });
    }
    
    db[index] = { ...db[index], ...updatedData, updatedAt: new Date().toISOString() };
    writeDatabase(db);
    
    res.json({ success: true, message: 'Plan został zaktualizowany!', updatedPlan: db[index] });
  } catch (error) {
    console.error('Błąd podczas aktualizacji bazy:', error);
    res.status(500).json({ error: 'Nie udało się zaktualizować planu.' });
  }
});

// SERWOWANIE PLIKÓW STATYCZNYCH (Bezpieczny Middleware unika błędów path-to-regexp)
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Sukces! Serwer TravelBuddy AI działa na porcie: ${PORT}`);
});