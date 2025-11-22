import React, { useState } from 'react';
import './AIAgentPage.css';

const AIAgentPage = () => {
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState(null);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [imagePreview, setImagePreview] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('notes', notes);
    if (image) {
      formData.append('image', image);
    }

    try {
      const response = await fetch('/api/generate-description', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Błąd serwera');
      }

      const data = await response.json();
      setGeneratedTitle(data.title);
      setGeneratedDescription(data.description);
    } catch (error) {
      setError('Nie udało się wygenerować opisu. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-agent-page">
      <h1>Agent AI do generowania opisów</h1>
      <div className="form-container">
        <input type="file" accept="image/*" onChange={handleImageChange} />
        {imagePreview && <img src={imagePreview} alt="Podgląd" className="image-preview" />}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Wpisz uwagi dotyczące produktu (np. stan, marka, kolor, rozmiar)"
          rows="5"
        />
        <button onClick={handleGenerate} disabled={isLoading}>
          {isLoading ? 'Generowanie...' : 'Generuj opis'}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      {isLoading && (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Generowanie odpowiedzi...</p>
        </div>
      )}

      {generatedTitle && !isLoading && (
        <div className="generated-content">
          <div className="generated-item">
            <h2>Wygenerowany tytuł:</h2>
            <div className="copy-container">
              <p>{generatedTitle}</p>
              <button onClick={() => navigator.clipboard.writeText(generatedTitle)}>Kopiuj</button>
            </div>
          </div>
          <div className="generated-item">
            <h2>Wygenerowany opis:</h2>
            <div className="copy-container">
              <p>{generatedDescription}</p>
              <button onClick={() => navigator.clipboard.writeText(generatedDescription)}>Kopiuj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAgentPage;
