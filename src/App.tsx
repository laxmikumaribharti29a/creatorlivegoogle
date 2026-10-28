import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Lightbulb,
  Monitor,
  Smartphone,
  Repeat,
  LayoutGrid,
  Camera,
  Video,
  Upload,
  ChevronRight,
  Radio,
  Image as ImageIcon,
  LogOut,
  Globe,
  MapPin,
  X,
  StopCircle,
  AlertCircle,
  CheckCircle2,
  Mic,
  MicOff,
  RefreshCw,
  Phone,
  KeyRound,
  Tv,
  Mail,
  MessageCircle,
  Shield,
  Crown,
  History,
} from 'lucide-react';
import {
  auth,
  db,
  signInWithGoogle,
  signOutUser,
  onAuthStateChanged,
  getRedirectResult,
  firebaseProjectId,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  StreamKeyRecord,
  StreamSessionRecord,
  MAX_CHANNEL_NAME_LEN,
  MAX_STREAM_KEY_LEN,
  MAX_RTMP_URL_LEN,
  MAX_TITLE_LEN,
  User,
} from './firebase';
import { translations, Language } from './i18n';
import AdminPanel, {
  ManagedUser,
  SubscriptionPlan,
  PromoOffer,
  PaymentRecord,
  MainPageSettings,
} from './AdminPanel';

interface UploadedVideo {
  id: string;
  originalName: string;
  fileName: string;
  url: string;
  sizeBytes: number;
  hasAudio?: boolean;
  durationSec?: number;
  createdAt: number;
}

interface ActiveServerJob {
  jobId: string;
  userId: string;
  sessionId: string;
  title: string;
  sourceType: 'video' | 'camera' | 'screen';
  videoFileName?: string;
  orientation: 'landscape' | 'portrait';
  quality: '480p' | '720p' | '1080p';
  fps: number;
  loop247: boolean;
  status: 'live' | 'stopping' | 'stopped' | 'error';
  errorMessage?: string;
  startedAt: number;
  uptimeSeconds?: number;
  destinations: { id: string; platform: string; channelName: string }[];
  lastLog: string;
  framesSent: number;
  bitrateKbps: number;
}

const DEFAULT_RTMP_URLS: Record<'youtube' | 'facebook' | 'custom', string> = {
  youtube: 'rtmps://a.rtmps.youtube.com:443/live2',
  facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
  custom: 'rtmp://live.example.com/app',
};

const LOCAL_KEYS_STORAGE = 'creatorlive247_keys_v2';
const LOCAL_USER_STORAGE = 'creatorlive247_active_user_v2';

const INITIAL_DEMO_KEYS: StreamKeyRecord[] = [
  {
    id: 'demo_yt_1',
    userId: 'guest',
    platform: 'youtube',
    channelName: 'YouTube',
    streamKey: 'yt-live-24x7-key',
    rtmpUrl: 'rtmps://a.rtmps.youtube.com:443/live2',
    enabled: true,
  },
  {
    id: 'demo_fb_1',
    userId: 'guest',
    platform: 'facebook',
    channelName: 'Facebook',
    streamKey: 'FB-3948102948eQ-7',
    rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp',
    enabled: true,
  },
];

const DEFAULT_SITE_SETTINGS: MainPageSettings = {
  websiteName: 'CreatorLive24/7',
  tagline: 'Your Content. Always On.',
  businessAddress: 'Patna, Bihar',
  logoUrl: '/assets/aistudio/CreatorLive24_7_Live_Provider_Logo__1__b778fd10.png',
  showLogoOnFreeStream: true,
  mobileNumber: '+918863090950',
  whatsappNumber: '+918863090950',
  supportEmail: 'typing.classes@gmail.com',
  supportMessage: 'Need help with streaming? Call or WhatsApp us.',
  youtubeUrl: 'https://youtube.com/yourpage',
  facebookUrl: 'https://facebook.com/yourpage',
  instagramUrl: 'https://instagram.com/yourpage',
  twitterUrl: 'https://x.com/yourpage',
  upiId: 'creatorlive247@upi',
  upiPayeeName: 'CreatorLive24/7',
};

function normalizeStreamKeyRecord(item: StreamKeyRecord): StreamKeyRecord {
  if (
    item.platform === 'youtube' ||
    (item.rtmpUrl && item.rtmpUrl.toLowerCase().includes('youtube.com'))
  ) {
    if (!item.rtmpUrl || item.rtmpUrl.startsWith('rtmp://') || item.rtmpUrl.includes('facebook.com')) {
      return {
        ...item,
        platform: 'youtube',
        rtmpUrl: 'rtmps://a.rtmps.youtube.com:443/live2',
      };
    }
  }
  return item;
}

function loadLocalKeys(): StreamKeyRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEYS_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((k: StreamKeyRecord) => normalizeStreamKeyRecord(k));
      }
    }
  } catch {
    // ignore
  }
  return INITIAL_DEMO_KEYS;
}

function saveLocalKeys(keys: StreamKeyRecord[]) {
  try {
    localStorage.setItem(LOCAL_KEYS_STORAGE, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

function maskStreamKey(key: string, platform: string): string {
  if (!key) return '••••';
  if (key === 'yt-live-24x7-key') return '••••';
  if (key === 'FB-3948102948eQ-7') return 'FB-3•••••••••eQ-7';
  if (platform === 'youtube' && key.length <= 8) {
    return '••••';
  }
  if (key.length <= 8) {
    return '••••';
  }
  return `${key.slice(0, 4)}•••••••••${key.slice(-4)}`;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb < 0.1 ? '0.8' : mb.toFixed(1)} MB`;
}

// Colorful Google "G" SVG Logo matching screenshots
function GoogleColorIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.9C3.5 21.4 7.4 24 12 24z"
      />
    </svg>
  );
}

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];

  // Admin & Site Store Data (initialized from localStorage cache if available so saved settings persist immediately)
  const [siteSettings, setSiteSettings] = useState<MainPageSettings>(() => {
    try {
      const cached = localStorage.getItem('creatorlive247_site_settings_v1');
      if (cached) {
        return { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(cached) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SITE_SETTINGS;
  });
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [offers, setOffers] = useState<PromoOffer[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  // Auth & User Session State (supports Google Login AND Mobile Number / Email Login)
  const [user, setUser] = useState<User | null>(null);
  const [localSession, setLocalSession] = useState<{
    identifier: string;
    name: string;
  } | null>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_USER_STORAGE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Sign In / Mobile Login Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'mobile' | 'email' | 'google'>('mobile');
  const [mobileOrEmailInput, setMobileOrEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [googleDomainNotice, setGoogleDomainNotice] = useState<string | null>(null);
  const authInputRef = useRef<HTMLInputElement | null>(null);

  // Upgrade / Plans Modal State
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [selectedPlanForUpi, setSelectedPlanForUpi] = useState<SubscriptionPlan | null>(null);
  const [utrInput, setUtrInput] = useState('');

  const isLoggedIn = Boolean(user || localSession);
  const activeIdentifier = user?.email || localSession?.identifier || '';
  const activeUserName = user?.displayName || localSession?.name || activeIdentifier.split('@')[0] || 'Creator';
  const activeUserId =
    user?.uid ||
    (activeIdentifier ? `usr_${activeIdentifier.replace(/[^a-zA-Z0-9]/g, '_')}` : 'guest');

  // Current user's record from Admin Users list
  const currentManagedUser = managedUsers.find(
    (u) => u.identifier.toLowerCase() === activeIdentifier.toLowerCase()
  );
  const currentUserPlan = currentManagedUser?.plan || 'Free';
  const isFreePlanUser = currentUserPlan === 'Free';
  // Website Logo Hide/Unhide permission is controlled from Admin Panel -> User List (allowLogoHide)
  const canUserHideLogo = currentManagedUser
    ? typeof currentManagedUser.allowLogoHide === 'boolean'
      ? currentManagedUser.allowLogoHide
      : currentUserPlan !== 'Free'
    : !isFreePlanUser;

  const userFirstName = (
    currentManagedUser?.name ||
    activeUserName ||
    activeIdentifier.split('@')[0] ||
    'Creator'
  )
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();

  // Navigation & View State: 'home' | 'wizard' | 'dashboard' | 'library' | 'admin'
  const [activeView, setActiveView] = useState<
    'home' | 'wizard' | 'dashboard' | 'library' | 'admin'
  >(() => (Boolean(localStorage.getItem(LOCAL_USER_STORAGE)) ? 'dashboard' : 'home'));
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Stream Keys State
  const [firestoreKeys, setFirestoreKeys] = useState<StreamKeyRecord[]>([]);
  const [localKeys, setLocalKeys] = useState<StreamKeyRecord[]>(() => loadLocalKeys());
  const streamKeys = user && firestoreKeys.length > 0 ? firestoreKeys : localKeys;

  // Step 1 Form State (Default to YouTube matching "1. YouTube & Key")
  const [newPlatform, setNewPlatform] = useState<'youtube' | 'facebook' | 'custom'>('youtube');
  const [channelName, setChannelName] = useState('');
  const [streamKeyInput, setStreamKeyInput] = useState('');
  const [rtmpUrlInput, setRtmpUrlInput] = useState(DEFAULT_RTMP_URLS.youtube);
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Stream Configuration Settings (Bottom Toolbar)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [quality, setQuality] = useState<'480p' | '720p' | '1080p'>('720p');
  const [fps, setFps] = useState<30 | 60>(30);
  const [loop247, setLoop247] = useState<boolean>(true);

  // Step 2 Stream Source State
  const [sourceType, setSourceType] = useState<'camera' | 'screen' | 'video'>('video');
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgressPct, setUploadProgressPct] = useState<number>(0);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');

  // Step 3 Go Live Studio State
  const [streamTitle, setStreamTitle] = useState('My Live Stream');
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [showThumbnailToViewers, setShowThumbnailToViewers] = useState<boolean>(false);
  const [thumbnailCountdownSec, setThumbnailCountdownSec] = useState<number>(0);
  const [paidUserShowLogo, setPaidUserShowLogo] = useState<boolean>(true);
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // Effective Website Logo visibility on stream (Controlled by Admin User List allowLogoHide permission)
  const effectiveShowStreamLogo = canUserHideLogo
    ? paidUserShowLogo
    : Boolean(siteSettings.showLogoOnFreeStream);

  // Active Streams & History
  const [activeJobs, setActiveJobs] = useState<ActiveServerJob[]>([]);
  const [savedSessions, setSavedSessions] = useState<StreamSessionRecord[]>([]);
  const [liveTimerSec, setLiveTimerSec] = useState(0);

  // Modals
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [showVideoStudioModal, setShowVideoStudioModal] = useState(false);
  const [studioClipTitle, setStudioClipTitle] = useState(
    '20_30_की_उम्र_में_अमीर_बनने_का_रहस्य_reelshorts'
  );
  const [studioGenerating, setStudioGenerating] = useState(false);

  // Refs for Media & WebSockets
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const uploadedVideoPlayerRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const cancelUploadRef = useRef<boolean>(false);

  useEffect(() => {
    saveLocalKeys(localKeys);
  }, [localKeys]);

  // YouTube / Facebook style Thumbnail Intro Countdown (shows thumbnail for 4 seconds, then auto-plays video)
  const triggerThumbnailIntro = useCallback((seconds = 4) => {
    setShowThumbnailToViewers(true);
    setThumbnailCountdownSec(seconds);
  }, []);

  useEffect(() => {
    if (!showThumbnailToViewers || thumbnailCountdownSec <= 0) return;
    const timer = setTimeout(() => {
      if (thumbnailCountdownSec <= 1) {
        setThumbnailCountdownSec(0);
        setShowThumbnailToViewers(false);
        if (uploadedVideoPlayerRef.current) {
          uploadedVideoPlayerRef.current.play().catch(() => {});
        }
        if (videoPreviewRef.current) {
          videoPreviewRef.current.play().catch(() => {});
        }
      } else {
        setThumbnailCountdownSec((prev) => prev - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [showThumbnailToViewers, thumbnailCountdownSec]);

  // Fetch Admin & Site Settings Data
  const lastServerSettingsJsonRef = useRef<string>('');
  const fetchAdminData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/data');
      if (!res.ok) return;
      const data = await res.json();
      if (data.settings) {
        const nextJson = JSON.stringify(data.settings);
        if (nextJson !== lastServerSettingsJsonRef.current) {
          lastServerSettingsJsonRef.current = nextJson;
          setSiteSettings((prev) => ({ ...prev, ...data.settings }));
          try {
            localStorage.setItem('creatorlive247_site_settings_v1', nextJson);
          } catch {
            // ignore
          }
        }
      }
      if (Array.isArray(data.users)) setManagedUsers(data.users);
      if (Array.isArray(data.plans)) setPlans(data.plans);
      if (Array.isArray(data.offers)) setOffers(data.offers);
      if (Array.isArray(data.payments)) setPayments(data.payments);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(() => {
      fetchAdminData();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchAdminData]);

  // Register user in backend users table
  const registerUserInBackend = useCallback(
    async (identifier: string, name: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/users/register-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAuthError(data.error || 'Account access denied.');
          return false;
        }
        await fetchAdminData();
        return true;
      } catch {
        return true;
      }
    },
    [fetchAdminData]
  );

  // 1. Track Firebase Auth state & redirect results
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (res) => {
        if (res?.user?.email) {
          await registerUserInBackend(
            res.user.email,
            res.user.displayName || res.user.email.split('@')[0]
          );
          setShowAuthModal(false);
          setActiveView('dashboard');
        }
      })
      .catch(() => {
        // ignore redirect result warning
      });

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser && currentUser.email) {
        await registerUserInBackend(
          currentUser.email,
          currentUser.displayName || currentUser.email.split('@')[0]
        );
        setActiveView((prev) => (prev === 'home' ? 'dashboard' : prev));
      }
    });
    return () => unsub();
  }, [registerUserInBackend]);

  // 2. Listen to user's Stream Keys & Stream Sessions in Firestore when signed in
  useEffect(() => {
    if (!authReady || !user) {
      setFirestoreKeys([]);
      setSavedSessions([]);
      return;
    }

    const keysPath = 'streamKeys';
    const keysQuery = query(collection(db, keysPath), where('userId', '==', user.uid));
    const unsubKeys = onSnapshot(
      keysQuery,
      (snap) => {
        const list: StreamKeyRecord[] = snap.docs.map((d) =>
          normalizeStreamKeyRecord({
            id: d.id,
            ...(d.data() as Omit<StreamKeyRecord, 'id'>),
          })
        );
        setFirestoreKeys(list);
      },
      (err) => {
        console.warn('Firestore streamKeys listener warning:', err);
      }
    );

    const sessionsPath = 'streamSessions';
    const sessionsQuery = query(collection(db, sessionsPath), where('userId', '==', user.uid));
    const unsubSessions = onSnapshot(
      sessionsQuery,
      (snap) => {
        const list: StreamSessionRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StreamSessionRecord, 'id'>),
        }));
        setSavedSessions(list);
      },
      (err) => {
        console.warn('Firestore streamSessions listener warning:', err);
      }
    );

    return () => {
      unsubKeys();
      unsubSessions();
    };
  }, [authReady, user]);

  // 3. Load uploaded videos from server
  const fetchServerVideos = useCallback(async () => {
    try {
      const res = await fetch('/api/videos');
      if (!res.ok) return;
      const data = await res.json();
      const list: UploadedVideo[] = data.videos || [];
      setVideos(list);
      if (list.length > 0 && !selectedVideoId) {
        setSelectedVideoId(list[0].id);
      }
    } catch {
      // ignore
    }
  }, [selectedVideoId]);

  useEffect(() => {
    fetchServerVideos();
  }, [fetchServerVideos]);

  // 4. Poll active 24/7 server stream jobs every 2 seconds
  const fetchActiveStreams = useCallback(async () => {
    try {
      const res = await fetch('/api/streams/active');
      if (!res.ok) return;
      const data = await res.json();
      setActiveJobs(data.jobs || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchActiveStreams();
    const interval = setInterval(fetchActiveStreams, 2000);
    return () => clearInterval(interval);
  }, [fetchActiveStreams]);

  // 5. Update live timer when an active job is running
  const currentActiveJob = activeJobs[0] || null;
  useEffect(() => {
    if (!currentActiveJob) {
      setLiveTimerSec(0);
      return;
    }
    const tick = () => {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - currentActiveJob.startedAt) / 1000)
      );
      setLiveTimerSec(elapsed);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [currentActiveJob]);

  // 6. Manage Camera / Screen / Video preview in Step 3
  const stopLocalMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const startSourcePreview = useCallback(
    async (targetSource: 'camera' | 'screen' | 'video') => {
      if (targetSource === 'video') {
        stopLocalMediaTracks();
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }
        return;
      }

      try {
        stopLocalMediaTracks();
        let stream: MediaStream;
        const widthIdeal = quality === '1080p' ? 1920 : quality === '480p' ? 854 : 1280;
        const heightIdeal = quality === '1080p' ? 1080 : quality === '480p' ? 480 : 720;

        if (targetSource === 'camera') {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: orientation === 'portrait' ? heightIdeal : widthIdeal },
              height: { ideal: orientation === 'portrait' ? widthIdeal : heightIdeal },
              frameRate: { ideal: fps },
            },
            audio: true,
          });
        } else {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: { ideal: fps } },
            audio: true,
          });
        }

        mediaStreamRef.current = stream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          videoPreviewRef.current.muted = true;
          await videoPreviewRef.current.play().catch(() => {});
        }
      } catch (err) {
        setFormFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? `Camera/Screen access denied: ${err.message}`
              : 'Could not access Camera or Screen.',
        });
      }
    },
    [fps, orientation, quality, stopLocalMediaTracks]
  );

  useEffect(() => {
    if (activeView === 'wizard' && step === 3 && sourceType !== 'video') {
      startSourcePreview(sourceType);
    } else if (sourceType === 'video' || activeView !== 'wizard') {
      stopLocalMediaTracks();
    }
  }, [activeView, step, sourceType, startSourcePreview, stopLocalMediaTracks]);

  // Platform tab change in Step 1
  const handleSelectPlatformTab = (platform: 'youtube' | 'facebook' | 'custom') => {
    setNewPlatform(platform);
    setRtmpUrlInput(DEFAULT_RTMP_URLS[platform]);
    setFormFeedback(null);
  };

  // Save a Stream Key
  const saveStreamKeyInternal = async (): Promise<boolean> => {
    const trimmedKey = streamKeyInput.trim().slice(0, MAX_STREAM_KEY_LEN);
    const trimmedUrl = rtmpUrlInput.trim().slice(0, MAX_RTMP_URL_LEN);

    let effectivePlatform = newPlatform;
    let effectiveUrl = trimmedUrl;
    const isYoutubePattern =
      /^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}(-[a-zA-Z0-9]{4})?$/.test(
        trimmedKey
      );

    if (trimmedKey.startsWith('FB-') && effectivePlatform === 'youtube') {
      effectivePlatform = 'facebook';
      effectiveUrl = DEFAULT_RTMP_URLS.facebook;
    } else if (isYoutubePattern && effectivePlatform === 'facebook') {
      effectivePlatform = 'youtube';
      effectiveUrl = DEFAULT_RTMP_URLS.youtube;
    } else if (
      effectivePlatform === 'youtube' &&
      (effectiveUrl.includes('facebook.com') || effectiveUrl.startsWith('rtmp://'))
    ) {
      effectiveUrl = DEFAULT_RTMP_URLS.youtube;
    } else if (effectivePlatform === 'facebook' && effectiveUrl.includes('youtube.com')) {
      effectiveUrl = DEFAULT_RTMP_URLS.facebook;
    }

    const defaultLabel =
      effectivePlatform === 'youtube'
        ? 'YouTube'
        : effectivePlatform === 'facebook'
        ? 'Facebook'
        : 'Custom RTMP';
    const trimmedChannel = (channelName.trim() || defaultLabel).slice(0, MAX_CHANNEL_NAME_LEN);

    if (!trimmedKey) {
      setFormFeedback({
        type: 'error',
        message: 'Please enter a valid Stream Key.',
      });
      return false;
    }
    if (effectiveUrl.length < 5) {
      setFormFeedback({
        type: 'error',
        message: 'Please enter a valid RTMP Server URL.',
      });
      return false;
    }

    const keyId = `key_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newRec: StreamKeyRecord = {
      id: keyId,
      userId: activeUserId,
      platform: effectivePlatform,
      channelName: trimmedChannel,
      streamKey: trimmedKey,
      rtmpUrl: effectiveUrl,
      enabled: true,
    };

    setLocalKeys((prev) => {
      const cleaned = prev.map((k) =>
        k.id.startsWith('demo_') ? { ...k, enabled: false } : k
      );
      return [newRec, ...cleaned];
    });

    if (user) {
      setSavingKey(true);
      try {
        await setDoc(doc(db, 'streamKeys', keyId), {
          userId: user.uid,
          platform: effectivePlatform,
          channelName: trimmedChannel,
          streamKey: trimmedKey,
          rtmpUrl: effectiveUrl,
          enabled: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore save fallback to local storage:', err);
      } finally {
        setSavingKey(false);
      }
    }

    setChannelName('');
    setStreamKeyInput('');
    setFormFeedback({
      type: 'success',
      message: `${trimmedChannel} stream key saved and selected!`,
    });
    return true;
  };

  const handleSaveStreamKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);
    await saveStreamKeyInternal();
  };

  const handleStep1Next = async () => {
    setFormFeedback(null);
    if (streamKeyInput.trim().length > 0) {
      const ok = await saveStreamKeyInternal();
      if (!ok) return;
    }
    setStep(2);
  };

  const handleToggleStreamKey = async (item: StreamKeyRecord) => {
    setLocalKeys((prev) =>
      prev.map((k) => (k.id === item.id ? { ...k, enabled: !k.enabled } : k))
    );
    if (user && firestoreKeys.some((k) => k.id === item.id)) {
      try {
        await updateDoc(doc(db, 'streamKeys', item.id), {
          enabled: !item.enabled,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore toggle warning:', err);
      }
    }
  };

  const handleDeleteStreamKey = async (item: StreamKeyRecord) => {
    setLocalKeys((prev) => prev.filter((k) => k.id !== item.id));
    if (user && firestoreKeys.some((k) => k.id === item.id)) {
      try {
        await deleteDoc(doc(db, 'streamKeys', item.id));
      } catch (err) {
        console.warn('Firestore delete warning:', err);
      }
    }
  };

  // Chunked Long-Format Video Upload
  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVideo(true);
    setUploadProgressPct(0);
    setUploadProgressText(`0% (0 MB / ${formatMegabytes(file.size)})`);
    setFormFeedback(null);
    cancelUploadRef.current = false;

    const CHUNK_SIZE = 4 * 1024 * 1024;
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const uploadId = `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      let uploadedVideoObj: UploadedVideo | null = null;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (cancelUploadRef.current) {
          throw new Error('Upload cancelled by user.');
        }

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const blobChunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', blobChunk, file.name);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', String(chunkIndex));
        formData.append('totalChunks', String(totalChunks));
        formData.append('originalName', file.name);

        const res = await fetch('/api/videos/upload-chunk', {
          method: 'POST',
          body: formData,
        });

        let data: { completed?: boolean; video?: UploadedVideo; error?: string } = {};
        try {
          data = await res.json();
        } catch {
          throw new Error(
            `Upload failed at chunk ${chunkIndex + 1}/${totalChunks} (HTTP ${res.status})`
          );
        }

        if (!res.ok) {
          throw new Error(data.error || `Chunk ${chunkIndex + 1} failed`);
        }

        const pct = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        setUploadProgressPct(pct);
        setUploadProgressText(
          `${pct}% (${formatMegabytes(end)} / ${formatMegabytes(file.size)})`
        );

        if (data.completed && data.video) {
          uploadedVideoObj = data.video;
        }
      }

      await fetchServerVideos();
      if (uploadedVideoObj) {
        setSelectedVideoId(uploadedVideoObj.id);
      }
      setSourceType('video');
      setFormFeedback({
        type: 'success',
        message: `Uploaded "${file.name}" (${formatMegabytes(file.size)}) for 24/7 server loop!`,
      });
    } catch (err) {
      setFormFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to upload video.',
      });
    } finally {
      setUploadingVideo(false);
      setUploadProgressPct(0);
      setUploadProgressText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteVideo = async (id: string) => {
    try {
      await fetch(`/api/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const remaining = videos.filter((v) => v.id !== id);
      setVideos(remaining);
      if (selectedVideoId === id) {
        setSelectedVideoId(remaining[0]?.id || '');
      }
    } catch {
      // ignore
    }
  };

  const handleGenerateStudioVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudioGenerating(true);
    try {
      const res = await fetch('/api/videos/generate-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: studioClipTitle || 'CreatorLive_24x7',
          orientation,
          durationSec: 8,
          bgHex: '1e1b4b',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate video');
      await fetchServerVideos();
      setSelectedVideoId(data.video.id);
      setSourceType('video');
      setShowVideoStudioModal(false);
    } catch (err) {
      setFormFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Studio generation failed',
      });
    } finally {
      setStudioGenerating(false);
    }
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setThumbnailDataUrl(reader.result);
        // Show thumbnail like YouTube/Facebook for 4 seconds, then auto-play video
        triggerThumbnailIntro(4);
        setFormFeedback({
          type: 'success',
          message:
            'Thumbnail set! Viewers will see this thumbnail for a few seconds and then the video will automatically start playing.',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const rawEnabledDestinations = streamKeys.filter((k) => k.enabled);
  const hasRealKeyEnabled = rawEnabledDestinations.some(
    (k) =>
      !k.id.startsWith('demo_') &&
      k.streamKey !== 'yt-live-24x7-key' &&
      k.streamKey !== 'FB-3948102948eQ-7'
  );
  const enabledDestinations = hasRealKeyEnabled
    ? rawEnabledDestinations.filter(
        (k) =>
          !k.id.startsWith('demo_') &&
          k.streamKey !== 'yt-live-24x7-key' &&
          k.streamKey !== 'FB-3948102948eQ-7'
      )
    : rawEnabledDestinations;

  const destinationSummary =
    enabledDestinations.length > 0
      ? enabledDestinations.map((d) => d.channelName || d.platform).join(', ')
      : t.noDestinationSelected;

  const selectedVideo = videos.find((v) => v.id === selectedVideoId) || videos[0] || null;

  // Go Live Now / Stop Live Handler
  const handleGoLiveOrStop = async () => {
    setFormFeedback(null);

    if (currentActiveJob) {
      await handleStopJob(currentActiveJob.jobId, currentActiveJob.sessionId);
      return;
    }

    if (enabledDestinations.length === 0) {
      setFormFeedback({
        type: 'error',
        message: 'Please select or save at least one Stream Key in Step 1.',
      });
      setStep(1);
      return;
    }

    setIsStartingStream(true);
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const safeTitle = (streamTitle.trim() || 'My Live Stream').slice(0, MAX_TITLE_LEN);
    const safeDestSummary = destinationSummary.slice(0, 256);

    try {
      if (sourceType === 'video') {
        if (!selectedVideo) {
          throw new Error('Please upload or choose a video in Step 2 first.');
        }

        const res = await fetch('/api/streams/start-loop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: activeIdentifier || activeUserId,
            sessionId,
            title: safeTitle,
            videoId: selectedVideo.id,
            orientation,
            quality,
            fps,
            loop247,
            thumbnailDataUrl,
            // Pass false so FFmpeg shows thumbnail for the first 4 seconds (between(t,0,4)) then plays video for viewers
            showThumbnailOverlay: false,
            showWatermarkLogo: effectiveShowStreamLogo,
            destinations: enabledDestinations.map((d) => ({
              id: d.id,
              platform: d.platform,
              channelName: d.channelName,
              rtmpUrl: d.rtmpUrl,
              streamKey: d.streamKey,
            })),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to start 24/7 loop stream.');
        }

        if (user) {
          try {
            await setDoc(doc(db, 'streamSessions', sessionId), {
              userId: user.uid,
              title: safeTitle,
              sourceType: 'video',
              videoFileName: selectedVideo.originalName.slice(0, 256),
              videoServerId: String(data.job?.jobId || selectedVideo.id).slice(0, 128),
              orientation,
              quality,
              fps,
              loop247,
              status: 'live',
              destinations: safeDestSummary,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch {
            // ignore
          }
        }

        await fetchActiveStreams();
        await fetchAdminData();
        // Show thumbnail for 4 seconds like YouTube/Facebook, then auto-play video
        if (thumbnailDataUrl) {
          triggerThumbnailIntro(4);
        }
        setFormFeedback({
          type: 'success',
          message: `24/7 Live stream started to ${safeDestSummary}!`,
        });
      } else {
        if (!mediaStreamRef.current) {
          await startSourcePreview(sourceType);
        }
        if (!mediaStreamRef.current) {
          throw new Error(
            'Camera or Screen stream is not active. Please allow browser permissions.'
          );
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/stream`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => {
            ws.send(
              JSON.stringify({
                type: 'start',
                userId: activeIdentifier || activeUserId,
                sessionId,
                title: safeTitle,
                sourceType,
                orientation,
                quality,
                fps,
                thumbnailDataUrl,
                showThumbnailOverlay: false,
                showWatermarkLogo: effectiveShowStreamLogo,
                destinations: enabledDestinations.map((d) => ({
                  id: d.id,
                  platform: d.platform,
                  channelName: d.channelName,
                  rtmpUrl: d.rtmpUrl,
                  streamKey: d.streamKey,
                })),
              })
            );
            resolve();
          };
          ws.onerror = () => reject(new Error('WebSocket connection failed'));
        });

        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

        const recorder = new MediaRecorder(mediaStreamRef.current, {
          mimeType,
          videoBitsPerSecond:
            quality === '1080p' ? 4500000 : quality === '480p' ? 1200000 : 2500000,
        });

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(ev.data);
          }
        };

        recorder.start(500);
        mediaRecorderRef.current = recorder;

        await fetchActiveStreams();
        await fetchAdminData();
        if (thumbnailDataUrl) {
          triggerThumbnailIntro(4);
        }
        setFormFeedback({
          type: 'success',
          message: `Live browser broadcast started to ${safeDestSummary}!`,
        });
      }
    } catch (err) {
      setFormFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not start stream.',
      });
    } finally {
      setIsStartingStream(false);
    }
  };

  // Stop Active Server or Browser Stream
  const handleStopJob = async (jobId: string, sessionId?: string) => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }

      await fetch('/api/streams/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, sessionId }),
      });

      await fetchActiveStreams();
      await fetchAdminData();
      setFormFeedback({
        type: 'success',
        message: 'Live stream stopped.',
      });
    } catch {
      // ignore
    }
  };

  const handleToggleMic = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMicMuted;
      });
      setIsMicMuted(!isMicMuted);
    }
  };

  // Complete login with Email or Mobile & open User Dashboard
  const completeDirectLogin = async (rawIdentifier: string, rawName?: string) => {
    setAuthError(null);
    const trimmed = rawIdentifier.trim();
    if (!trimmed) {
      authInputRef.current?.focus();
      authInputRef.current?.reportValidity();
      return;
    }

    const isPhoneNumber = /^\+?\d[\d\s-]{6,15}$/.test(trimmed);
    const normalizedIdentifier =
      !isPhoneNumber && !trimmed.includes('@') ? `${trimmed}@gmail.com` : trimmed;
    const displayName =
      (rawName ?? nameInput).trim() || normalizedIdentifier.split('@')[0] || 'Creator';

    const allowed = await registerUserInBackend(normalizedIdentifier, displayName);
    if (!allowed) return;

    const sessionObj = { identifier: normalizedIdentifier, name: displayName };
    try {
      localStorage.setItem(LOCAL_USER_STORAGE, JSON.stringify(sessionObj));
    } catch {
      // ignore
    }
    setLocalSession(sessionObj);
    setMobileOrEmailInput('');
    setNameInput('');
    setGoogleDomainNotice(null);
    setShowAuthModal(false);
    setActiveView('dashboard');
  };

  // Google Sign-In handler -> Works both with Firebase Popup AND on Hostinger custom domain
  const handleGoogleLogin = async () => {
    setAuthError(null);

    // If modal is already open, either submit the entered Google Email or focus & validate the Google Email input
    if (showAuthModal) {
      setAuthModalMode('google');
      if (mobileOrEmailInput.trim().length > 0) {
        await completeDirectLogin(mobileOrEmailInput, nameInput);
      } else {
        setTimeout(() => {
          authInputRef.current?.focus();
          authInputRef.current?.reportValidity();
        }, 30);
      }
      return;
    }

    const host = window.location.hostname || '';
    const isDefaultFirebaseHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.run.app') ||
      host.endsWith('.firebaseapp.com') ||
      host.endsWith('.web.app');

    // Only attempt Firebase popup automatically on domains authorized by default, or try with instant fallback
    if (isDefaultFirebaseHost) {
      try {
        const loggedUser = await signInWithGoogle();
        if (loggedUser.email) {
          const allowed = await registerUserInBackend(
            loggedUser.email,
            loggedUser.displayName || loggedUser.email.split('@')[0]
          );
          if (!allowed) return;
        }
        setGoogleDomainNotice(null);
        setShowAuthModal(false);
        setActiveView('dashboard');
        return;
      } catch {
        // Fallback to Google Account Sign-In modal below
      }
    }

    // Open Sign-In Modal in Google Account mode & focus Google Email input immediately
    setGoogleDomainNotice(null);
    setAuthModalMode('google');
    setShowAuthModal(true);
    setTimeout(() => {
      authInputRef.current?.focus();
    }, 80);
  };

  // Mobile or Email Login Submit -> Registers in Admin Users & Opens User Dashboard!
  const handleMobileOrEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await completeDirectLogin(mobileOrEmailInput, nameInput);
  };

  const handleFullSignOut = async () => {
    try {
      localStorage.removeItem(LOCAL_USER_STORAGE);
    } catch {
      // ignore
    }
    setLocalSession(null);
    if (user) {
      await signOutUser();
    }
    setActiveView('home');
  };

  // Submit UPI Payment UTR
  const handleSubmitUpiPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForUpi || !utrInput.trim()) return;
    await fetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIdentifier: activeIdentifier || 'guest',
        userName: activeUserName,
        planName: selectedPlanForUpi.name,
        amountInr: selectedPlanForUpi.priceInr,
        utrNumber: utrInput.trim(),
      }),
    });
    setUtrInput('');
    setSelectedPlanForUpi(null);
    setShowPlansModal(false);
    await fetchAdminData();
    setFormFeedback({
      type: 'success',
      message: 'Payment UTR submitted! Admin will approve and activate your plan shortly.',
    });
  };

  const activeOffer = offers.find((o) => o.active);

  // Quick-settings toolbar rendered across all 3 steps
  const renderQuickSettingsBar = () => (
    <div className="border border-slate-200 rounded-2xl px-4 py-3.5 bg-white">
      <div className="grid grid-cols-6 gap-1 text-center">
        <button
          type="button"
          onClick={() => setShowTipsModal(true)}
          className="flex flex-col items-center justify-center gap-1.5 py-1.5 px-1 rounded-xl hover:bg-slate-50 transition-colors text-slate-700 cursor-pointer"
        >
          <Lightbulb className="w-5 h-5 text-slate-700" />
          <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap shrink-0">
            {t.toolbarTips}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setOrientation((prev) => (prev === 'landscape' ? 'portrait' : 'landscape'))
          }
          className="flex flex-col items-center justify-center gap-1.5 py-1.5 px-1 rounded-xl hover:bg-slate-50 transition-colors text-slate-700 cursor-pointer"
        >
          {orientation === 'landscape' ? (
            <Monitor className="w-5 h-5 text-slate-800" />
          ) : (
            <Smartphone className="w-5 h-5 text-red-600" />
          )}
          <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap shrink-0">
            {orientation === 'landscape' ? t.toolbarLandscape : t.toolbarPortrait}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setQuality((prev) => (prev === '720p' ? '1080p' : prev === '1080p' ? '480p' : '720p'))
          }
          className="flex flex-col items-center justify-center gap-1.5 py-1.5 px-1 rounded-xl hover:bg-slate-50 transition-colors text-slate-700 cursor-pointer"
        >
          <span className="inline-flex items-center justify-center border-[1.5px] border-slate-700 rounded px-1 py-0.2 text-[10px] font-bold leading-tight text-slate-800">
            HD
          </span>
          <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap shrink-0">
            {t.toolbarQuality} {quality}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFps((prev) => (prev === 30 ? 60 : 30))}
          className="flex flex-col items-center justify-center gap-1.5 py-1.5 px-1 rounded-xl hover:bg-slate-50 transition-colors text-slate-700 cursor-pointer"
        >
          <span className="inline-flex items-center justify-center border-[1.5px] border-slate-700 rounded px-1.5 py-0.2 text-[10px] font-bold leading-tight text-slate-800 tabular-nums">
            {fps}
          </span>
          <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap shrink-0">
            {t.toolbarFps}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setLoop247((prev) => !prev)}
          className={`flex flex-col items-center justify-center gap-1.5 py-1.5 px-1 rounded-xl transition-colors cursor-pointer ${
            loop247 ? 'bg-red-50/70 text-red-700' : 'hover:bg-slate-50 text-slate-500'
          }`}
        >
          <Repeat className={`w-5 h-5 ${loop247 ? 'text-red-600' : 'text-slate-600'}`} />
          <span className="text-[11px] font-medium whitespace-nowrap shrink-0">
            {t.toolbarLoop}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveView((prev) => (prev === 'dashboard' ? 'wizard' : 'dashboard'))
          }
          className={`flex flex-col items-center justify-center gap-1.5 py-1.5 px-1 rounded-xl transition-colors relative cursor-pointer ${
            activeView === 'dashboard'
              ? 'bg-slate-900 text-white'
              : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[11px] font-medium whitespace-nowrap shrink-0">
            {t.toolbarDashboard}
          </span>
          {activeJobs.length > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
              {activeJobs.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Promotional Offer Banner (When an Offer is Active in Admin Panel) */}
      {activeOffer && activeView === 'home' && (
        <div className="bg-[#0f172a] text-white px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-3">
          <span>{activeOffer.bannerText}</span>
          <button
            type="button"
            onClick={() => setShowPlansModal(true)}
            className="underline font-bold text-amber-300 hover:text-amber-200 whitespace-nowrap cursor-pointer"
          >
            View Plans
          </button>
        </div>
      )}

      {/* Top Navigation Bar (100% Same-to-Same with Screenshots) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100 px-6 sm:px-10 py-3.5 flex items-center justify-between gap-4">
        {/* Left: CreatorLive24/7 Logo */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveView(isLoggedIn ? 'dashboard' : 'home');
          }}
          className="flex items-center gap-3 whitespace-nowrap shrink-0"
        >
          <img
            src={siteSettings.logoUrl}
            alt={siteSettings.websiteName}
            referrerPolicy="no-referrer"
            className="h-9 sm:h-10 w-auto object-contain"
          />
        </a>

        {/* Center Navigation Tabs when Logged In (Dashboard | Go Live | Video Library | Plans) */}
        {isLoggedIn && (
          <nav className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeView === 'dashboard'
                  ? 'bg-[#0f172a] text-white font-bold'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveView('wizard');
              }}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeView === 'wizard'
                  ? 'bg-[#0f172a] text-white font-bold'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              Go Live
            </button>
            <button
              type="button"
              onClick={() => setActiveView('library')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeView === 'library'
                  ? 'bg-[#0f172a] text-white font-bold'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              Video Library
            </button>
            <button
              type="button"
              onClick={() => setShowPlansModal(true)}
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
            >
              Plans
            </button>
          </nav>
        )}

        {/* Right Controls: Avatar Dropdown (Logged In) or Sign in (Logged Out) */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 relative">
          {isLoggedIn ? (
            <>
              {/* Mobile Compact Nav */}
              <div className="flex md:hidden items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveView('dashboard')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    activeView === 'dashboard' ? 'bg-[#0f172a] text-white' : 'text-slate-600'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('wizard')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    activeView === 'wizard' ? 'bg-[#0f172a] text-white' : 'text-slate-600'
                  }`}
                >
                  Go Live
                </button>
              </div>

              {/* Pink Circular User Avatar (Exact match to screenshot) */}
              <button
                type="button"
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="w-8 h-8 rounded-full bg-[#e11d48] hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center lowercase shadow-2xs transition-colors cursor-pointer"
                title={`${activeUserName} (${currentUserPlan})`}
              >
                {userFirstName.charAt(0) || 'u'}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-11 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 space-y-2 z-50">
                  <div className="px-2.5 py-1.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{activeUserName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{activeIdentifier}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">
                      Plan: {currentUserPlan}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowPlansModal(true);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>Upgrade / Manage Plan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLang((prev) => (prev === 'en' ? 'hi' : 'en'));
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    <span>Language: {lang === 'en' ? 'English · हिंदी' : 'हिंदी · English'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      handleFullSignOut();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthModalMode('google');
                setShowAuthModal(true);
                setTimeout(() => {
                  authInputRef.current?.focus();
                }, 80);
              }}
              className="px-5 py-2 rounded-full bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Global Auth Error Alert */}
      {authError && (
        <div className="max-w-xl mx-auto mt-4 px-4 w-full">
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
            <span>{authError}</span>
            <button type="button" onClick={() => setAuthError(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================== VIEW 1: HOME PAGE (100% SAME-TO-SAME WITH SCREENSHOT) ==================== */}
      {activeView === 'home' && (
        <main className="flex-1 bg-gradient-to-b from-[#fcfcfd] to-[#f8fafc]">
          <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16 space-y-20">
            {/* HERO SECTION */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
              {/* Left Column */}
              <div className="lg:col-span-6 space-y-6">
                {/* Light Pink Pill Badge: • LIVE PROVIDER · PATNA, BIHAR */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#fde8e8] text-[#dc2626] text-[11px] font-extrabold tracking-wider uppercase">
                  <span className="w-2 h-2 rounded-full bg-[#dc2626]" />
                  <span>LIVE PROVIDER · {siteSettings.businessAddress.toUpperCase()}</span>
                </div>

                {/* Big Headline */}
                <h1 className="text-[40px] sm:text-[50px] lg:text-[54px] font-black tracking-tight text-[#0f172a] leading-[1.06]">
                  Go live on <span className="text-[#e60012]">YouTube</span> &amp;{' '}
                  <span className="text-[#2563eb]">Facebook</span>. Stay live 24/7.
                </h1>

                {/* Subtitle Copy */}
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg">
                  Stream your camera or screen from the browser, or upload a video and let our
                  servers loop it non-stop — even after you close the tab.
                </p>

                {/* Two Pill CTA Buttons: Continue with Google & Sign up with Mobile */}
                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    <GoogleColorIcon />
                    <span>Continue with Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('mobile');
                      setShowAuthModal(true);
                    }}
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full bg-[#0f172a] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    <Phone className="w-4 h-4 text-slate-200" />
                    <span>Sign up with Mobile</span>
                  </button>
                </div>

                {/* Small Platform & 24/7 Loop Indicator Row */}
                <div className="flex items-center gap-3 pt-1 text-xs text-slate-500">
                  <span className="inline-flex items-center justify-center w-5 h-3.5 rounded-xs border border-red-600 text-red-600 text-[8px] font-bold">
                    ▶
                  </span>
                  <span className="text-blue-600 font-extrabold text-sm leading-none">f</span>
                  <Repeat className="w-3.5 h-3.5 text-purple-600" />
                  <span className="font-medium text-slate-500">24/7 loop</span>
                </div>
              </div>

              {/* Right Column: Podcast Studio Image Card */}
              <div className="lg:col-span-6">
                <div className="rounded-[24px] overflow-hidden shadow-2xl border border-slate-200/60 bg-slate-900">
                  <img
                    src="/assets/aistudio/podcast_hero_crop.jpg"
                    alt="Go live 24/7 studio broadcast"
                    referrerPolicy="no-referrer"
                    className="w-full h-auto object-cover block"
                  />
                </div>
              </div>
            </section>

            {/* SETUP LIVE STREAMING IN 3 STEPS SECTION */}
            <section className="space-y-6">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0f172a] tracking-tight">
                Setup live streaming in 3 steps
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Step 01 Card */}
                <div
                  onClick={() => {
                    if (isLoggedIn) {
                      setActiveView('wizard');
                      setStep(1);
                    } else {
                      setShowAuthModal(true);
                    }
                  }}
                  className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-3 hover:border-slate-300 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <KeyRound className="w-5 h-5 text-[#e60012]" />
                    <span className="text-xs font-mono text-slate-400">01</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 pt-1">Stream Keys</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Paste your YouTube and Facebook stream keys once. We keep them safe.
                  </p>
                </div>

                {/* Step 02 Card */}
                <div
                  onClick={() => {
                    if (isLoggedIn) {
                      setActiveView('wizard');
                      setStep(2);
                    } else {
                      setShowAuthModal(true);
                    }
                  }}
                  className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-3 hover:border-slate-300 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <Tv className="w-5 h-5 text-[#e60012]" />
                    <span className="text-xs font-mono text-slate-400">02</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 pt-1">Stream Source</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Camera, screen broadcast or an uploaded video that loops 24/7.
                  </p>
                </div>

                {/* Step 03 Card */}
                <div
                  onClick={() => {
                    if (isLoggedIn) {
                      setActiveView('wizard');
                      setStep(3);
                    } else {
                      setShowAuthModal(true);
                    }
                  }}
                  className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-3 hover:border-slate-300 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <Radio className="w-5 h-5 text-[#e60012]" />
                    <span className="text-xs font-mono text-slate-400">03</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 pt-1">Go Live Studio</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Preview, tune quality &amp; FPS, then hit Go Live on every platform at once.
                  </p>
                </div>
              </div>
            </section>

            {/* READY TO BROADCAST? DARK NAVY BANNER */}
            <section className="rounded-[24px] bg-[#0d1526] text-white px-7 sm:px-10 py-8 sm:py-9 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Ready to broadcast?
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Sign in with Google or your mobile number to start.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-full bg-white hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-bold min-w-[200px] transition-colors cursor-pointer"
                >
                  <GoogleColorIcon />
                  <span>Continue with Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode('mobile');
                    setShowAuthModal(true);
                  }}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white hover:text-slate-300 transition-colors cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-slate-300" />
                  <span>Sign up with Mobile</span>
                </button>
              </div>
            </section>
          </div>
        </main>
      )}

      {/* ==================== VIEW 2: ADMIN PANEL ==================== */}
      {activeView === 'admin' && (
        <main className="flex-1 bg-[#f8fafc]">
          <AdminPanel
            settings={siteSettings}
            users={managedUsers}
            plans={plans}
            offers={offers}
            payments={payments}
            activeStreamCount={activeJobs.length}
            onRefreshAdminData={fetchAdminData}
            onUpdateSettings={(newSettings) => {
              lastServerSettingsJsonRef.current = JSON.stringify(newSettings);
              setSiteSettings(newSettings);
            }}
            onBackToSite={() => setActiveView(isLoggedIn ? 'wizard' : 'home')}
          />
        </main>
      )}

      {/* ==================== VIEW 3: USER DASHBOARD (100% SAME-TO-SAME WITH SCREENSHOT) ==================== */}
      {activeView === 'dashboard' && (
        <main className="flex-1 bg-[#f8fafc]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
            {/* Welcome Heading */}
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-slate-400 uppercase">
                WELCOME BACK
              </p>
              <h1 className="text-3xl sm:text-4xl font-black text-[#0f172a] tracking-tight mt-1">
                {userFirstName}&apos;s Dashboard
              </h1>
            </div>

            {/* 2-Column Main Grid: Left Dark Navy Stream Status + Right 3 Action Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Left Column: Dark Navy Stream Status Card */}
              <div className="lg:col-span-7 bg-[#0b1121] rounded-[28px] p-7 sm:p-8 text-white flex flex-col justify-between min-h-[250px] shadow-sm">
                {/* Top Row: Stream Status + Offline / Live Pill */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Stream Status</span>
                  <span
                    className={`px-3.5 py-1 rounded-full text-xs font-bold ${
                      activeJobs.length > 0
                        ? 'bg-[#e60012] text-white'
                        : 'bg-[#1e293b] text-slate-200'
                    }`}
                  >
                    {activeJobs.length > 0 ? '• Live' : 'Offline'}
                  </span>
                </div>

                {/* Middle: Active Stream Info OR "You have no active streams." */}
                {activeJobs.length === 0 ? (
                  <div className="my-6">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                      You have no active streams.
                    </h2>
                  </div>
                ) : (
                  <div className="my-5 space-y-3">
                    {activeJobs.map((job) => (
                      <div
                        key={job.jobId}
                        className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                            <Radio className="w-3.5 h-3.5" />
                            <span>
                              {job.loop247 ? '24/7 CLOUD LOOP' : 'LIVE STREAM'} ·{' '}
                              {formatDuration(job.uptimeSeconds || liveTimerSec)}
                            </span>
                          </div>
                          <p className="text-base font-extrabold text-white mt-0.5">{job.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {job.destinations.map((d) => d.channelName || d.platform).join(', ')} ·{' '}
                            {job.quality} @ {job.fps}fps
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveView('wizard');
                              setStep(3);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                          >
                            Studio
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStopJob(job.jobId, job.sessionId)}
                            className="px-3.5 py-2 rounded-xl bg-[#e60012] hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                          >
                            Stop
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom Row: YouTube & Facebook Key Connection Status */}
                <div className="flex items-center gap-4 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-4 h-3 rounded-xs border border-red-500 text-red-500 text-[7px] font-bold">
                      ▶
                    </span>
                    <span>
                      {streamKeys.some(
                        (k) =>
                          k.platform === 'youtube' &&
                          k.enabled &&
                          k.streamKey !== 'yt-live-24x7-key'
                      )
                        ? 'Connected'
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-blue-400 font-extrabold text-sm leading-none">f</span>
                    <span>
                      {streamKeys.some(
                        (k) =>
                          k.platform === 'facebook' &&
                          k.enabled &&
                          k.streamKey !== 'FB-3948102948eQ-7'
                      )
                        ? 'Connected'
                        : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: 3 Stacked Action Cards */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-3.5">
                {/* Action 1: Stream Keys */}
                <div
                  onClick={() => {
                    setActiveView('wizard');
                    setStep(1);
                  }}
                  className="bg-white rounded-[22px] border border-slate-200/90 p-5 flex items-center gap-4 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
                >
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Stream Keys</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Step 1 · add YouTube / Facebook keys
                    </p>
                  </div>
                </div>

                {/* Action 2: Start New Stream */}
                <div
                  onClick={() => {
                    setActiveView('wizard');
                    setStep(2);
                  }}
                  className="bg-white rounded-[22px] border border-slate-200/90 p-5 flex items-center gap-4 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
                >
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Start New Stream</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Camera, screen or library video
                    </p>
                  </div>
                </div>

                {/* Action 3: Upload Video */}
                <div
                  onClick={() => {
                    setActiveView('library');
                  }}
                  className="bg-white rounded-[22px] border border-slate-200/90 p-5 flex items-center gap-4 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
                >
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Upload Video</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Add a new video to your library
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Full-Width Card: Recent streams */}
            <div className="bg-white rounded-[26px] border border-slate-200/90 p-6 sm:p-7 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-slate-900">
                <History className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-extrabold">Recent streams</h3>
              </div>

              {savedSessions.length === 0 && activeJobs.length === 0 ? (
                <p className="text-xs text-slate-500">No streams yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {savedSessions.slice(0, 6).map((sess) => (
                    <div
                      key={sess.id}
                      className="py-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{sess.title}</p>
                        <p className="text-slate-500 mt-0.5">
                          {sess.destinations} · {sess.sourceType} · {sess.quality} @ {sess.fps}fps
                        </p>
                      </div>
                      <span
                        className={`font-bold uppercase ${
                          sess.status === 'live' ? 'text-red-600' : 'text-slate-400'
                        }`}
                      >
                        {sess.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ==================== VIEW 3B: VIDEO LIBRARY TAB ==================== */}
      {activeView === 'library' && (
        <main className="flex-1 bg-[#f8fafc]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-slate-400 uppercase">
                  24/7 CLOUD STORAGE
                </p>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                  Video Library
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload short or long-format videos to loop 24/7 on YouTube &amp; Facebook.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={uploadingVideo}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingVideo ? 'Uploading...' : 'Upload Video from Device'}</span>
                </button>
              </div>
            </div>

            {uploadingVideo && (
              <div className="bg-white rounded-2xl border border-purple-200 p-5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                  <span>Uploading Video to 24/7 Server...</span>
                  <span className="font-mono tabular-nums">{uploadProgressText}</span>
                </div>
                <div className="w-full h-2.5 bg-purple-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#7c3aed] transition-all duration-150"
                    style={{ width: `${uploadProgressPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="bg-white rounded-[26px] border border-slate-200/90 divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {videos.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  No videos in your library yet. Click &quot;Upload Video from Device&quot; to add one.
                </div>
              ) : (
                videos.map((v) => (
                  <div
                    key={v.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <Video className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 break-all">
                          {v.originalName}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                          {formatMegabytes(v.sizeBytes)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVideoId(v.id);
                          setSourceType('video');
                          setActiveView('wizard');
                          setStep(3);
                        }}
                        className="px-4 py-2 rounded-full bg-[#e60012] hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Go Live with Video →
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVideo(v.id)}
                        className="p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      {/* ==================== VIEW 4: 3-STEP STREAMING SETUP WIZARD (GO LIVE) ==================== */}
      {activeView === 'wizard' && (
        <main className="flex-1 bg-[#f8fafc]">
          <div className="max-w-[540px] mx-auto px-4 sm:px-6 py-8">
            {/* Step Switcher Header Bar (100% Same-to-Same with Screenshot_2026-10-28_115432_06a380f9.jpg) */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center bg-white border border-slate-200/90 rounded-full p-1.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    step === 1
                      ? 'bg-[#e60012] text-white shadow-xs'
                      : 'text-slate-800 hover:text-slate-950'
                  }`}
                >
                  1. YouTube &amp; Key
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    step === 2
                      ? 'bg-[#e60012] text-white shadow-xs'
                      : 'text-slate-800 hover:text-slate-950'
                  }`}
                >
                  {t.step2Tab}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    step === 3
                      ? 'bg-[#e60012] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.step3Tab}
                </button>
              </div>
            </div>

            {/* Wizard Main Card */}
            <div className="bg-white rounded-[28px] border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-5">
              {/* Top Back Arrow */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (step > 1) {
                      setStep((prev) => (prev - 1) as 1 | 2 | 3);
                    } else {
                      setActiveView('home');
                    }
                  }}
                  className="p-1 -ml-1 text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-xs text-slate-400">
                  Logged in: <strong className="text-slate-700">{activeIdentifier}</strong> (
                  {currentUserPlan})
                </span>
              </div>

              {/* Feedback Toast inside Card */}
              {formFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 ${
                    formFeedback.type === 'error'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {formFeedback.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    )}
                    <span>{formFeedback.message}</span>
                  </div>
                  <button type="button" onClick={() => setFormFeedback(null)}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* ==================== STEP 1: STREAM KEYS ==================== */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {t.streamKeysTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      {t.streamKeysSubtitle}
                    </p>
                  </div>

                  {/* Saved Stream Keys List */}
                  <div className="space-y-3">
                    {streamKeys.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleStreamKey(item)}
                        className={`cursor-pointer rounded-2xl border px-4 py-3.5 flex items-center justify-between transition-all ${
                          item.enabled
                            ? 'border-[#b91c1c] bg-white'
                            : 'border-slate-200 bg-slate-50/50 opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                            {item.platform === 'youtube' ? (
                              <span className="inline-flex items-center justify-center w-6 h-4 rounded bg-red-600 text-white text-[9px] font-bold">
                                ▶
                              </span>
                            ) : item.platform === 'facebook' ? (
                              <span className="text-blue-600 font-extrabold text-lg leading-none">
                                f
                              </span>
                            ) : (
                              <Radio className="w-4 h-4 text-purple-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {item.channelName ||
                                (item.platform === 'youtube'
                                  ? 'YouTube'
                                  : item.platform === 'facebook'
                                  ? 'Facebook'
                                  : 'Custom RTMP')}
                            </p>
                            <p className="text-xs text-slate-500 font-mono tracking-wider mt-0.5">
                              {maskStreamKey(item.streamKey, item.platform)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteStreamKey(item);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                            aria-label="Delete stream key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                              item.enabled
                                ? 'bg-[#e60012] text-white'
                                : 'border-2 border-slate-300 bg-white'
                            }`}
                          >
                            {item.enabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add New Stream Key Box */}
                  <form
                    onSubmit={handleSaveStreamKey}
                    className="border border-slate-200 rounded-2xl p-4 space-y-3"
                  >
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectPlatformTab('youtube')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          newPlatform === 'youtube'
                            ? 'border-[#b91c1c] bg-red-50/20 text-slate-900'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="inline-flex items-center justify-center w-4 h-3 rounded-xs bg-red-600 text-white text-[8px]">
                          ▶
                        </span>
                        <span>YouTube</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectPlatformTab('facebook')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          newPlatform === 'facebook'
                            ? 'border-[#b91c1c] bg-red-50/20 text-slate-900'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-blue-600 font-extrabold text-sm leading-none">
                          f
                        </span>
                        <span>Facebook</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectPlatformTab('custom')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          newPlatform === 'custom'
                            ? 'border-[#b91c1c] bg-red-50/20 text-slate-900'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Radio className="w-3.5 h-3.5 text-purple-600" />
                        <span>Custom RTMP</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      maxLength={MAX_CHANNEL_NAME_LEN}
                      placeholder={t.channelNamePlaceholder}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                    />

                    <div className="relative">
                      <input
                        type={showKeySecret ? 'text' : 'password'}
                        value={streamKeyInput}
                        onChange={(e) => setStreamKeyInput(e.target.value)}
                        maxLength={MAX_STREAM_KEY_LEN}
                        placeholder={t.streamKeyPlaceholder}
                        className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeySecret((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        aria-label="Toggle stream key visibility"
                      >
                        {showKeySecret ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <input
                      type="text"
                      value={rtmpUrlInput}
                      onChange={(e) => setRtmpUrlInput(e.target.value)}
                      maxLength={MAX_RTMP_URL_LEN}
                      placeholder={t.rtmpUrlPlaceholder}
                      className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50/70 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-slate-400"
                    />

                    <button
                      type="submit"
                      disabled={savingKey}
                      className="w-full py-3 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                    >
                      {savingKey ? t.savingKey : t.saveStreamKey}
                    </button>
                  </form>

                  {renderQuickSettingsBar()}

                  <button
                    type="button"
                    onClick={handleStep1Next}
                    className="w-full py-3.5 rounded-2xl bg-[#e60012] hover:bg-red-700 text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {t.nextBtn}
                  </button>
                </div>
              )}

              {/* ==================== STEP 2: STREAM SOURCE ==================== */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {t.streamSourceTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      {t.destinationLabel}{' '}
                      <span className="font-bold text-slate-800">{destinationSummary}</span>
                    </p>
                  </div>

                  {/* Option 1: Stream Camera */}
                  <div
                    onClick={() => {
                      setSourceType('camera');
                      setStep(3);
                    }}
                    className={`cursor-pointer rounded-2xl border p-4 flex items-center justify-between transition-all ${
                      sourceType === 'camera'
                        ? 'border-[#e60012] bg-red-50/10'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{t.streamCameraTitle}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Front Webcam / Selfie Cam · {quality} @ {fps}fps
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>

                  {/* Option 2: Screen Broadcast */}
                  <div
                    onClick={() => {
                      setSourceType('screen');
                      setStep(3);
                    }}
                    className={`cursor-pointer rounded-2xl border p-4 flex items-center justify-between transition-all ${
                      sourceType === 'screen'
                        ? 'border-[#e60012] bg-red-50/10'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {t.screenBroadcastTitle}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{t.screenBroadcastDesc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>

                  {/* Option 3: Uploaded Video */}
                  <div
                    onClick={() => setSourceType('video')}
                    className={`rounded-2xl border p-4 space-y-4 transition-all ${
                      sourceType === 'video'
                        ? 'border-[#e60012] bg-white'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                          <Video className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{t.videoSourceTitle}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{t.videoSourceDesc}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>

                    {uploadingVideo && (
                      <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                          <span>Uploading Video...</span>
                          <span className="font-mono tabular-nums">{uploadProgressText}</span>
                        </div>
                        <div className="w-full h-2.5 bg-purple-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#7c3aed] transition-all duration-150"
                            style={{ width: `${uploadProgressPct}%` }}
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelUploadRef.current = true;
                            }}
                            className="text-[11px] font-semibold text-red-600 hover:underline"
                          >
                            Cancel Upload
                          </button>
                        </div>
                      </div>
                    )}

                    {videos.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-2 max-h-48 overflow-y-auto">
                        {videos.map((v) => (
                          <div
                            key={v.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVideoId(v.id);
                              setSourceType('video');
                            }}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                              selectedVideo?.id === v.id
                                ? 'bg-purple-50 font-bold text-purple-950 border border-purple-200'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span className="truncate max-w-[260px] sm:max-w-[310px]">
                              {v.originalName}
                            </span>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="text-slate-400 tabular-nums">
                                {formatMegabytes(v.sizeBytes)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteVideo(v.id);
                                }}
                                className="text-slate-400 hover:text-red-600"
                                aria-label="Delete uploaded video"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*,.mp4,.webm,.mkv,.mov,.avi,.flv,.m4v"
                        onChange={handleVideoFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={uploadingVideo}
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#7c3aed] hover:bg-purple-700 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingVideo ? t.uploadingVideo : t.chooseVideoBtn}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowVideoStudioModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-[#f87171] hover:bg-red-500 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>{t.openVideoStudioBtn}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {renderQuickSettingsBar()}

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-full py-3.5 rounded-2xl bg-[#e60012] hover:bg-red-700 text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {t.nextBtn}
                  </button>
                </div>
              )}

              {/* ==================== STEP 3: GO LIVE STUDIO ==================== */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mr-1">
                        {t.goLiveStudioTitle}
                      </h2>
                      <input
                        ref={thumbnailInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => thumbnailInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>{thumbnailDataUrl ? t.changeThumbnail : t.addThumbnail}</span>
                      </button>

                      {/* Preview 4s Thumbnail Intro on Live Stream for Viewers */}
                      {thumbnailDataUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            if (showThumbnailToViewers) {
                              setShowThumbnailToViewers(false);
                              setThumbnailCountdownSec(0);
                            } else {
                              triggerThumbnailIntro(4);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            showThumbnailToViewers
                              ? 'bg-purple-600 text-white'
                              : 'bg-purple-50 text-purple-800 border border-purple-200'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>
                            {showThumbnailToViewers
                              ? `Thumbnail Intro (${thumbnailCountdownSec || 1}s)`
                              : 'Preview Thumbnail (4s)'}
                          </span>
                        </button>
                      )}

                      {/* Website Logo Watermark Control: Controlled by Admin Panel -> User List Permission */}
                      {!canUserHideLogo ? (
                        siteSettings.showLogoOnFreeStream && (
                          <button
                            type="button"
                            onClick={() => setShowPlansModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                            title="Website Logo Hide/Unhide permission is controlled by Admin in User List."
                          >
                            <Crown className="w-3.5 h-3.5 text-amber-600" />
                            <span>Logo: Always On</span>
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPaidUserShowLogo((prev) => !prev)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            paidUserShowLogo
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {paidUserShowLogo ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Hide Website Logo</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Unhide Website Logo</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide whitespace-nowrap shrink-0 ${
                        currentActiveJob
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {currentActiveJob ? t.statusLive : t.statusOffline}
                    </span>
                  </div>

                  {/* Video Preview Monitor */}
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#060814] flex items-center justify-center border border-slate-900">
                    {/* Website Logo Watermark (Always shown when not allowed to hide; Hide/Unhide when allowed in Admin User List) */}
                    {effectiveShowStreamLogo && (
                      <div className="absolute top-3 left-3 z-30 flex flex-col items-start gap-1.5">
                        <div className="bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg shadow-sm border border-white/40">
                          <img
                            src={siteSettings.logoUrl}
                            alt="Website Logo Watermark"
                            referrerPolicy="no-referrer"
                            className="h-5 w-auto object-contain"
                          />
                        </div>
                        <div className="bg-black/75 backdrop-blur-xs text-white px-2.5 py-1 rounded-md text-xs font-mono font-semibold tabular-nums">
                          {formatDuration(liveTimerSec)}
                        </div>
                      </div>
                    )}

                    {!effectiveShowStreamLogo && (
                      <div className="absolute top-3 left-3 z-30 bg-black/75 backdrop-blur-xs text-white px-2.5 py-1 rounded-md text-xs font-mono font-semibold tabular-nums">
                        {formatDuration(liveTimerSec)}
                      </div>
                    )}

                    <div className="absolute top-3 right-3 z-30 bg-black/75 backdrop-blur-xs text-white px-2.5 py-1 rounded-md text-xs font-mono font-semibold tabular-nums">
                      {quality} · {fps}fps
                    </div>

                    {/* Uploaded Thumbnail 4-Second Intro Overlay (Shows like YouTube/Facebook, then auto-plays video) */}
                    {thumbnailDataUrl && showThumbnailToViewers && (
                      <div className="absolute inset-0 z-20 bg-black flex items-center justify-center">
                        <img
                          src={thumbnailDataUrl}
                          alt="Live Stream Thumbnail"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute bottom-3 right-3 bg-black/80 text-white px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>
                            Playing live video in {thumbnailCountdownSec || 1}s...
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowThumbnailToViewers(false);
                              setThumbnailCountdownSec(0);
                            }}
                            className="underline text-amber-300 ml-1 cursor-pointer"
                          >
                            Play Now
                          </button>
                        </div>
                      </div>
                    )}

                    {sourceType !== 'video' && (
                      <button
                        type="button"
                        onClick={handleToggleMic}
                        className="absolute bottom-3 left-3 z-30 bg-black/75 hover:bg-black text-white p-2 rounded-full transition-colors"
                        aria-label="Toggle Microphone"
                      >
                        {isMicMuted ? (
                          <MicOff className="w-4 h-4 text-red-400" />
                        ) : (
                          <Mic className="w-4 h-4 text-emerald-400" />
                        )}
                      </button>
                    )}

                    {sourceType === 'video' ? (
                      selectedVideo ? (
                        <div className="relative h-full w-full flex items-center justify-center">
                          <video
                            ref={uploadedVideoPlayerRef}
                            key={selectedVideo.url}
                            src={selectedVideo.url}
                            poster={thumbnailDataUrl || undefined}
                            className="h-full w-full object-contain"
                            preload="auto"
                            autoPlay
                            loop={loop247}
                            controls
                            muted
                            playsInline
                            onEnded={(e) => {
                              if (loop247) {
                                const v = e.currentTarget;
                                v.currentTime = 0;
                                v.play().catch(() => {});
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="text-center text-slate-400 text-xs p-6">
                          No video selected. Go back to Step 2 to choose or upload a video.
                        </div>
                      )
                    ) : (
                      <video
                        ref={videoPreviewRef}
                        poster={thumbnailDataUrl || undefined}
                        className="w-full h-full object-contain"
                        autoPlay
                        playsInline
                        muted
                      />
                    )}
                  </div>

                  <input
                    type="text"
                    value={streamTitle}
                    onChange={(e) => setStreamTitle(e.target.value)}
                    maxLength={MAX_TITLE_LEN}
                    placeholder={t.streamTitlePlaceholder}
                    className="w-full px-4 py-3 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                  />

                  <div className="rounded-xl bg-[#f5f3ff] px-4 py-3 flex items-start gap-3 text-xs text-[#6d28d9] leading-relaxed">
                    <Repeat className="w-4 h-4 text-[#7c3aed] shrink-0 mt-0.5" />
                    <span>
                      {sourceType === 'video' ? t.serverLoopBanner : t.browserStreamBanner}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isStartingStream}
                    onClick={handleGoLiveOrStop}
                    className={`w-full py-4 rounded-2xl text-white text-sm sm:text-base font-bold flex items-center justify-center gap-2.5 shadow-sm transition-colors cursor-pointer ${
                      currentActiveJob
                        ? 'bg-slate-900 hover:bg-slate-800'
                        : 'bg-[#e60012] hover:bg-red-700'
                    }`}
                  >
                    <Radio className="w-5 h-5" />
                    <span>
                      {isStartingStream
                        ? t.startingStream
                        : currentActiveJob
                        ? t.stopLiveBtn
                        : t.goLiveNowBtn}
                    </span>
                  </button>

                  {currentActiveJob && (
                    <div
                      className={`rounded-xl p-3.5 text-xs space-y-1 font-mono ${
                        currentActiveJob.errorMessage
                          ? 'bg-red-950 text-red-200 border border-red-800'
                          : 'bg-slate-900 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span
                          className={
                            currentActiveJob.errorMessage ? 'text-red-400' : 'text-emerald-400'
                          }
                        >
                          {currentActiveJob.errorMessage
                            ? 'RTMP CONNECTION WARNING'
                            : `RTMP ENCODER LIVE (${currentActiveJob.quality} · ${currentActiveJob.fps}fps)`}
                        </span>
                        <span className="tabular-nums">
                          {currentActiveJob.bitrateKbps} kbps · {currentActiveJob.framesSent} frames
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 break-words leading-relaxed">
                        {currentActiveJob.lastLog}
                      </p>
                    </div>
                  )}

                  {renderQuickSettingsBar()}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ==================== DARK NAVY FOOTER (100% SAME-TO-SAME WITH SCREENSHOT) ==================== */}
      <footer className="mt-auto bg-[#0a101f] text-slate-300 py-12 px-6 sm:px-10 border-t border-slate-800/80">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Column 1 (Left Side): Brand, Tagline, Social Links & Admin Panel Link */}
          <div className="space-y-2.5">
            <h3 className="text-base font-extrabold text-white tracking-tight">
              {siteSettings.websiteName}
            </h3>
            <p className="text-xs text-slate-400">{siteSettings.tagline}</p>
            <div className="flex items-center gap-3 pt-2 text-xs text-slate-400">
              {siteSettings.youtubeUrl && (
                <a
                  href={siteSettings.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  YouTube
                </a>
              )}
              {siteSettings.facebookUrl && (
                <a
                  href={siteSettings.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Facebook
                </a>
              )}
              {siteSettings.instagramUrl && (
                <a
                  href={siteSettings.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Instagram
                </a>
              )}
              {siteSettings.twitterUrl && (
                <a
                  href={siteSettings.twitterUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  X
                </a>
              )}
            </div>
            {/* Admin Panel Link on Left Side of Footer */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveView('admin');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-[#e60012]" />
                <span>Admin Panel</span>
              </button>
            </div>
          </div>

          {/* Column 2: Location Address */}
          <div className="flex items-start gap-2.5 text-xs text-slate-300">
            <MapPin className="w-4 h-4 text-[#e60012] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white">{siteSettings.websiteName}</p>
              <p className="text-slate-400">{siteSettings.businessAddress}, India</p>
            </div>
          </div>

          {/* Column 3: Support Us (Phone, WhatsApp, Email, Copyright) */}
          <div className="space-y-2.5 text-xs">
            <h4 className="font-bold text-white">Support Us</h4>
            <p className="text-slate-400">{siteSettings.supportMessage}</p>
            <div className="space-y-2 pt-1">
              <a
                href={`tel:${siteSettings.mobileNumber}`}
                className="flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#e60012] shrink-0" />
                <span className="tabular-nums">{siteSettings.mobileNumber}</span>
              </a>

              <a
                href={`https://wa.me/${siteSettings.whatsappNumber.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>WhatsApp</span>
              </a>

              <a
                href={`mailto:${siteSettings.supportEmail}`}
                className="flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[#e60012] shrink-0" />
                <span>{siteSettings.supportEmail}</span>
              </a>
            </div>
            <p className="text-[11px] text-slate-500 pt-2">© 2026 creatorlive247.com</p>
          </div>
        </div>
      </footer>

      {/* ==================== SIGN IN / SIGN UP WITH MOBILE OR GOOGLE MODAL ==================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {authModalMode === 'google' && <GoogleColorIcon />}
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    {authModalMode === 'mobile'
                      ? 'Sign up / Login with Mobile'
                      : 'Continue with Google'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {authModalMode === 'mobile'
                      ? 'Enter your mobile number to access Live Studio'
                      : 'Sign in with your Google Account (@gmail.com)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  setGoogleDomainNotice(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs: Google vs Mobile */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100">
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('google');
                  setTimeout(() => authInputRef.current?.focus(), 40);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  authModalMode !== 'mobile'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GoogleColorIcon />
                <span>Google Account</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('mobile');
                  setTimeout(() => authInputRef.current?.focus(), 40);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  authModalMode === 'mobile'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Mobile Number</span>
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleMobileOrEmailSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    {authModalMode === 'mobile'
                      ? 'Mobile Number'
                      : 'Google Email ID (@gmail.com)'}
                  </label>
                  {authModalMode !== 'mobile' &&
                    !mobileOrEmailInput.includes('@') &&
                    mobileOrEmailInput.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMobileOrEmailInput(`${mobileOrEmailInput.trim()}@gmail.com`)
                        }
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        + Add @gmail.com
                      </button>
                    )}
                </div>
                <input
                  ref={authInputRef}
                  type="text"
                  required
                  value={mobileOrEmailInput}
                  onChange={(e) => setMobileOrEmailInput(e.target.value)}
                  placeholder={
                    authModalMode === 'mobile'
                      ? 'e.g. 9471085404'
                      : 'e.g. yourname@gmail.com'
                  }
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Your Name (optional)
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Laxmi Kumari"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              {authModalMode !== 'mobile' ? (
                <button
                  type="submit"
                  className="w-full py-3.5 px-5 rounded-full bg-[#0f172a] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 shadow-sm transition-colors cursor-pointer"
                >
                  <GoogleColorIcon />
                  <span>Continue with Google →</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-full bg-[#0f172a] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                >
                  Continue with Mobile →
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ==================== SUBSCRIPTION PLANS & UPI PAYMENT MODAL ==================== */}
      {showPlansModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  {siteSettings.websiteName} Subscription Plans
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upgrade to remove stream watermark and unlock 1080p 60fps 24/7 Cloud Looping.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPlansModal(false);
                  setSelectedPlanForUpi(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeOffer && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center justify-between">
                <span>{activeOffer.bannerText}</span>
                <span className="font-mono bg-white px-2.5 py-1 rounded-lg border border-red-200">
                  {activeOffer.code}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans
                .filter((p) => p.active)
                .map((plan) => (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between space-y-4 ${
                      currentUserPlan === plan.name
                        ? 'border-[#e60012] bg-red-50/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-extrabold text-slate-900">{plan.name}</h4>
                        <span className="text-[11px] font-bold text-slate-500">
                          {plan.resolution}
                        </span>
                      </div>
                      <p className="text-2xl font-black text-slate-900 tabular-nums">
                        ₹{plan.priceInr}
                        <span className="text-xs font-normal text-slate-500">
                          /{plan.billingCycle}
                        </span>
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">{plan.description}</p>
                    </div>

                    {plan.priceInr === 0 ? (
                      <span className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold text-center block">
                        {currentUserPlan === 'Free' ? 'Current Plan' : 'Included'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedPlanForUpi(plan)}
                        className="w-full py-2.5 rounded-xl bg-[#e60012] hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        {currentUserPlan === plan.name ? 'Active Plan' : `Choose ${plan.name}`}
                      </button>
                    )}
                  </div>
                ))}
            </div>

            {selectedPlanForUpi && (
              <form
                onSubmit={handleSubmitUpiPayment}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Pay ₹{selectedPlanForUpi.priceInr} via UPI for {selectedPlanForUpi.name}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      UPI ID: <strong className="font-mono">{siteSettings.upiId}</strong> (Payee:{' '}
                      {siteSettings.upiPayeeName})
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    placeholder="Enter 12-digit UPI UTR / Reference No."
                    className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#0f172a] text-white text-xs font-bold cursor-pointer"
                  >
                    Submit Payment UTR
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Tips Modal */}
      {showTipsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{t.tipsTitle}</h3>
              <button
                type="button"
                onClick={() => setShowTipsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="font-bold text-red-600 mb-1">{t.tipsYoutubeTitle}</p>
                <p className="whitespace-pre-line">{t.tipsYoutubeSteps}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="font-bold text-blue-600 mb-1">{t.tipsFacebookTitle}</p>
                <p className="whitespace-pre-line">{t.tipsFacebookSteps}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowTipsModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Video Studio Modal */}
      {showVideoStudioModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleGenerateStudioVideo}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{t.videoStudioTitle}</h3>
              <button
                type="button"
                onClick={() => setShowVideoStudioModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">{t.videoStudioSubtitle}</p>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Loop Video Filename / Title
                <input
                  type="text"
                  value={studioClipTitle}
                  onChange={(e) => setStudioClipTitle(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowVideoStudioModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={studioGenerating}
                className="px-4 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-purple-700 text-white text-xs font-bold"
              >
                {studioGenerating ? t.generatingVideo : t.generateLoopVideo}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
