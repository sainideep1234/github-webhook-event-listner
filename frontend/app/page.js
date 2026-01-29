'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const POLLING_INTERVAL = 15000; // 15 seconds

// Format timestamp to readable format
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const options = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  };
  
  // Get ordinal suffix for day
  const day = date.getDate();
  const suffix = ['th', 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10) * (day % 10)];
  
  const formatted = date.toLocaleString('en-US', options);
  return formatted.replace(/(\d+)/, `$1${suffix}`);
}

// Format event message based on type
function formatEventMessage(event) {
  const timestamp = formatTimestamp(event.timestamp);
  
  switch (event.event_type) {
    case 'push':
      return {
        action: 'pushed to',
        to_branch: event.to_branch || 'unknown',
        from_branch: null,
        timestamp,
        icon: '→',
        type: 'push'
      };
    case 'pull_request':
      return {
        action: 'submitted a pull request from',
        from_branch: event.from_branch || 'unknown',
        to_branch: event.to_branch || 'unknown',
        timestamp,
        icon: '↗',
        type: 'pull_request'
      };
    case 'merge':
      return {
        action: 'merged branch',
        from_branch: event.from_branch || 'unknown',
        to_branch: event.to_branch || 'unknown',
        timestamp,
        icon: '⊕',
        type: 'merge'
      };
    default:
      return {
        action: 'performed action on',
        from_branch: null,
        to_branch: event.repository,
        timestamp,
        icon: '•',
        type: 'unknown'
      };
  }
}

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [countdown, setCountdown] = useState(15);

  // Fetch events from backend
  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/webhook/events?limit=50`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setEvents(data.events || []);
      setLastUpdated(new Date());
      setError(null);
      setConnectionStatus('connected');
      setCountdown(15);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err.message);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling setup
  useEffect(() => {
    fetchEvents();
    
    const pollInterval = setInterval(fetchEvents, POLLING_INTERVAL);
    
    return () => clearInterval(pollInterval);
  }, [fetchEvents]);

  // Countdown timer
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 15));
    }, 1000);
    
    return () => clearInterval(countdownInterval);
  }, []);

  // Group events by date
  const groupedEvents = events.reduce((groups, event) => {
    const date = new Date(event.timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {});

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logoSection}>
            <div className={styles.logo}>
              <svg viewBox="0 0 24 24" fill="currentColor" className={styles.githubIcon}>
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </div>
            <div>
              <h1 className={styles.title}>Webhook Dashboard</h1>
              <p className={styles.subtitle}>Real-time GitHub activity monitor</p>
            </div>
          </div>
          
          <div className={styles.statusSection}>
            <div className={`${styles.statusIndicator} ${styles[connectionStatus]}`}>
              <span className={styles.statusDot}></span>
              <span className={styles.statusText}>
                {connectionStatus === 'connected' ? 'Live' : 
                 connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
            <div className={styles.refreshInfo}>
              <span className={styles.countdown}>Refresh in {countdown}s</span>
              <button onClick={fetchEvents} className={styles.refreshButton} disabled={loading}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{events.length}</span>
          <span className={styles.statLabel}>Total Events</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.pushColor}`}>
            {events.filter(e => e.event_type === 'push').length}
          </span>
          <span className={styles.statLabel}>Pushes</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.prColor}`}>
            {events.filter(e => e.event_type === 'pull_request').length}
          </span>
          <span className={styles.statLabel}>Pull Requests</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.mergeColor}`}>
            {events.filter(e => e.event_type === 'merge').length}
          </span>
          <span className={styles.statLabel}>Merges</span>
        </div>
      </div>

      {/* Main Content */}
      <main className={styles.main}>
        {loading && events.length === 0 ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading events...</p>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>⚠</div>
            <h3>Connection Error</h3>
            <p>{error}</p>
            <button onClick={fetchEvents} className={styles.retryButton}>
              Retry Connection
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12h6M12 9v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3>No Events Yet</h3>
            <p>Push some code, open a PR, or merge a branch to see events here.</p>
          </div>
        ) : (
          <div className={styles.timeline}>
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date} className={styles.dateGroup}>
                <div className={styles.dateHeader}>
                  <span className={styles.dateLine}></span>
                  <span className={styles.dateText}>{date}</span>
                  <span className={styles.dateLine}></span>
                </div>
                
                <div className={styles.eventsList}>
                  {dateEvents.map((event, index) => {
                    const formatted = formatEventMessage(event);
                    return (
                      <div 
                        key={event._id} 
                        className={styles.eventCard}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className={`${styles.eventIcon} ${styles[formatted.type]}`}>
                          <span>{formatted.icon}</span>
                        </div>
                        
                        <div className={styles.eventContent}>
                          <div className={styles.eventMessage}>
                            <span className={styles.author}>{event.author}</span>
                            <span className={styles.action}> {formatted.action} </span>
                            {formatted.from_branch && (
                              <>
                                <span className={styles.branch}>{formatted.from_branch}</span>
                                <span className={styles.action}> to </span>
                              </>
                            )}
                            <span className={styles.branch}>{formatted.to_branch}</span>
                          </div>
                          
                          <div className={styles.eventMeta}>
                            <span className={styles.timestamp}>{formatted.timestamp}</span>
                            {event.repository && (
                              <span className={styles.repo}>
                                <svg viewBox="0 0 16 16" fill="currentColor">
                                  <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z"/>
                                </svg>
                                {event.repository}
                              </span>
                            )}
                          </div>
                          
                          {event.message && (
                            <div className={styles.commitMessage}>
                              <span className={styles.messageQuote}>"</span>
                              {event.message}
                              <span className={styles.messageQuote}>"</span>
                            </div>
                          )}
                        </div>
                        
                        <div className={`${styles.eventType} ${styles[formatted.type]}`}>
                          {event.event_type.replace('_', ' ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p>
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
          </p>
          <p className={styles.footerBrand}>
            GitHub Webhook Dashboard • Built with Next.js
          </p>
        </div>
      </footer>
    </div>
  );
}
