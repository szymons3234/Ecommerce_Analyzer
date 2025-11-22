import React, { useState } from 'react';
import './AIAgentPage.css';

const AIModelPage = () => {
  const [image, setImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
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
    if (image) {
      formData.append('image', image);
    }

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Błąd serwera');
      }

      const data = await response.json();
      setGeneratedImage(data.imageUrl);
    } catch (error) {
      setError('Nie udało się wygenerować obrazu. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-agent-page">
      <h1>Agent AI do generowania zdjęć na modelu</h1>
      <div className="form-container">
        <input type="file" accept="image/*" onChange={handleImageChange} />
        {imagePreview && <img src={imagePreview} alt="Podgląd" className="image-preview" />}
        <button onClick={handleGenerate} disabled={isLoading}>
          {isLoading ? 'Generowanie...' : 'Generuj zdjęcie'}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      {isLoading && (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Generowanie odpowiedzi...</p>
        </div>
      )}

      {generatedImage && !isLoading && (
        <div className="generated-content">
          <div className="generated-item">
            <h2>Wygenerowane zdjęcie:</h2>
            <img src={generatedImage} alt="Wygenerowane zdjęcie" className="generated-image" />
          </div>
        </div>
      )}
    </div>
  );
};

export default AIModelPage;
