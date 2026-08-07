import React, { useState, useEffect, useRef } from 'react';
import Splash from './components/Splash';
import LoginModal from './components/LoginModal';
import EmergencyContactModal from './components/EmergencyContactModal';
import TopHeader from './components/TopHeader';
import MapView from './components/MapView';
import ReportModal from './components/ReportModal';
import ZoneDetailModal from './components/ZoneDetailModal';
import RoutePanel from './components/RoutePanel';
import SosButton from './components/SosButton';
import WeeklyCheckin from './components/WeeklyCheckin';
import SettingsModal from './components/SettingsModal';
import StatsFooter from './components/StatsFooter';
import RecentAlertsFeed from './components/RecentAlertsFeed';
import ToastNotification from './components/ToastNotification';
import NearbyHazardsPanel from './components/NearbyHazardsPanel';
import SafetyToolsPanel from './components/SafetyToolsPanel';
import { getDistanceMeters, isMovingTowards } from './utils/geo';

// Catch any React render crash and show a visible error instead of blank white
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error('App crash:', err, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-900 text-white p-8 gap-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <pre className="text-xs text-rose-300 bg-slate-800 p-4 rounded-xl max-w-lg overflow-auto whitespace-pre-wrap">
            {this.state.error.toString()}
          </pre>
          <button
            className="px-6 py-2 bg-indigo-600 rounded-xl font-bold text-sm"
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Track which community alert IDs we've already shown so we don't repeat them
const shownCommunityAlertIds = new Set();

export default function App() {
  // App States: 'splash' | 'login' | 'app'
  const [appState, setAppState] = useState('splash');
  const [user, setUser] = useState(null);
  
  // Location telemetry & trajectory tracking
  const [userLocation, setUserLocation] = useState({ lat: 28.6328, lng: 77.2195 });
  const [locationStatus, setLocationStatus] = useState({ level: 'Low', score: 20 });
  const [targetLocation, setTargetLocation] = useState(null);
  const locationHistoryRef = useRef([]);
  const alertCooldownsRef = useRef({}); // 5-minute rate limit map per zone

  // Grid Data telemetry
  const [zones, setZones] = useState([]);
  const [heatmapPoints, setHeatmapPoints] = useState([]);

  // Active UI Controls & Modals
  const [activeTab, setActiveTab] = useState('MAP'); // 'MAP' | 'LIVE' | 'LIST'
  const [mode, setMode] = useState('explore'); // 'explore' | 'route'
  const [selectedZone, setSelectedZone] = useState(null);
  const [reportLocation, setReportLocation] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [feedRefreshTrigger, setFeedRefreshTrigger] = useState(0);

  // Route telemetry
  const [routeData, setRouteData] = useState(null);
  const [activeRouteId, setActiveRouteId] = useState(null);

  // Check saved user session
  useEffect(() => {
    const savedUser = localStorage.getItem('nirbhay_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  // Continuous High-Precision Live Location Telemetry Tracker
  // Dependency array is intentionally empty — the watcher must not restart
  // every time zones update or it loses GPS lock and precision degrades.
  const zonesRef = useRef(zones);
  useEffect(() => { zonesRef.current = zones; }, [zones]);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    const geoOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        handleLocationUpdate(loc, zonesRef.current);
      },
      (err) => {
        console.warn('Live location acquisition warning:', err.message);
      },
      geoOptions
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []); // stable — never recreated

  // Handle Location Telemetry & Feature 3: Proximity Trajectory Alerts
  // Defined before the useEffect that references it via zonesRef
  const handleLocationUpdate = (loc, currentZones) => {
    const zonesToCheck = currentZones ?? zonesRef.current;
    setUserLocation(loc);

    if (!loc.lat || !loc.lng || loc.denied) return;

    // Maintain trajectory history of last 3 location points
    const newHistory = [...locationHistoryRef.current, { lat: loc.lat, lng: loc.lng }].slice(-3);
    locationHistoryRef.current = newHistory;

    // Feature 3: Check proximity to High-Risk zones (Score > 65) within 200m
    if (zonesToCheck && zonesToCheck.length > 0) {
      const now = Date.now();
      const FIVE_MIN_MS = 5 * 60 * 1000;

      zonesToCheck.forEach(zone => {
        if (zone.score > 65 || zone.riskLevel === 'High') {
          const dist = getDistanceMeters(loc.lat, loc.lng, zone.lat, zone.lng);
          
          if (dist <= 200) {
            const lastAlerted = alertCooldownsRef.current[zone.cellId] || 0;
            if (now - lastAlerted > FIVE_MIN_MS) {
              alertCooldownsRef.current[zone.cellId] = now;
              const zoneName = zone.locationName || 'Connaught Place / Hauz Khas Area';
              const topFactor = Object.keys(zone.categoryCounts || {})[0] || 'poor lighting';
              
              const fallbackMsg = `🚨 Approaching a high-risk area (${dist}m ahead) — ${zoneName}. Stay alert.`;
              setToastMessage(fallbackMsg);

              fetch('/api/proximity-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ distanceMeters: dist, zoneName, topFactor, timeOfDay: 'evening' })
              })
                .then(res => res.json())
                .then(data => {
                  if (data.success && data.alertMessage) setToastMessage(`🚨 ${data.alertMessage}`);
                })
                .catch(e => console.warn('Proximity AI error:', e));
            }
          }
        }
      });
    }
  };

  // Fetch live risk status when location changes
  useEffect(() => {
    if (userLocation.lat && userLocation.lng) {
      fetch(`/api/live-status?lat=${userLocation.lat}&lng=${userLocation.lng}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.status) {
            setLocationStatus(data.status);
          }
        })
        .catch(e => console.warn('Status error:', e));
    }
  }, [userLocation]);

  // Poll for community danger alerts from nearby users every 15 seconds
  useEffect(() => {
    if (appState !== 'app') return;
    const poll = () => {
      const { lat, lng } = userLocation;
      if (!lat || !lng) return;
      fetch(`/api/community-alerts?lat=${lat}&lng=${lng}`)
        .then(res => res.json())
        .then(data => {
          if (!data.success || !data.alerts?.length) return;
          data.alerts.forEach(alert => {
            if (!shownCommunityAlertIds.has(alert.id)) {
              shownCommunityAlertIds.add(alert.id);
              setToastMessage(`🔔 Nearby user alert: "${alert.message}"`);
            }
          });
        })
        .catch(() => {});
    };
    poll(); // run immediately on mount / state change
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [appState, userLocation.lat, userLocation.lng]);

  // Load / Refresh Grid Zones
  const loadZonesData = () => {
    fetch('/api/zones')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setZones(data.zones);
          setHeatmapPoints(data.heatmapPoints);
        }
      })
      .catch(e => console.warn('Zones error:', e));
  };

  useEffect(() => {
    loadZonesData();
  }, []);

  // Handle Splash Screen completion
  const handleSplashFinish = () => {
    if (user) {
      setAppState('app');
    } else {
      setAppState('login');
    }
  };

  const handleLoginSuccess = (loggedUser) => {
    setUser(loggedUser);
    setAppState('app');
    if (!loggedUser.emergency_contact) {
      setShowContactModal(true);
    }
  };

  const handleReportSubmitted = (zone) => {
    loadZonesData();
    setFeedRefreshTrigger(prev => prev + 1);
    setToastMessage('New report submitted anonymously — live heatmap updated!');
  };

  const handleSelectAlert = (alert) => {
    setTargetLocation({ lat: alert.lat, lng: alert.lng });
    
    const matchedZone = zones.find(z => z.cellId === alert.zone_id) || {
      cellId: alert.zone_id || 'target_zone',
      lat: alert.lat,
      lng: alert.lng,
      score: 55,
      riskLevel: 'Moderate',
      confidenceText: 'Based on recent report',
      signals: { streetlightsCount: 1, nearestPoliceDistKm: 1.8, isIsolated: false },
      categoryCounts: { [alert.category || 'Harassment']: 1 },
      reports: [alert]
    };

    setSelectedZone(matchedZone);
  };

  return (
    <ErrorBoundary>
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      
      {/* 1. Splash Screen */}
      {appState === 'splash' && (
        <Splash
          onFinish={handleSplashFinish}
          onLocationReady={(loc) => handleLocationUpdate(loc)}
          onDataLoaded={(data) => {
            setZones(data.zones);
            setHeatmapPoints(data.heatmapPoints);
          }}
        />
      )}

      {/* 2. Google Sign-In Gate */}
      {appState === 'login' && (
        <LoginModal onLoginSuccess={handleLoginSuccess} />
      )}

      {/* 3. Main Map Application Shell */}
      {appState === 'app' && (
        <>
          {/* Toast Notification Banner (Proximity Alerts & Submission feedback) */}
          <ToastNotification
            message={toastMessage}
            onClose={() => setToastMessage(null)}
          />

          {/* Top Bar Navigation & Live Risk Status */}
          <TopHeader
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              if (tab === 'LIVE' || tab === 'LIST') {
                setIsFeedOpen(true);
              } else {
                setIsFeedOpen(false);
              }
            }}
            radiusMeters={100}
            onOpenSettings={() => setShowSettingsModal(true)}
            onOpenMenu={() => setShowSettingsModal(true)}
          />

          {/* Feature 2: Nearby Hazards Panel (Open by default in Explore Mode) */}
          {mode === 'explore' && !isFeedOpen && (
            <NearbyHazardsPanel
              userLocation={userLocation}
              zones={zones}
              onSelectZone={(zone) => {
                setTargetLocation({ lat: zone.lat, lng: zone.lng });
                setSelectedZone(zone);
              }}
            />
          )}

          {/* Recent Alerts Live Feed Collapsible Sidebar */}
          <RecentAlertsFeed
            isOpen={isFeedOpen}
            onClose={() => setIsFeedOpen(false)}
            onSelectAlert={handleSelectAlert}
            refreshTrigger={feedRefreshTrigger}
          />

          {/* Leaflet Map & Geometric Heatmap */}
          <MapView
            userLocation={userLocation}
            targetLocation={targetLocation}
            zones={zones}
            heatmapPoints={heatmapPoints}
            selectedZone={selectedZone}
            onSelectZone={(zone) => setSelectedZone(zone)}
            onOpenReport={(pos) => {
              if (pos) setReportLocation(pos);
              setShowReportModal(true);
            }}
            routeData={routeData}
            activeRouteId={activeRouteId}
            isRouteMode={mode === 'route'}
            dragLocation={reportLocation}
            onDragLocationChange={(pos) => setReportLocation(pos)}
          />

          {/* Safe Route Navigator Panel */}
          {mode === 'route' && (
            <RoutePanel
              userLocation={userLocation}
              onRouteCalculated={(rData, selectedId) => {
                setRouteData(rData);
                setActiveRouteId(selectedId);
              }}
              onClose={() => setMode('explore')}
            />
          )}

          {/* Weekly Safety Check-in Nudge Banner */}
          {mode === 'explore' && (
            <WeeklyCheckin onOpenReport={() => setShowReportModal(true)} />
          )}

          {/* Persistent 1-Tap Emergency SOS Button */}
          <SosButton
            userLocation={userLocation}
            user={user}
            onPromptEmergencyContact={() => setShowContactModal(true)}
            isHighRisk={locationStatus?.level === 'High'}
          />

          {/* Safety Tools Panel — Hold SOS, Location Share, Fake Call, Panic Alarm */}
          <SafetyToolsPanel
            userLocation={userLocation}
            user={user}
            onSOSTriggered={() => setToastMessage('🚨 SOS alert dispatched to your emergency contact!')}
            onThreatDetected={(label) => {
              setToastMessage(`🎙 Guardian Mode detected a threat: ${label}. Check your surroundings!`);
            }}
          />

          {/* Counter Stats Footer */}
          <StatsFooter />

          {/* Modals & Overlays */}
          {showReportModal && (
            <ReportModal
              userLocation={userLocation}
              user={user}
              onClose={() => setShowReportModal(false)}
              onReportSubmitted={handleReportSubmitted}
            />
          )}

          {selectedZone && (
            <ZoneDetailModal
              zone={selectedZone}
              user={user}
              onClose={() => setSelectedZone(null)}
              onReportConfirmed={() => loadZonesData()}
            />
          )}

          {showContactModal && (
            <EmergencyContactModal
              user={user}
              onComplete={(phone) => {
                const updated = { ...user, emergency_contact: phone };
                setUser(updated);
                localStorage.setItem('nirbhay_user', JSON.stringify(updated));
                setShowContactModal(false);
              }}
              onSkip={() => setShowContactModal(false)}
            />
          )}

          {showSettingsModal && (
            <SettingsModal
              user={user}
              onUpdateUser={(updated) => setUser(updated)}
              onSignOut={() => setAppState('login')}
              onClose={() => setShowSettingsModal(false)}
            />
          )}

        </>
      )}

    </div>
    </ErrorBoundary>
  );
}
