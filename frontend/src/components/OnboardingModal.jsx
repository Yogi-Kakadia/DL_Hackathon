import React, { useState } from 'react';
import { API_BASE } from '../config';

const CATEGORIES = [
  "news", "finance", "sports", "entertainment", "music", "movies", 
  "health", "lifestyle", "foodanddrink", "travel", "autos"
];

export default function OnboardingModal({ onComplete }) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    location: '',
    demographics: 'Other',
    interests: []
  });
  
  const [loading, setLoading] = useState(false);

  const toggleInterest = (cat) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(cat)
        ? prev.interests.filter(i => i !== cat)
        : [...prev.interests, cat]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.interests.length === 0) {
      alert("Please provide at least your name and one interest.");
      return;
    }
    setLoading(true);
    
    const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    
    // Store in backend
    try {
      await fetch(`${API_BASE}/user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          name: formData.name,
          age: parseInt(formData.age || 0, 10),
          location: formData.location || 'Unknown',
          demographics: formData.demographics,
          interests: formData.interests
        })
      });
    } catch (err) {
      console.error("Failed to register user to backend", err);
    }
    
    // Store locally
    localStorage.setItem('hpe_user_profile', JSON.stringify({
        ...formData,
        user_id: userId
    }));
    
    setLoading(false);
    onComplete(userId, formData.name);
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <h1 className="onboarding-title">Welcome to HyperFeed</h1>
        <p className="onboarding-subtitle">Tell us about yourself so we can tailor the initial engine exactly to you.</p>
        
        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input 
                type="text" 
                placeholder="Ashish"
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                disabled={loading}
              />
            </div>
            <div className="form-group small">
              <label>Age</label>
              <input 
                type="number" 
                placeholder="24"
                min="10" max="100"
                value={formData.age} 
                onChange={(e) => setFormData({...formData, age: e.target.value})} 
                disabled={loading}
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Location</label>
              <input 
                type="text" 
                placeholder="New York, USA"
                value={formData.location} 
                onChange={(e) => setFormData({...formData, location: e.target.value})} 
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Demographics</label>
              <select 
                value={formData.demographics} 
                onChange={(e) => setFormData({...formData, demographics: e.target.value})}
                disabled={loading}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>Select Seed Interests</label>
            <div className="interests-grid">
              {CATEGORIES.map(cat => (
                <button
                  type="button"
                  key={cat}
                  className={`interest-btn ${formData.interests.includes(cat) ? 'selected' : ''}`}
                  onClick={() => toggleInterest(cat)}
                  disabled={loading}
                >
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="onb-submit-btn" disabled={loading || !formData.name || formData.interests.length === 0}>
            {loading ? 'Initializing Agent...' : 'Generate Neural Profile'} →
          </button>
        </form>
      </div>
    </div>
  );
}
