import React, { useState, useEffect } from 'react';
import { Compass, Calendar, Wallet, MapPin, Loader2, Sparkles, Clock, Bookmark, FolderHeart, Trash2, Edit3, Check, X, Plus, Sun, Moon, LogIn, LogOut } from 'lucide-react';
import { auth, loginWithGoogle, logoutUser } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [user, setUser] = useState(null); 
  const [authLoading, setAuthLoading] = useState(true); 

  const [formData, setFormData] = useState({ destination: '', days: 3, budget: 'Standard', style: 'Mieszany' });
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [savedPlans, setSavedPlans] = useState([]);
  const [saveMessage, setSaveMessage] = useState(null);
  
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isEditing, setIsEditing] = useState(false);
  const [editablePlan, setEditablePlan] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSavedPlans();
    } else {
      setSavedPlans([]);
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const fetchSavedPlans = async () => {
    try {
      const response = await fetch(`/api/saved-plans?userId=${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        setSavedPlans(data);
      }
    } catch (err) {
      console.error('Nie udało się pobrać zapisanych planów:', err);
    }
  };

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      alert('Błąd logowania przez Google');
    }
  };

  const handleLogout = () => {
    if (window.confirm('Czy chcesz się wylogować?')) {
      logoutUser();
      setPlan(null);
      setSaveMessage(null);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPlan(null);
    setSaveMessage(null);
    setIsEditing(false);

    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Błąd podczas generowania planu.');
      const data = await response.json();
      setPlan(data);
    } catch (err) {
      setError(err.message || 'Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async () => {
    if (!plan || !user) return;
    try {
      const planWithUser = { ...plan, userId: user.uid };
      const response = await fetch('/api/save-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planWithUser),
      });
      if (response.ok) {
        setSaveMessage('Plan został przypisany do Twojego konta!');
        fetchSavedPlans();
      }
    } catch (err) {
      setSaveMessage('Nie udało się zapisać planu.');
    }
  };

  const handleDeletePlan = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Usunąć ten plan z Twojego konta?')) return;
    try {
      const response = await fetch(`/api/delete-plan/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchSavedPlans();
        if (plan && plan.id === id) setPlan(null);
      }
    } catch (err) {
      alert('Błąd usuwania.');
    }
  };

  const startEdit = () => {
    setEditablePlan(JSON.parse(JSON.stringify(plan)));
    setIsEditing(true);
  };

  const handleActivityChange = (dayIdx, actIdx, field, value) => {
    const updated = { ...editablePlan };
    updated.itinerary[dayIdx].activities[actIdx][field] = value;
    setEditablePlan(updated);
  };

  const handleRemoveActivity = (dayIdx, actIdx) => {
    const updated = { ...editablePlan };
    updated.itinerary[dayIdx].activities.splice(actIdx, 1);
    setEditablePlan(updated);
  };

  const handleAddActivity = (dayIdx) => {
    const updated = { ...editablePlan };
    updated.itinerary[dayIdx].activities.push({ time: '12:00', title: 'Nowa atrakcja', description: 'Opis...' });
    setEditablePlan(updated);
  };

  const saveEdit = async () => {
    try {
      const response = await fetch(`/api/update-plan/${editablePlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editablePlan),
      });
      if (response.ok) {
        const data = await response.json();
        setPlan(data.updatedPlan);
        setIsEditing(false);
        setSaveMessage('Zmiany zapisane!');
        fetchSavedPlans();
      }
    } catch (err) {
      alert('Błąd zapisu zmian.');
    }
  };

  const theme = {
    bg: darkMode ? '#0f172a' : '#f4f6f9',
    cardBg: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f8fafc' : '#1e293b',
    textMuted: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#cbd5e1',
    inputBg: darkMode ? '#0f172a' : '#ffffff',
    activityBorder: darkMode ? '#334155' : '#eff6ff',
    savedCardBg: darkMode ? '#111827' : '#f8fafc'
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: theme.bg, color: theme.text }}>
        <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={40} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', padding: '15px', boxSizing: 'border-box', transition: 'background-color 0.3s' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '650px', margin: '0 auto 25px auto', padding: '0 5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Compass size={32} color="#2563eb" />
          <div>
            <h1 style={{ color: theme.text, fontSize: '24px', margin: 0 }}>Travel Buddy AI</h1>
            <p style={{ color: theme.textMuted, fontSize: '13px', margin: 0 }}>Twój mobilny przewodnik</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setDarkMode(!darkMode)} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, color: darkMode ? '#f59e0b' : '#475569', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          {user ? (
            <button onClick={handleLogout} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, color: '#ef4444', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Wyloguj">
              <LogOut size={18} />
            </button>
          ) : (
            <button onClick={handleLogin} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <LogIn size={14} /> Zaloguj
            </button>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '650px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '25px' }}>
        
        {/* Tryb gościa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 5px' }}>
          {user ? (
            <>
              {user.photoURL && <img src={user.photoURL} alt="avatar" style={{ width: '30px', height: '30px', borderRadius: '50%' }} />}
              <span style={{ fontSize: '13px', color: theme.textMuted }}>Konto: <b style={{ color: theme.text }}>{user.displayName}</b></span>
            </>
          ) : (
            <span style={{ fontSize: '13px', color: '#f59e0b', backgroundColor: darkMode ? '#451a03' : '#fef3c7', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' }}>
              👀 Przeglądasz jako Gość (Zaloguj się, by zapisać)
            </span>
          )}
        </div>

        {/* Formularz */}
        <section style={{ backgroundColor: theme.cardBg, padding: '20px', borderRadius: '12px', border: darkMode ? `1px solid ${theme.border}` : 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}><MapPin size={16} /> Gdzie jedziemy?</label>
              <input type="text" name="destination" value={formData.destination} onChange={handleChange} placeholder="np. Paryż, Tokio, Krynica..." required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.text, boxSizing: 'border-box' }} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}><Calendar size={16} /> Liczba dni (1-14)</label>
                <input type="number" name="days" min="1" max="14" value={formData.days} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.text, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontWeight: '600', fontSize: '14px' }}>Budżet</label>
                  <select name="budget" value={formData.budget} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.text }}>
                    <option>Ekonomiczny</option>
                    <option>Standard</option>
                    <option>Premium</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: '600', fontSize: '14px' }}>Styl</label>
                  <select name="style" value={formData.style} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.text }}>
                    <option>Mieszany</option>
                    <option>Zwiedzanie</option>
                    <option>Natura/Aktywny</option>
                    <option>Kolarstwo</option>
                    <option>Bieganie</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                <button type="submit" disabled={loading} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'block', justifyContent: 'center', alignItems: 'center', gap: '10px', fontSize: '16px', margin:'0 auto', width: '30vh' }}>
                  {loading ? <><Loader2 style={{ animation: 'spin 1s linear infinite' }} /> Asystent AI...</> : <><Sparkles size={18} /> Wygeneruj plan</>}
                </button>
                </div>
          </form>
        </section>

        {error && <div style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>{error}</div>}

        {/* Aktualny plan - gość i zalogowany */}
        {plan && (
          <section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: theme.cardBg, padding: '15px', borderRadius: '12px', marginBottom: '15px', border: darkMode ? `1px solid ${theme.border}` : 'none' }}>
              <h2 style={{ color: theme.text, margin: 0, fontSize: '20px' }}>🗺️ {plan.destination}</h2>
              
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                {/* Przyciski */}
                {!user ? (
                  <button onClick={handleLogin} style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <LogIn size={16} /> Zaloguj przez Google, aby zapisać lub edytować
                  </button>
                ) : !plan.id ? (
                  <button onClick={handleSavePlan} style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <Bookmark size={16} /> Zapisz na moim koncie
                  </button>
                ) : !isEditing ? (
                  <button onClick={startEdit} style={{ flex: 1, background: '#f59e0b', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <Edit3 size={16} /> Edytuj plan
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button onClick={saveEdit} style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <Check size={16} /> Zachowaj zmiany
                    </button>
                    <button onClick={() => setIsEditing(false)} style={{ background: '#64748b', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {saveMessage && <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: darkMode ? '#14532d' : '#f0fdf4', color: darkMode ? '#bbf7d0' : '#166534', marginBottom: '15px', fontSize: '14px', textAlign: 'center' }}>{saveMessage}</div>}
            
            {plan.imageUrl && (
              <div style={{ width: '100%', height: '180px', borderRadius: '12px', overflow: 'hidden', marginBottom: '15px', border: darkMode ? `1px solid ${theme.border}` : 'none' }}>
                <img src={plan.imageUrl} alt={plan.destination} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            
            {(isEditing ? editablePlan : plan).itinerary.map((dayPlan, dayIdx) => (
              <div key={dayPlan.day} style={{ backgroundColor: theme.cardBg, padding: '15px', borderRadius: '12px', marginBottom: '15px', border: darkMode ? `1px solid ${theme.border}` : 'none' }}>
                <h3 style={{ color: '#2563eb', margin: '0 0 12px 0', fontSize: '16px' }}>Dzień {dayPlan.day}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {dayPlan.activities.map((activity, actIdx) => (
                    <div key={actIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: `3px solid ${theme.activityBorder}`, paddingLeft: '10px', position: 'relative' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', paddingRight: '30px' }}>
                          <button type="button" onClick={() => handleRemoveActivity(dayIdx, actIdx)} style={{ position: 'absolute', right: 0, top: 0, background: 'none', border: 'none', color: '#ef4444', padding: '4px' }}>
                            <X size={18} />
                          </button>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Clock size={14} color="#2563eb" />
                            <input type="text" value={activity.time} onChange={(e) => handleActivityChange(dayIdx, actIdx, 'time', e.target.value)} style={{ width: '70px', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }} />
                            <input type="text" value={activity.title} onChange={(e) => handleActivityChange(dayIdx, actIdx, 'title', e.target.value)} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: '14px', fontWeight: '600' }} />
                          </div>
                          <textarea value={activity.description} onChange={(e) => handleActivityChange(dayIdx, actIdx, 'description', e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: '13px', fontFamily: 'inherit' }} rows={2} />
                        </div>
                      ) : (
                        <>
                          <span style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> {activity.time}
                          </span>
                          <h4 style={{ margin: 0, fontSize: '15px', color: theme.text }}>{activity.title}</h4>
                          <p style={{ margin: 0, color: theme.textMuted, fontSize: '13px', lineHeight: '1.4' }}>{activity.description}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {isEditing && (
                  <button type="button" onClick={() => handleAddActivity(dayIdx)} style={{ marginTop: '15px', width: '100%', background: darkMode ? '#334155' : '#f1f5f9', color: theme.text, border: `1px dashed ${theme.border}`, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}>
                    <Plus size={14} /> Dodaj punkt programu
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Zapisane podróże - zalogowani */}
        {user && (
          <section style={{ backgroundColor: theme.cardBg, padding: '20px', borderRadius: '12px', border: darkMode ? `1px solid ${theme.border}` : 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px', color: theme.text, borderBottom: `2px solid ${darkMode ? '#334155' : '#f1f5f9'}`, paddingBottom: '10px', fontSize: '18px' }}>
              <FolderHeart color="#ec4899" /> Moje Podróże ({savedPlans.length})
            </h3>
            {savedPlans.length === 0 ? (
              <p style={{ color: theme.textMuted, fontSize: '13px', textAlign: 'center' }}>Brak zapisów. Stwórz coś ciekawego!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {savedPlans.map((saved) => (
                  <div key={saved.id} onClick={() => { setPlan(saved); setIsEditing(false); setSaveMessage(null); window.scrollTo({ top: 400, behavior: 'smooth' }); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.savedCardBg }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {saved.imageUrl && <img src={saved.imageUrl} alt={saved.destination} style={{ width: '45px', height: '45px', borderRadius: '6px', objectFit: 'cover' }} />}
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', color: theme.text }}>{saved.destination}</h4>
                        <p style={{ margin: 0, fontSize: '11px', color: theme.textMuted }}>{saved.daysCount} dni • {new Date(saved.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button onClick={(e) => handleDeletePlan(saved.id, e)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Podsumwanie - zalogowani*/}
        {user && (
          <section style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '12px', color: '#f8fafc', border: darkMode ? `1px solid ${theme.border}` : 'none' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8', borderBottom: '1px solid #334155', paddingBottom: '6px', fontSize: '14px' }}>🛡️ Monitor Twoich podróży</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
              <span>Plany ogółem: <b>{savedPlans.length}</b></span>
              <span>Dni łącznie: <b>{savedPlans.reduce((sum, p) => sum + Number(p.daysCount || 0), 0)}</b></span>
            </div>
          </section>
        )}

        <footer style={{ marginTop: '20px', padding: '20px 10px 10px 10px', borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'border-color 0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: '600', color: theme.text }}>
            <Compass size={14} color="#2563eb" /> 
            <span>Travel Buddy AI</span>
            <span style={{ fontSize: '10px', backgroundColor: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: '20px', marginLeft: '5px' }}>v1</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted, lineHeight: '1.4' }}>Zadbaj o wygodę swojej podróży ze wsparciem AI</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: theme.textMuted, opacity: 0.7 }}>&copy; {new Date().getFullYear()} @mr_cyclist</p>
        </footer>

      </main>
    </div>
  );
}

export default App;