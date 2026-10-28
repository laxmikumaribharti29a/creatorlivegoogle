import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn, execFile, ChildProcessWithoutNullStreams } from 'child_process';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const CHUNKS_DIR = path.join(UPLOADS_DIR, 'chunks');
const CATALOG_FILE = path.join(UPLOADS_DIR, 'videos-index.json');
const ADMIN_DATA_FILE = path.join(UPLOADS_DIR, 'admin-data.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

export interface RtmpDestination {
  id: string;
  platform: 'youtube' | 'facebook' | 'custom';
  channelName: string;
  rtmpUrl: string;
  streamKey: string;
}

export interface ServerStreamJob {
  jobId: string;
  userId: string;
  sessionId: string;
  title: string;
  sourceType: 'video' | 'camera' | 'screen';
  videoId?: string;
  videoFileName?: string;
  orientation: 'landscape' | 'portrait';
  quality: '480p' | '720p' | '1080p';
  fps: number;
  loop247: boolean;
  destinations: RtmpDestination[];
  status: 'live' | 'stopping' | 'stopped' | 'error';
  errorMessage?: string;
  startedAt: number;
  processes: ChildProcessWithoutNullStreams[];
  lastLog: string;
  framesSent: number;
  bitrateKbps: number;
}

export interface UploadedVideoFile {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  hasAudio?: boolean;
  durationSec?: number;
  createdAt: number;
}

export interface ManagedUser {
  id: string;
  identifier: string; // email or mobile
  name: string;
  isAdmin?: boolean;
  plan: string;
  planExpiry?: string;
  allowLogoHide?: boolean;
  liveCount: number;
  active: boolean;
  createdAt: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceInr: number;
  billingCycle: string;
  resolution: '720p' | '1080p';
  loop247Allowed: boolean;
  removeWatermark: boolean;
  description: string;
  active: boolean;
}

export interface PromoOffer {
  id: string;
  title: string;
  code: string;
  discountPercent: number;
  bannerText: string;
  validTill: string;
  active: boolean;
}

export interface PaymentRecord {
  id: string;
  userIdentifier: string;
  userName: string;
  planName: string;
  amountInr: number;
  utrNumber: string;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
}

export interface MainPageSettings {
  websiteName: string;
  tagline: string;
  businessAddress: string;
  logoUrl: string;
  showLogoOnFreeStream: boolean;
  mobileNumber: string;
  whatsappNumber: string;
  supportEmail: string;
  supportMessage: string;
  youtubeUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  upiId: string;
  upiPayeeName: string;
  adminEmail: string;
  adminPassword?: string;
}

export interface AdminStoreData {
  settings: MainPageSettings;
  users: ManagedUser[];
  plans: SubscriptionPlan[];
  offers: PromoOffer[];
  payments: PaymentRecord[];
}

const DEFAULT_ADMIN_DATA: AdminStoreData = {
  settings: {
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
    adminEmail: 'typing.classes@gmail.com',
    adminPassword: 'admin123',
  },
  users: [
    {
      id: 'usr_1',
      identifier: '9471085404',
      name: 'aditya anand',
      plan: 'Free',
      allowLogoHide: false,
      liveCount: 0,
      active: true,
      createdAt: Date.now() - 86400000 * 6,
    },
    {
      id: 'usr_2',
      identifier: '9123456780',
      name: 'Test Mobile',
      plan: 'Free',
      allowLogoHide: false,
      liveCount: 0,
      active: true,
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'usr_3',
      identifier: 'creatorlaxmi2@gmail.com',
      name: 'laxmi kumari',
      plan: 'Pro Monthly',
      planExpiry: 'till 26/11/2026',
      allowLogoHide: true,
      liveCount: 0,
      active: true,
      createdAt: Date.now() - 86400000 * 4,
    },
    {
      id: 'usr_4',
      identifier: 'typing.classes@gmail.com',
      name: 'Typing Classes',
      isAdmin: true,
      plan: 'Free',
      allowLogoHide: true,
      liveCount: 0,
      active: true,
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'usr_5',
      identifier: 'maasitaniwas@gmail.com',
      name: 'Maa Sita',
      plan: 'Free',
      allowLogoHide: false,
      liveCount: 0,
      active: true,
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'usr_6',
      identifier: 'test.user@example.com',
      name: 'Test User',
      plan: 'Free',
      allowLogoHide: false,
      liveCount: 0,
      active: true,
      createdAt: Date.now() - 86400000 * 1,
    },
    {
      id: 'usr_7',
      identifier: 'rowaterwallah@gmail.com',
      name: 'Admin User',
      isAdmin: true,
      plan: 'Pro Yearly',
      planExpiry: 'till 27/10/2027',
      allowLogoHide: true,
      liveCount: 0,
      active: true,
      createdAt: Date.now(),
    },
  ],
  plans: [
    {
      id: 'plan_free',
      name: 'Free',
      priceInr: 0,
      billingCycle: 'Forever',
      resolution: '720p',
      loop247Allowed: true,
      removeWatermark: false,
      description: 'Stream camera, screen or 720p loop with CreatorLive24/7 watermark.',
      active: true,
    },
    {
      id: 'plan_pro_monthly',
      name: 'Pro Monthly',
      priceInr: 499,
      billingCycle: 'per month',
      resolution: '1080p',
      loop247Allowed: true,
      removeWatermark: true,
      description: 'Full HD 1080p @ 60fps 24/7 non-stop cloud loop on YouTube & Facebook without watermark.',
      active: true,
    },
    {
      id: 'plan_pro_yearly',
      name: 'Pro Yearly',
      priceInr: 4499,
      billingCycle: 'per year',
      resolution: '1080p',
      loop247Allowed: true,
      removeWatermark: true,
      description: 'Unlimited 24/7 cloud broadcasting, multi-platform RTMP, no watermark + priority server.',
      active: true,
    },
  ],
  offers: [
    {
      id: 'offer_1',
      title: 'Festive Creator Special Offer',
      code: 'PATNA50',
      discountPercent: 50,
      bannerText: 'Special Offer: Get 50% OFF on Pro Monthly 24/7 Cloud Streaming! Use code PATNA50',
      validTill: '30/11/2026',
      active: true,
    },
  ],
  payments: [
    {
      id: 'pay_1',
      userIdentifier: 'creatorlaxmi2@gmail.com',
      userName: 'laxmi kumari',
      planName: 'Pro Monthly',
      amountInr: 499,
      utrNumber: '630194827412',
      status: 'approved',
      createdAt: '26/10/2026',
    },
  ],
};

let adminStore: AdminStoreData = JSON.parse(JSON.stringify(DEFAULT_ADMIN_DATA));

function loadAdminStore() {
  try {
    if (fs.existsSync(ADMIN_DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ADMIN_DATA_FILE, 'utf-8'));
      const rawUsers: ManagedUser[] =
        Array.isArray(parsed.users) && parsed.users.length > 0
          ? parsed.users
          : DEFAULT_ADMIN_DATA.users;
      adminStore = {
        settings: { ...DEFAULT_ADMIN_DATA.settings, ...(parsed.settings || {}) },
        users: rawUsers.map((u) => ({
          ...u,
          allowLogoHide:
            typeof u.allowLogoHide === 'boolean' ? u.allowLogoHide : Boolean(u.plan && u.plan !== 'Free'),
        })),
        plans: Array.isArray(parsed.plans) && parsed.plans.length > 0 ? parsed.plans : DEFAULT_ADMIN_DATA.plans,
        offers: Array.isArray(parsed.offers) ? parsed.offers : DEFAULT_ADMIN_DATA.offers,
        payments: Array.isArray(parsed.payments) ? parsed.payments : DEFAULT_ADMIN_DATA.payments,
      };
    } else {
      saveAdminStore();
    }
  } catch {
    saveAdminStore();
  }
}

function saveAdminStore() {
  try {
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(adminStore, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

const uploadedVideos = new Map<string, UploadedVideoFile>();
const activeJobs = new Map<string, ServerStreamJob>();

function saveCatalog() {
  try {
    const arr = Array.from(uploadedVideos.values());
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch {
    // ignore write error
  }
}

function loadCatalog() {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8'));
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (item && item.id && item.filePath && fs.existsSync(item.filePath)) {
            uploadedVideos.set(item.id, item);
          }
        }
      }
    }
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const f of files) {
      if (f === 'chunks' || f === 'videos-index.json' || f === 'admin-data.json' || f.startsWith('.')) continue;
      const fullPath = path.join(UPLOADS_DIR, f);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      const ext = path.extname(f).toLowerCase();
      if (!['.mp4', '.webm', '.mkv', '.mov', '.avi', '.flv', '.m4v'].includes(ext)) continue;

      const existing = Array.from(uploadedVideos.values()).find((v) => v.fileName === f);
      if (!existing) {
        const id = path.basename(f, ext);
        uploadedVideos.set(id, {
          id,
          originalName: f.startsWith('sample_')
            ? '20_30_की_उम्र_में_अमीर_बनने_का_रहस्य_reelshorts.webm'
            : f,
          fileName: f,
          filePath: fullPath,
          sizeBytes: stat.size,
          createdAt: stat.mtimeMs || Date.now(),
        });
      }
    }
    saveCatalog();
  } catch (err) {
    console.warn('Catalog load warning:', err);
  }
}

function probeVideoFile(filePath: string): Promise<{ hasAudio: boolean; durationSec: number }> {
  return new Promise((resolve) => {
    execFile(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type:format=duration',
        '-of',
        'json',
        filePath,
      ],
      { timeout: 8000 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve({ hasAudio: false, durationSec: 0 });
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
          const hasAudio = streams.some((s: { codec_type?: string }) => s.codec_type === 'audio');
          const durationSec = parseFloat(parsed.format?.duration || '0') || 0;
          resolve({ hasAudio, durationSec });
        } catch {
          resolve({ hasAudio: false, durationSec: 0 });
        }
      }
    );
  });
}

function ensureSampleVideo(): Promise<UploadedVideoFile> {
  const sampleId = 'sample_reelshorts_24_7';
  const existing = uploadedVideos.get(sampleId);
  if (existing && fs.existsSync(existing.filePath)) {
    return Promise.resolve(existing);
  }

  const fileName = 'sample_creatorlive_247.mp4';
  const filePath = path.join(UPLOADS_DIR, fileName);

  return new Promise((resolve, reject) => {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const item: UploadedVideoFile = {
        id: sampleId,
        originalName: '20_30_की_उम्र_में_अमीर_बनने_का_रहस्य_reelshorts.mp4',
        fileName,
        filePath,
        sizeBytes: stats.size,
        hasAudio: true,
        durationSec: 6,
        createdAt: Date.now(),
      };
      uploadedVideos.set(sampleId, item);
      saveCatalog();
      return resolve(item);
    }

    const ff = spawn('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'testsrc2=size=720x1280:rate=30:duration=6',
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:sample_rate=44100:duration=6',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-b:v', '1000k',
      '-c:a', 'aac',
      '-b:a', '128k',
      filePath,
    ]);

    ff.on('close', (code) => {
      if (code === 0 && fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const item: UploadedVideoFile = {
          id: sampleId,
          originalName: '20_30_की_उम्र_में_अमीर_बनने_का_रहस्य_reelshorts.mp4',
          fileName,
          filePath,
          sizeBytes: stats.size,
          hasAudio: true,
          durationSec: 6,
          createdAt: Date.now(),
        };
        uploadedVideos.set(sampleId, item);
        saveCatalog();
        resolve(item);
      } else {
        reject(new Error(`FFmpeg sample generation exited with code ${code}`));
      }
    });
    ff.on('error', reject);
  });
}

function buildFullRtmpUrl(rtmpUrl: string, streamKey: string, platform?: string): string {
  const cleanKey = streamKey.trim();
  if (cleanKey.startsWith('rtmp://') || cleanKey.startsWith('rtmps://')) {
    if (cleanKey.includes('youtube.com') && cleanKey.startsWith('rtmp://')) {
      return cleanKey
        .replace(/^rtmp:\/\/a\.rtmp\.youtube\.com\/live2/i, 'rtmps://a.rtmps.youtube.com:443/live2')
        .replace(/^rtmp:\/\/b\.rtmp\.youtube\.com\/live2/i, 'rtmps://b.rtmps.youtube.com:443/live2')
        .replace(/^rtmp:\/\/([^/]+)\/live2/i, 'rtmps://a.rtmps.youtube.com:443/live2');
    }
    return cleanKey;
  }

  // Auto-detect YouTube vs Facebook keys so YouTube keys never accidentally hit Facebook's RTMPS server
  const isFacebookKey = cleanKey.startsWith('FB-');
  const isYoutubePattern =
    /^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}(-[a-zA-Z0-9]{4})?$/.test(
      cleanKey
    );

  let base = rtmpUrl.trim().replace(/\/+$/, '');
  if (isFacebookKey) {
    base = 'rtmps://live-api-s.facebook.com:443/rtmp';
  } else if (isYoutubePattern || platform === 'youtube') {
    if (!base || base.includes('facebook.com') || base.startsWith('rtmp://')) {
      base = 'rtmps://a.rtmps.youtube.com:443/live2';
    }
  } else if (!base) {
    if (platform === 'facebook') {
      base = 'rtmps://live-api-s.facebook.com:443/rtmp';
    } else {
      base = 'rtmps://a.rtmps.youtube.com:443/live2';
    }
  } else if (base.includes('youtube.com') && base.startsWith('rtmp://')) {
    // Always use RTMPS port 443 for YouTube because outbound TCP port 1935 is blocked in cloud environments
    base = 'rtmps://a.rtmps.youtube.com:443/live2';
  }

  const trimmedKey = cleanKey.replace(/^\/+/, '');
  return `${base}/${trimmedKey}`;
}

function getResolutionArgs(
  quality: '480p' | '720p' | '1080p',
  orientation: 'landscape' | 'portrait'
): { width: number; height: number; videoBitrate: string } {
  const dims = {
    '480p': { l: [854, 480], p: [480, 854], br: '1200k' },
    '720p': { l: [1280, 720], p: [720, 1280], br: '2500k' },
    '1080p': { l: [1920, 1080], p: [1080, 1920], br: '4500k' },
  }[quality] || { l: [1280, 720], p: [720, 1280], br: '2500k' };

  const [width, height] = orientation === 'portrait' ? dims.p : dims.l;
  return { width, height, videoBitrate: dims.br };
}

function parseFfmpegStats(chunkStr: string, job: ServerStreamJob, platformLabel: string) {
  const lines = chunkStr.split(/[\r\n]+/).filter((l) => l.trim().length > 0);
  for (const line of lines) {
    const frameMatch = line.match(/frame=\s*(\d+)/);
    if (frameMatch) {
      job.framesSent = parseInt(frameMatch[1], 10);
      if (job.framesSent > 10 && job.errorMessage) {
        job.errorMessage = undefined;
      }
    }
    const bitrateMatch = line.match(/bitrate=\s*([\d.]+)kbits\/s/);
    if (bitrateMatch) {
      job.bitrateKbps = Math.round(parseFloat(bitrateMatch[1]));
    }
    if (
      line.includes('Error') ||
      line.includes('Failed') ||
      line.includes('Input/output error') ||
      line.includes('Connection refused') ||
      line.includes('Server returned') ||
      line.includes('Connection timed out')
    ) {
      job.errorMessage = `[${platformLabel}] ${line.trim().slice(0, 180)}`;
      job.lastLog = job.errorMessage;
    } else if (line.includes('frame=') || line.includes('Output #0')) {
      job.lastLog = `[${platformLabel}] ${line.trim().slice(0, 180)}`;
    }
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const safeId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${safeId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

async function startServer() {
  loadAdminStore();
  loadCatalog();
  await ensureSampleVideo().catch((err) => {
    console.warn('Sample video init warning:', err);
  });

  const app = express();
  const httpServer = createServer(app);

  app.use(express.json({ limit: '25mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  // ==================== ADMIN & SITE CONFIG API ====================
  app.get('/api/admin/data', (_req, res) => {
    // Sync liveCount per user from activeJobs
    const liveByUser = new Map<string, number>();
    for (const j of activeJobs.values()) {
      if (j.status === 'live') {
        liveByUser.set(j.userId, (liveByUser.get(j.userId) || 0) + 1);
      }
    }
    const usersWithLive = adminStore.users.map((u) => ({
      ...u,
      liveCount: liveByUser.get(u.identifier) || liveByUser.get(u.id) || 0,
    }));
    res.json({
      ...adminStore,
      users: usersWithLive,
    });
  });

  // Update Main Page Settings
  app.post('/api/admin/settings', (req, res) => {
    const body = req.body || {};
    adminStore.settings = {
      ...adminStore.settings,
      ...body,
      adminEmail: body.adminEmail ? String(body.adminEmail).trim() : adminStore.settings.adminEmail,
      adminPassword: body.adminPassword
        ? String(body.adminPassword)
        : adminStore.settings.adminPassword || 'admin123',
    };
    saveAdminStore();
    res.json({ settings: adminStore.settings });
  });

  // Admin Login Verification (Email + Password)
  app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body || {};
    const savedEmail = (adminStore.settings.adminEmail || 'typing.classes@gmail.com')
      .trim()
      .toLowerCase();
    const savedPassword = adminStore.settings.adminPassword || 'admin123';

    if (
      String(email || '')
        .trim()
        .toLowerCase() === savedEmail &&
      String(password || '') === savedPassword
    ) {
      res.json({
        authenticated: true,
        adminEmail: adminStore.settings.adminEmail || 'typing.classes@gmail.com',
      });
      return;
    }

    res.status(401).json({
      error: 'Invalid Admin Login Email or Password.',
    });
  });

  // Change Admin Login Email & Password inside Admin Panel
  app.post('/api/admin/credentials', (req, res) => {
    const { currentPassword, newEmail, newPassword } = req.body || {};
    const savedPassword = adminStore.settings.adminPassword || 'admin123';

    if (currentPassword !== undefined && String(currentPassword) !== savedPassword) {
      res.status(400).json({ error: 'Current password does not match.' });
      return;
    }

    if (!newEmail || !String(newEmail).trim()) {
      res.status(400).json({ error: 'Admin Login Email cannot be empty.' });
      return;
    }

    adminStore.settings.adminEmail = String(newEmail).trim();
    if (newPassword && String(newPassword).trim().length > 0) {
      adminStore.settings.adminPassword = String(newPassword).trim();
    }
    saveAdminStore();

    res.json({
      updated: true,
      adminEmail: adminStore.settings.adminEmail,
      settings: adminStore.settings,
    });
  });

  // Register or Login User (Google Email or Mobile Number)
  app.post('/api/users/register-login', (req, res) => {
    const { identifier, name } = req.body || {};
    if (!identifier) {
      res.status(400).json({ error: 'Email or Mobile number required' });
      return;
    }
    const cleanId = String(identifier).trim();
    let existing = adminStore.users.find(
      (u) => u.identifier.toLowerCase() === cleanId.toLowerCase()
    );
    if (!existing) {
      existing = {
        id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        identifier: cleanId,
        name: String(name || cleanId.split('@')[0] || 'Creator').trim(),
        isAdmin:
          cleanId.toLowerCase() === 'typing.classes@gmail.com' ||
          cleanId.toLowerCase() === 'rowaterwallah@gmail.com',
        plan: 'Free',
        allowLogoHide:
          cleanId.toLowerCase() === 'typing.classes@gmail.com' ||
          cleanId.toLowerCase() === 'rowaterwallah@gmail.com',
        liveCount: 0,
        active: true,
        createdAt: Date.now(),
      };
      adminStore.users.unshift(existing);
      saveAdminStore();
    }
    if (!existing.active) {
      res.status(403).json({
        error: 'Your account has been deactivated by the administrator. Please contact Support.',
      });
      return;
    }
    res.json({ user: existing });
  });

  // Update a User (Active/Deactive toggle, Subscription Plan change, Logo Hide/Unhide Permission)
  app.patch('/api/admin/users/:id', (req, res) => {
    const { id } = req.params;
    const idx = adminStore.users.findIndex((u) => u.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const updates = req.body || {};
    const current = adminStore.users[idx];

    let planExpiry = current.planExpiry;
    let allowLogoHide = current.allowLogoHide;
    if (updates.plan && updates.plan !== current.plan) {
      if (updates.plan === 'Free') {
        planExpiry = undefined;
        if (updates.allowLogoHide === undefined) {
          allowLogoHide = false;
        }
      } else {
        const d = new Date();
        d.setMonth(d.getMonth() + (updates.plan.toLowerCase().includes('year') ? 12 : 1));
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        planExpiry = `till ${dd}/${mm}/${yyyy}`;
        if (updates.allowLogoHide === undefined) {
          allowLogoHide = true;
        }
      }
    }

    adminStore.users[idx] = {
      ...current,
      ...updates,
      planExpiry: updates.planExpiry !== undefined ? updates.planExpiry : planExpiry,
      allowLogoHide:
        updates.allowLogoHide !== undefined ? Boolean(updates.allowLogoHide) : Boolean(allowLogoHide),
    };
    saveAdminStore();
    res.json({ user: adminStore.users[idx] });
  });

  // Delete a User
  app.delete('/api/admin/users/:id', (req, res) => {
    adminStore.users = adminStore.users.filter((u) => u.id !== req.params.id);
    saveAdminStore();
    res.json({ deleted: true });
  });

  // Update or Save Plans & Offers
  app.post('/api/admin/plans', (req, res) => {
    const { plans, offers } = req.body || {};
    if (Array.isArray(plans)) {
      adminStore.plans = plans;
    }
    if (Array.isArray(offers)) {
      adminStore.offers = offers;
    }
    saveAdminStore();
    res.json({ plans: adminStore.plans, offers: adminStore.offers });
  });

  // Submit or Update Payment
  app.post('/api/admin/payments', (req, res) => {
    const { userIdentifier, userName, planName, amountInr, utrNumber } = req.body || {};
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(
      now.getMonth() + 1
    ).padStart(2, '0')}/${now.getFullYear()}`;
    const record: PaymentRecord = {
      id: `pay_${Date.now()}`,
      userIdentifier: String(userIdentifier || ''),
      userName: String(userName || ''),
      planName: String(planName || 'Pro Monthly'),
      amountInr: Number(amountInr) || 499,
      utrNumber: String(utrNumber || ''),
      status: 'pending',
      createdAt: dateStr,
    };
    adminStore.payments.unshift(record);
    saveAdminStore();
    res.json({ payment: record });
  });

  app.patch('/api/admin/payments/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};
    const p = adminStore.payments.find((item) => item.id === id);
    if (!p) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    p.status = status;
    if (status === 'approved') {
      const u = adminStore.users.find(
        (usr) => usr.identifier.toLowerCase() === p.userIdentifier.toLowerCase()
      );
      if (u) {
        u.plan = p.planName;
        const d = new Date();
        d.setMonth(d.getMonth() + (p.planName.toLowerCase().includes('year') ? 12 : 1));
        u.planExpiry = `till ${String(d.getDate()).padStart(2, '0')}/${String(
          d.getMonth() + 1
        ).padStart(2, '0')}/${d.getFullYear()}`;
      }
    }
    saveAdminStore();
    res.json({ payment: p, users: adminStore.users });
  });

  // ==================== VIDEOS & CHUNKED UPLOAD API ====================
  app.get('/api/videos', (_req, res) => {
    const list = Array.from(uploadedVideos.values())
      .filter((v) => fs.existsSync(v.filePath))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((v) => ({
        id: v.id,
        originalName: v.originalName,
        fileName: v.fileName,
        url: `/uploads/${v.fileName}`,
        sizeBytes: v.sizeBytes,
        hasAudio: v.hasAudio,
        durationSec: v.durationSec,
        createdAt: v.createdAt,
      }));
    res.json({ videos: list });
  });

  app.post('/api/videos/upload-chunk', chunkUpload.single('chunk'), async (req, res) => {
    try {
      const { uploadId, chunkIndex, totalChunks, originalName } = req.body || {};
      if (!req.file || !uploadId) {
        res.status(400).json({ error: 'Missing video chunk or uploadId' });
        return;
      }

      const safeUploadId = String(uploadId).replace(/[^a-zA-Z0-9_\-]/g, '');
      const index = Number(chunkIndex);
      const total = Number(totalChunks);
      const ext = path.extname(originalName || '.mp4') || '.mp4';
      const tempFilePath = path.join(CHUNKS_DIR, `${safeUploadId}.part`);

      if (index === 0 && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      fs.appendFileSync(tempFilePath, req.file.buffer);

      if (index + 1 >= total) {
        const finalId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const finalFileName = `${finalId}${ext}`;
        const finalFilePath = path.join(UPLOADS_DIR, finalFileName);

        fs.renameSync(tempFilePath, finalFilePath);
        const stats = fs.statSync(finalFilePath);
        const probe = await probeVideoFile(finalFilePath);

        const item: UploadedVideoFile = {
          id: finalId,
          originalName: originalName || finalFileName,
          fileName: finalFileName,
          filePath: finalFilePath,
          sizeBytes: stats.size,
          hasAudio: probe.hasAudio,
          durationSec: probe.durationSec,
          createdAt: Date.now(),
        };

        uploadedVideos.set(finalId, item);
        saveCatalog();

        res.json({
          completed: true,
          video: {
            id: item.id,
            originalName: item.originalName,
            fileName: item.fileName,
            url: `/uploads/${item.fileName}`,
            sizeBytes: item.sizeBytes,
            hasAudio: item.hasAudio,
            durationSec: item.durationSec,
            createdAt: item.createdAt,
          },
        });
      } else {
        res.json({
          completed: false,
          chunkIndex: index,
        });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Chunk upload failed',
      });
    }
  });

  app.post('/api/videos/upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No video file uploaded' });
      return;
    }
    const id = path.basename(req.file.filename, path.extname(req.file.filename));
    const probe = await probeVideoFile(req.file.path);
    const item: UploadedVideoFile = {
      id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      sizeBytes: req.file.size,
      hasAudio: probe.hasAudio,
      durationSec: probe.durationSec,
      createdAt: Date.now(),
    };
    uploadedVideos.set(id, item);
    saveCatalog();
    res.json({
      video: {
        id: item.id,
        originalName: item.originalName,
        fileName: item.fileName,
        url: `/uploads/${item.fileName}`,
        sizeBytes: item.sizeBytes,
        hasAudio: item.hasAudio,
        durationSec: item.durationSec,
        createdAt: item.createdAt,
      },
    });
  });

  app.post('/api/videos/generate-studio', async (req, res) => {
    try {
      const {
        title = 'CreatorLive 24/7 Stream',
        orientation = 'portrait',
        durationSec = 10,
        bgHex = '1e1b4b',
      } = req.body || {};
      const safeDuration = Math.min(Math.max(Number(durationSec) || 8, 4), 30);
      const isPortrait = orientation === 'portrait';
      const sizeStr = isPortrait ? '720x1280' : '1280x720';
      const id = `studio_${Date.now()}`;
      const fileName = `${id}.mp4`;
      const filePath = path.join(UPLOADS_DIR, fileName);

      await new Promise<void>((resolve, reject) => {
        const ff = spawn('ffmpeg', [
          '-y',
          '-f', 'lavfi',
          '-i', `color=c=0x${bgHex.replace('#', '')}:s=${sizeStr}:r=30:d=${safeDuration}`,
          '-f', 'lavfi',
          '-i', `sine=frequency=528:sample_rate=44100:duration=${safeDuration}`,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p',
          '-b:v', '1200k',
          '-c:a', 'aac',
          '-b:a', '128k',
          filePath,
        ]);
        ff.on('close', (code) =>
          code === 0 ? resolve() : reject(new Error(`FFmpeg studio exit ${code}`))
        );
        ff.on('error', reject);
      });

      const stats = fs.statSync(filePath);
      const cleanName = `${String(title).trim().replace(/\s+/g, '_').slice(0, 40)}_24x7.mp4`;
      const item: UploadedVideoFile = {
        id,
        originalName: cleanName,
        fileName,
        filePath,
        sizeBytes: stats.size,
        hasAudio: true,
        durationSec: safeDuration,
        createdAt: Date.now(),
      };
      uploadedVideos.set(id, item);
      saveCatalog();

      res.json({
        video: {
          id: item.id,
          originalName: item.originalName,
          fileName: item.fileName,
          url: `/uploads/${item.fileName}`,
          sizeBytes: item.sizeBytes,
          hasAudio: true,
          durationSec: safeDuration,
          createdAt: item.createdAt,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Studio generation failed',
      });
    }
  });

  app.delete('/api/videos/:id', (req, res) => {
    const { id } = req.params;
    const item = uploadedVideos.get(id);
    if (!item) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }
    try {
      if (fs.existsSync(item.filePath)) {
        fs.unlinkSync(item.filePath);
      }
    } catch {
      // ignore
    }
    uploadedVideos.delete(id);
    saveCatalog();
    res.json({ deleted: true });
  });

  function resolveLogoFilePath(): string | null {
    try {
      const logoUrl = adminStore.settings.logoUrl || '';
      if (logoUrl.startsWith('data:image/')) {
        const mimeMatch = logoUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
        const ext = mimeMatch && mimeMatch[1].toLowerCase().includes('jp') ? 'jpg' : 'png';
        const base64Part = logoUrl.split(',')[1];
        if (base64Part) {
          const customLogoPath = path.join(UPLOADS_DIR, `custom_watermark_logo.${ext}`);
          fs.writeFileSync(customLogoPath, Buffer.from(base64Part, 'base64'));
          return customLogoPath;
        }
      }
      const relativeClean = logoUrl.replace(/^\/+/, '');
      const candidate = path.resolve(process.cwd(), 'public', relativeClean);
      if (relativeClean && fs.existsSync(candidate)) {
        return candidate;
      }
      const defaultLogo = path.resolve(
        process.cwd(),
        'public/assets/aistudio/CreatorLive24_7_Live_Provider_Logo__1__b778fd10.png'
      );
      if (fs.existsSync(defaultLogo)) {
        return defaultLogo;
      }
    } catch {
      // ignore
    }
    return null;
  }

  function resolveThumbnailFilePath(jobId: string, thumbnailDataUrl?: string | null): string | null {
    try {
      if (thumbnailDataUrl && thumbnailDataUrl.startsWith('data:image/')) {
        const mimeMatch = thumbnailDataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
        const ext = mimeMatch && mimeMatch[1].toLowerCase().includes('jp') ? 'jpg' : 'png';
        const base64Part = thumbnailDataUrl.split(',')[1];
        if (base64Part) {
          const thumbPath = path.join(UPLOADS_DIR, `thumb_${jobId}.${ext}`);
          fs.writeFileSync(thumbPath, Buffer.from(base64Part, 'base64'));
          return thumbPath;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  // ==================== 24/7 STREAMING ENGINE ====================
  app.post('/api/streams/start-loop', async (req, res) => {
    try {
      const {
        userId = 'guest',
        sessionId = `sess_${Date.now()}`,
        title = 'My Live Stream',
        videoId,
        orientation = 'landscape',
        quality = '720p',
        fps = 30,
        loop247 = true,
        destinations = [],
        thumbnailDataUrl = null,
        showThumbnailOverlay = false,
        showWatermarkLogo = true,
      } = req.body || {};

      // Check if user is deactivated in adminStore
      const matchedUser = adminStore.users.find(
        (u) => u.identifier.toLowerCase() === String(userId).toLowerCase() || u.id === userId
      );
      if (matchedUser && !matchedUser.active) {
        res.status(403).json({
          error: 'Your account has been deactivated by the admin. Cannot start live stream.',
        });
        return;
      }

      // Website Logo Hide/Unhide permission is controlled from Admin Panel -> User List (allowLogoHide)
      const canHideLogo = Boolean(
        matchedUser
          ? typeof matchedUser.allowLogoHide === 'boolean'
            ? matchedUser.allowLogoHide
            : matchedUser.plan && matchedUser.plan !== 'Free'
          : false
      );
      const effectiveShowLogo = canHideLogo
        ? Boolean(showWatermarkLogo)
        : Boolean(adminStore.settings.showLogoOnFreeStream);

      const video =
        uploadedVideos.get(videoId) ||
        Array.from(uploadedVideos.values()).find((v) => fs.existsSync(v.filePath));

      if (!video || !fs.existsSync(video.filePath)) {
        res.status(400).json({
          error:
            'Uploaded video file not found on server. Please select or upload a video in Step 2 first.',
        });
        return;
      }

      if (!Array.isArray(destinations) || destinations.length === 0) {
        res.status(400).json({
          error:
            'At least one Stream Key destination (YouTube, Facebook, or Custom RTMP) is required.',
        });
        return;
      }

      for (const [oldId, oldJob] of activeJobs.entries()) {
        if (oldJob.userId === userId) {
          oldJob.status = 'stopped';
          for (const proc of oldJob.processes) {
            try {
              proc.kill('SIGTERM');
            } catch {
              // ignore
            }
          }
          activeJobs.delete(oldId);
        }
      }

      // Always probe audio track before streaming so YouTube Live always receives a valid audio stream
      const probe = await probeVideoFile(video.filePath);
      video.hasAudio = probe.hasAudio;
      video.durationSec = probe.durationSec;

      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const { width, height, videoBitrate } = getResolutionArgs(quality, orientation);
      const targetFps = Number(fps) === 60 ? 60 : 30;

      const logoFilePath = effectiveShowLogo ? resolveLogoFilePath() : null;
      const thumbFilePath = resolveThumbnailFilePath(jobId, thumbnailDataUrl);

      const job: ServerStreamJob = {
        jobId,
        userId,
        sessionId,
        title,
        sourceType: 'video',
        videoId: video.id,
        videoFileName: video.originalName,
        orientation,
        quality,
        fps: targetFps,
        loop247: Boolean(loop247),
        destinations,
        status: 'live',
        startedAt: Date.now(),
        processes: [],
        lastLog: 'Starting 24/7 FFmpeg RTMP/RTMPS encoder...',
        framesSent: 0,
        bitrateKbps: parseInt(videoBitrate, 10),
      };

      const spawnDestinationProcess = (dest: RtmpDestination, retryCount = 0) => {
        if (job.status !== 'live') return;

        const isDemoPlaceholder =
          dest.streamKey === 'yt-live-24x7-key' ||
          dest.streamKey === 'FB-3948102948eQ-7' ||
          dest.streamKey.startsWith('demo_');

        const fullRtmp = buildFullRtmpUrl(dest.rtmpUrl, dest.streamKey, dest.platform);

        const args: string[] = [
          '-nostdin',
          '-y',
          '-hide_banner',
          '-loglevel',
          'info',
          '-fflags',
          '+genpts+igndts+discardcorrupt',
          '-thread_queue_size',
          '4096',
        ];
        if (loop247) {
          args.push('-stream_loop', '-1');
        }
        args.push('-re', '-i', video.filePath);

        let nextInputIdx = 1;
        let audioInputIdx = 0;
        if (!video.hasAudio) {
          args.push(
            '-thread_queue_size',
            '4096',
            '-f',
            'lavfi',
            '-i',
            'anullsrc=channel_layout=stereo:sample_rate=44100'
          );
          audioInputIdx = nextInputIdx++;
        }

        let thumbInputIdx = -1;
        if (thumbFilePath && fs.existsSync(thumbFilePath)) {
          args.push('-i', thumbFilePath);
          thumbInputIdx = nextInputIdx++;
        }

        let logoInputIdx = -1;
        if (logoFilePath && fs.existsSync(logoFilePath)) {
          args.push('-i', logoFilePath);
          logoInputIdx = nextInputIdx++;
        }

        // Build high-speed, zero-buffering filter_complex:
        // - Monotonic PTS (setpts=N/(FPS*TB) & asetpts=N/SR/TB) for seamless infinite 24/7 loops without timestamp jumps
        // - Native yuv420p overlays (3.3x faster encoding, zero frame drops)
        // - Thumbnail displays for the first 4 seconds (between(t,0,4)) on initial start like YouTube/Facebook, then plays video
        const filterChains: string[] = [];
        filterChains.push(
          `[0:v]fps=${targetFps},setpts=N/(${targetFps}*TB),scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=fast_bilinear,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[vbase]`
        );
        let currentVidLabel = '[vbase]';

        if (thumbInputIdx >= 0 && retryCount === 0) {
          const enableExpr = showThumbnailOverlay ? 'gte(t,0)' : 'between(t,0,4)';
          filterChains.push(
            `[${thumbInputIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=fast_bilinear,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[vthumbimg]`
          );
          filterChains.push(
            `${currentVidLabel}[vthumbimg]overlay=0:0:eof_action=repeat:format=yuv420:enable='${enableExpr}'[vwith_thumb]`
          );
          currentVidLabel = '[vwith_thumb]';
        }

        if (logoInputIdx >= 0) {
          filterChains.push(
            `[${logoInputIdx}:v]scale=160:-2,pad=iw+12:ih+8:6:4:color=white@0.95,format=yuv420p[vlogo]`
          );
          filterChains.push(
            `${currentVidLabel}[vlogo]overlay=20:20:eof_action=repeat:format=yuv420[vout]`
          );
          currentVidLabel = '[vout]';
        }

        const rawAudioSource = !video.hasAudio ? `${audioInputIdx}:a:0` : '0:a:0';
        filterChains.push(`[${rawAudioSource}]aresample=44100,asetpts=N/SR/TB[aout]`);

        const gopSize = String(targetFps * 2);
        const bufSizeK = `${parseInt(videoBitrate, 10) * 2}k`;

        args.push(
          '-filter_complex',
          filterChains.join(';'),
          '-map',
          currentVidLabel,
          '-map',
          '[aout]',
          '-r',
          String(targetFps),
          '-c:v',
          'libx264',
          '-profile:v',
          'main',
          '-preset',
          'ultrafast',
          '-tune',
          'zerolatency',
          '-threads',
          '0',
          '-b:v',
          videoBitrate,
          '-minrate',
          videoBitrate,
          '-maxrate',
          videoBitrate,
          '-bufsize',
          bufSizeK,
          '-x264-params',
          'nal-hrd=cbr:force-cfr=1',
          '-pix_fmt',
          'yuv420p',
          '-g',
          gopSize,
          '-keyint_min',
          gopSize,
          '-sc_threshold',
          '0',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-ar',
          '44100',
          '-ac',
          '2',
          '-max_muxing_queue_size',
          '4096'
        );

        if (!loop247 && !video.hasAudio) {
          args.push('-shortest');
        }

        if (isDemoPlaceholder) {
          args.push('-f', 'flv', '/dev/null');
          job.lastLog = `[Preview Mode] Streaming "${video.originalName}" in smooth 24/7 loop (${effectiveShowLogo ? 'Logo ON' : 'Logo Hidden'}${thumbInputIdx >= 0 ? ' + 4s Thumbnail Intro' : ''}). Paste your real YouTube/Facebook Stream Key in Step 1 to go live publicly.`;
        } else {
          args.push(
            '-flvflags',
            'no_duration_filesize',
            '-rtmp_live',
            'live',
            '-f',
            'flv',
            fullRtmp
          );
        }

        const proc = spawn('ffmpeg', args);
        const label = dest.channelName || dest.platform.toUpperCase();

        proc.stderr.on('data', (chunk: Buffer) => {
          parseFfmpegStats(chunk.toString(), job, label);
        });

        proc.on('error', (err) => {
          job.errorMessage = `FFmpeg error (${label}): ${err.message}`;
          job.lastLog = job.errorMessage;
        });

        proc.on('close', (code) => {
          if (job.status === 'live' && code !== 0) {
            if (loop247 && retryCount < 10 && job.framesSent > 30) {
              job.lastLog = `[${label}] Reconnecting 24/7 stream seamlessly (attempt ${retryCount + 1})...`;
              setTimeout(() => {
                spawnDestinationProcess(dest, retryCount + 1);
              }, 1500);
            } else {
              job.errorMessage = `RTMP Server (${label}) closed connection (code ${code}). Verify your ${label} Stream Key is active and Live Studio is ready.`;
              job.lastLog = job.errorMessage;
            }
          }
        });

        job.processes.push(proc);
      };

      for (const dest of destinations as RtmpDestination[]) {
        spawnDestinationProcess(dest);
      }

      activeJobs.set(jobId, job);

      res.json({
        job: {
          jobId: job.jobId,
          userId: job.userId,
          sessionId: job.sessionId,
          title: job.title,
          sourceType: job.sourceType,
          videoFileName: job.videoFileName,
          orientation: job.orientation,
          quality: job.quality,
          fps: job.fps,
          loop247: job.loop247,
          status: job.status,
          errorMessage: job.errorMessage,
          startedAt: job.startedAt,
          destinations: job.destinations.map((d) => ({
            id: d.id,
            platform: d.platform,
            channelName: d.channelName,
          })),
          lastLog: job.lastLog,
          framesSent: job.framesSent,
          bitrateKbps: job.bitrateKbps,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to start stream',
      });
    }
  });

  app.get('/api/streams/active', (req, res) => {
    const userId = req.query.userId as string | undefined;
    const jobs = Array.from(activeJobs.values())
      .filter((j) => j.status === 'live' && (!userId || j.userId === userId || j.userId === 'guest'))
      .map((j) => ({
        jobId: j.jobId,
        userId: j.userId,
        sessionId: j.sessionId,
        title: j.title,
        sourceType: j.sourceType,
        videoFileName: j.videoFileName,
        orientation: j.orientation,
        quality: j.quality,
        fps: j.fps,
        loop247: j.loop247,
        status: j.status,
        errorMessage: j.errorMessage,
        startedAt: j.startedAt,
        uptimeSeconds: Math.floor((Date.now() - j.startedAt) / 1000),
        destinations: j.destinations.map((d) => ({
          id: d.id,
          platform: d.platform,
          channelName: d.channelName,
        })),
        lastLog: j.lastLog,
        framesSent: j.framesSent,
        bitrateKbps: j.bitrateKbps,
      }));
    res.json({ jobs });
  });

  app.post('/api/streams/stop', (req, res) => {
    const { jobId, sessionId } = req.body || {};
    let stoppedCount = 0;

    for (const [id, job] of activeJobs.entries()) {
      if (!jobId || id === jobId || (sessionId && job.sessionId === sessionId)) {
        job.status = 'stopped';
        for (const proc of job.processes) {
          try {
            proc.kill('SIGTERM');
          } catch {
            // ignore
          }
        }
        activeJobs.delete(id);
        stoppedCount++;
      }
    }

    res.json({ stopped: true, stoppedCount });
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    if (url.pathname === '/ws/stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let currentJob: ServerStreamJob | null = null;

    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'start') {
            const destinations: RtmpDestination[] = msg.destinations || [];
            const quality = msg.quality || '720p';
            const orientation = msg.orientation || 'landscape';
            const fps = Number(msg.fps) === 60 ? 60 : 30;
            const { width, height, videoBitrate } = getResolutionArgs(quality, orientation);

            const jobId = `wsjob_${Date.now()}`;
            const matchedUser = adminStore.users.find(
              (u) =>
                u.identifier.toLowerCase() === String(msg.userId || '').toLowerCase() ||
                u.id === msg.userId
            );
            const canHideLogo = Boolean(
              matchedUser
                ? typeof matchedUser.allowLogoHide === 'boolean'
                  ? matchedUser.allowLogoHide
                  : matchedUser.plan && matchedUser.plan !== 'Free'
                : false
            );
            const effectiveShowLogo = canHideLogo
              ? Boolean(msg.showWatermarkLogo)
              : Boolean(adminStore.settings.showLogoOnFreeStream);

            const logoFilePath = effectiveShowLogo ? resolveLogoFilePath() : null;
            const thumbFilePath = resolveThumbnailFilePath(jobId, msg.thumbnailDataUrl);

            currentJob = {
              jobId,
              userId: msg.userId || 'guest',
              sessionId: msg.sessionId || `sess_${Date.now()}`,
              title: msg.title || 'Live Browser Broadcast',
              sourceType: msg.sourceType || 'camera',
              orientation,
              quality,
              fps,
              loop247: false,
              destinations,
              status: 'live',
              startedAt: Date.now(),
              processes: [],
              lastLog: 'Receiving live Camera/Screen browser stream...',
              framesSent: 0,
              bitrateKbps: parseInt(videoBitrate, 10),
            };

            for (const dest of destinations) {
              const isDemoPlaceholder =
                dest.streamKey === 'yt-live-24x7-key' ||
                dest.streamKey === 'FB-3948102948eQ-7' ||
                dest.streamKey.startsWith('demo_');

              const fullRtmp = buildFullRtmpUrl(dest.rtmpUrl, dest.streamKey, dest.platform);
              const label = dest.channelName || dest.platform.toUpperCase();

              const args: string[] = [
                '-y',
                '-hide_banner',
                '-loglevel',
                'info',
                '-fflags',
                '+genpts+igndts+discardcorrupt',
                '-thread_queue_size',
                '4096',
                '-i',
                'pipe:0',
                '-thread_queue_size',
                '4096',
                '-f',
                'lavfi',
                '-i',
                'anullsrc=channel_layout=stereo:sample_rate=44100',
              ];

              let nextInputIdx = 2;
              let thumbInputIdx = -1;
              if (thumbFilePath && fs.existsSync(thumbFilePath)) {
                args.push('-i', thumbFilePath);
                thumbInputIdx = nextInputIdx++;
              }

              let logoInputIdx = -1;
              if (logoFilePath && fs.existsSync(logoFilePath)) {
                args.push('-i', logoFilePath);
                logoInputIdx = nextInputIdx++;
              }

              const filterChains: string[] = [];
              filterChains.push(
                `[0:v]fps=${fps},setpts=N/(${fps}*TB),scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=fast_bilinear,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[vbase]`
              );
              let currentVidLabel = '[vbase]';

              if (thumbInputIdx >= 0) {
                const enableExpr = msg.showThumbnailOverlay ? 'gte(t,0)' : 'between(t,0,4)';
                filterChains.push(
                  `[${thumbInputIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=fast_bilinear,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[vthumbimg]`
                );
                filterChains.push(
                  `${currentVidLabel}[vthumbimg]overlay=0:0:eof_action=repeat:format=yuv420:enable='${enableExpr}'[vwith_thumb]`
                );
                currentVidLabel = '[vwith_thumb]';
              }

              if (logoInputIdx >= 0) {
                filterChains.push(
                  `[${logoInputIdx}:v]scale=160:-2,pad=iw+12:ih+8:6:4:color=white@0.95,format=yuv420p[vlogo]`
                );
                filterChains.push(
                  `${currentVidLabel}[vlogo]overlay=20:20:eof_action=repeat:format=yuv420[vout]`
                );
                currentVidLabel = '[vout]';
              }

              const gopSize = String(fps * 2);
              const bufSizeK = `${parseInt(videoBitrate, 10) * 2}k`;

              args.push(
                '-filter_complex',
                filterChains.join(';'),
                '-map',
                currentVidLabel,
                '-map',
                '1:a:0',
                '-r',
                String(fps),
                '-c:v',
                'libx264',
                '-profile:v',
                'main',
                '-preset',
                'ultrafast',
                '-tune',
                'zerolatency',
                '-threads',
                '0',
                '-b:v',
                videoBitrate,
                '-minrate',
                videoBitrate,
                '-maxrate',
                videoBitrate,
                '-bufsize',
                bufSizeK,
                '-x264-params',
                'nal-hrd=cbr:force-cfr=1',
                '-pix_fmt',
                'yuv420p',
                '-g',
                gopSize,
                '-keyint_min',
                gopSize,
                '-sc_threshold',
                '0',
                '-c:a',
                'aac',
                '-b:a',
                '128k',
                '-ar',
                '44100',
                '-ac',
                '2',
                '-max_muxing_queue_size',
                '4096'
              );

              if (isDemoPlaceholder) {
                args.push('-f', 'flv', '/dev/null');
              } else {
                args.push(
                  '-flvflags',
                  'no_duration_filesize',
                  '-rtmp_live',
                  'live',
                  '-f',
                  'flv',
                  fullRtmp
                );
              }

              const proc = spawn('ffmpeg', args);

              proc.stderr.on('data', (chunk: Buffer) => {
                if (currentJob) {
                  parseFfmpegStats(chunk.toString(), currentJob, label);
                }
              });

              proc.on('error', (err) => {
                if (currentJob) {
                  currentJob.errorMessage = `RTMP error (${label}): ${err.message}`;
                  currentJob.lastLog = currentJob.errorMessage;
                }
              });

              proc.stdin.on('error', () => {});

              currentJob.processes.push(proc);
            }

            activeJobs.set(jobId, currentJob);
            ws.send(JSON.stringify({ type: 'started', jobId }));
          } else if (msg.type === 'stop') {
            if (currentJob) {
              currentJob.status = 'stopped';
              for (const proc of currentJob.processes) {
                try {
                  proc.stdin.end();
                  proc.kill('SIGTERM');
                } catch {
                  // ignore
                }
              }
              activeJobs.delete(currentJob.jobId);
              currentJob = null;
            }
          }
        } catch {
          // ignore
        }
      } else if (currentJob && currentJob.status === 'live') {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        currentJob.framesSent += 1;
        for (const proc of currentJob.processes) {
          if (proc.stdin && !proc.stdin.destroyed && proc.stdin.writable) {
            try {
              proc.stdin.write(buffer);
            } catch {
              // ignore
            }
          }
        }
      }
    });

    ws.on('close', () => {
      if (currentJob) {
        currentJob.status = 'stopped';
        for (const proc of currentJob.processes) {
          try {
            proc.stdin.end();
            proc.kill('SIGTERM');
          } catch {
            // ignore
          }
        }
        activeJobs.delete(currentJob.jobId);
        currentJob = null;
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CreatorLive24/7 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
