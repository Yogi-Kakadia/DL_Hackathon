import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAttention } from './AttentionTracker';

const paragraphTemplates = [
  "In recent developments, {title} has taken center stage. Observers note that {abstract} This indicates a major shift in the current landscape of the {category} sector.",
  "Looking closely at the underlying trends, experts suggest that {keyword} has been a primary driver. In many ways, the sentiment echoes broader systemic transformations.",
  "What does this mean for the future? As highlighted earlier, {abstract} There's a growing consensus that adapting strategies will be crucial in the coming months.",
  "Financial analysts and specific domain commentators reflect cautious outlooks, albeit with notable caveats regarding generic {category} guidelines.",
  "Ultimately, the situation surrounding the core themes of this article remains highly fluid. Keeping a close eye on {keyword} will definitely provide deeper insights."
];

function generateParagraphs(article) {
  const keyword = article.title.split(' ')[0] || 'the subject';
  const abstract = article.abstract || 'the underlying metrics have changed.';
  return paragraphTemplates.map(t => 
    t.replace(/\{abstract\}/g, abstract)
     .replace(/\{category\}/g, article.category)
     .replace(/\{keyword\}/g, keyword)
     .replace(/\{title\}/g, article.title)
  );
}

export default function FullArticleReader({ article, onAction, onCancel }) {
  const attention = useAttention();
  const contentRef = useRef(null);
  
  const paragraphs = useMemo(() => generateParagraphs(article), [article]);
  
  // Telemetry state
  const [sectionTimes, setSectionTimes] = useState(new Array(paragraphs.length).fill(0));
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [maxScrollDepth, setMaxScrollDepth] = useState(0);
  
  // Timer ref to avoid stale closures
  const activeTimeRef = useRef(0);
  const sectionTimesRef = useRef(new Array(paragraphs.length).fill(0));
  const visibleIndexRef = useRef(0);

  // Intersection Observer to track visible paragraph
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      let maxRatio = 0;
      let maxIdx = visibleIndexRef.current;
      entries.forEach(entry => {
        if (entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          maxIdx = parseInt(entry.target.dataset.index, 10);
        }
      });
      if (maxRatio > 0) {
        setVisibleIndex(maxIdx);
        visibleIndexRef.current = maxIdx;
      }
    }, {
      root: contentRef.current,
      threshold: [0.3, 0.6, 0.9]
    });

    const elements = document.querySelectorAll('.ar-paragraph');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [paragraphs]);

  // Scroll depth tracking
  const handleScroll = (e) => {
    const depth = e.target.scrollTop + e.target.clientHeight;
    if (depth > maxScrollDepth) {
      setMaxScrollDepth(depth);
    }
  };

  // 100ms Telemetry Tick based on Vision Attention
  useEffect(() => {
    const interval = setInterval(() => {
      // If tracker is completely disabled, treat as always looking.
      // If tracker is enabled, only increment if literally looking at screen.
      const isActuallyReading = !attention.cameraEnabled || attention.isLooking;
      
      if (isActuallyReading) {
        // Increment global active time inside article
        activeTimeRef.current += 0.1;
        // Increment section specific time
        const newTimes = [...sectionTimesRef.current];
        newTimes[visibleIndexRef.current] += 0.1;
        sectionTimesRef.current = newTimes;
        
        // Batch update react state sparsely to avoid lag (every 1 sec)
        if (Math.round(activeTimeRef.current * 10) % 5 === 0) {
          setSectionTimes([...newTimes]);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [attention.cameraEnabled, attention.isLooking]);

  const handleAction = (actionKey) => {
    // Compile Payload
    const totalDwell = activeTimeRef.current;
    // Speed: Pixels per second. Or 0 if uncalculated.
    const scrollSpeed = totalDwell > 0 ? (maxScrollDepth / totalDwell) : 0;
    
    const payload = {
      action: actionKey,
      dwell_time: totalDwell,
      scroll_speed: Math.round(scrollSpeed),
      section_times: sectionTimesRef.current.map(t => Math.round(t * 10) / 10),
    };
    
    onAction(article.id, payload);
  };

  return (
    <div className="article-reader-overlay">
      <div className="article-reader-modal">
        <header className="ar-header">
          <div className="ar-meta">
            <span style={{ color: article.color || '#7c5cff', fontWeight: 600 }}>{article.category.toUpperCase()}</span>
            {attention.cameraEnabled && (
                <span className={`attention-badge ${attention.isLooking ? 'active' : 'inactive'}`}>
                  {attention.isLooking ? '👁️ Reading' : '🙈 Looking Away (Timer Paused)'}
                </span>
            )}
          </div>
          <button className="close-btn" onClick={onCancel}>✕ ESC</button>
        </header>
        
        <div className="ar-content" ref={contentRef} onScroll={handleScroll}>
          <h1 className="ar-title">{article.title}</h1>
          <hr className="ar-divider" />
          
          <div className="ar-body">
            {paragraphs.map((text, idx) => (
              <p 
                key={idx} 
                data-index={idx}
                className={`ar-paragraph ${idx === visibleIndex ? 'focused' : ''}`}
                style={{ 
                    opacity: idx === visibleIndex ? 1 : 0.6,
                    transition: 'opacity 0.3s ease'
                }}
              >
                {text}
                <span className="ar-telemetry-hint">
                  [{sectionTimes[idx].toFixed(1)}s dwell]
                </span>
              </p>
            ))}
          </div>
        </div>

        <footer className="ar-footer">
           <div className="ar-telemetry-summary">
             <div>Active Dwell: <strong>{activeTimeRef.current.toFixed(1)}s</strong></div>
             <div>Scroll Depth: <strong>{Math.round(maxScrollDepth)}px</strong></div>
           </div>
           <div className="ar-actions">
              <button className="action-btn skip" onClick={() => handleAction('skip')}>⏭️ Skip</button>
              <button className="action-btn dislike" onClick={() => handleAction('dislike')}>👎 Dislike</button>
              <button className="action-btn read" onClick={() => handleAction('read')}>✅ Done Reading</button>
              <button className="action-btn like" onClick={() => handleAction('like')}>👍 Like</button>
           </div>
        </footer>
      </div>
    </div>
  );
}
