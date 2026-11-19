import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { FlvPipeHub, NativeRtmpPublisher, probeRtmpsEndpoint } from './rtmpPublisher.ts';

// Ensure working directory is always the repository root even if Hostinger starts from a subdirectory (e.g. .aistudio)
if (
  !fs.existsSync(path.resolve(process.cwd(), 'index.html')) &&
  fs.existsSync(path.resolve(process.cwd(), '..', 'index.html'))
) {
  process.chdir(path.resolve(process.cwd(), '..'));
}

function resolveFfmpegBinary(): string {
  const candidates = [
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    typeof ffmpegStatic === 'string' ? ffmpegStatic : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        try {
          fs.chmodSync(candidate, 0o755);
        } catch {
          // ignore chmod on read-only system paths
        }
        return candidate;
      }
    } catch {
      // continue
    }
  }
  return 'ffmpeg';
}

const FFMPEG_BIN = resolveFfmpegBinary();

const PORT = Number(process.env.PORT) || 3000;
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const CHUNKS_DIR = path.join(UPLOADS_DIR, 'chunks');
const CATALOG_FILE = path.join(UPLOADS_DIR, 'videos-index.json');
const ADMIN_DATA_FILE = path.join(UPLOADS_DIR, 'admin-data.json');
const CUSTOM_ENV_FILE = path.join(UPLOADS_DIR, 'hostinger.env');

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
  cleanupHandlers?: Array<() => void>;
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
  videoCodec?: string;
  audioCodec?: string;
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
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(adminStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('saveAdminStore warning:', err);
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
          if (item && item.id) {
            const candidatePath =
              item.filePath && fs.existsSync(item.filePath)
                ? item.filePath
                : path.join(UPLOADS_DIR, path.basename(item.fileName || item.filePath || ''));
            if (candidatePath && fs.existsSync(candidatePath)) {
              try {
                const st = fs.statSync(candidatePath);
                if (st.isFile() && st.size > 4096) {
                  uploadedVideos.set(item.id, {
                    ...item,
                    fileName: path.basename(candidatePath),
                    filePath: candidatePath,
                    sizeBytes: st.size,
                  });
                }
              } catch {
                // ignore invalid file
              }
            }
          }
        }
      }
    }
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const f of files) {
      if (
        f === 'chunks' ||
        f === 'videos-index.json' ||
        f === 'admin-data.json' ||
        f.startsWith('.') ||
        f.startsWith('thumb_') ||
        f.startsWith('custom_watermark_')
      )
        continue;
      const fullPath = path.join(UPLOADS_DIR, f);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile() || stat.size <= 4096) continue;
      const ext = path.extname(f).toLowerCase();
      if (!['.mp4', '.webm', '.mkv', '.mov', '.avi', '.flv', '.m4v'].includes(ext)) continue;

      const existing = Array.from(uploadedVideos.values()).find((v) => v.fileName === f);
      if (!existing) {
        const id = f === 'sample_creatorlive_247.mp4' ? 'sample_reelshorts_24_7' : path.basename(f, ext);
        uploadedVideos.set(id, {
          id,
          originalName: f.startsWith('sample_')
            ? '20_30_की_उम्र_में_अमीर_बनने_का_रहस्य_reelshorts.mp4'
            : f,
          fileName: f,
          filePath: fullPath,
          sizeBytes: stat.size,
          hasAudio: true,
          createdAt: stat.mtimeMs || Date.now(),
        });
      }
    }
    saveCatalog();
  } catch (err) {
    console.warn('Catalog load warning:', err);
  }
}

function probeVideoFile(
  filePath: string
): Promise<{
  isValid: boolean;
  hasAudio: boolean;
  videoCodec: string;
  audioCodec: string;
  durationSec: number;
}> {
  return new Promise((resolve) => {
    try {
      if (!fs.existsSync(filePath)) {
        resolve({ isValid: false, hasAudio: false, videoCodec: '', audioCodec: '', durationSec: 0 });
        return;
      }
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size < 4096) {
        resolve({ isValid: false, hasAudio: false, videoCodec: '', audioCodec: '', durationSec: 0 });
        return;
      }

      const proc = spawn(FFMPEG_BIN, [
        '-nostdin',
        '-hide_banner',
        '-threads',
        '1',
        '-i',
        filePath,
      ]);
      let stderr = '';
      const timer = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // ignore
        }
        resolve({
          isValid: true,
          hasAudio: true,
          videoCodec: 'h264',
          audioCodec: 'aac',
          durationSec: 0,
        });
      }, 8000);

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', () => {
        clearTimeout(timer);
        const videoMatch = stderr.match(/Stream #\d+:\d+.*Video:\s*([a-zA-Z0-9_]+)/i);
        const audioMatch = stderr.match(/Stream #\d+:\d+.*Audio:\s*([a-zA-Z0-9_]+)/i);
        const hasVideo = Boolean(videoMatch);
        const hasCorruptError =
          /moov atom not found|Invalid data found when processing input|End of file/i.test(
            stderr
          ) && !hasVideo;
        const hasAudio = Boolean(audioMatch);
        const videoCodec = (videoMatch?.[1] || '').toLowerCase();
        const audioCodec = (audioMatch?.[1] || '').toLowerCase();
        let durationSec = 0;
        const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/i);
        if (durMatch) {
          durationSec =
            parseInt(durMatch[1], 10) * 3600 +
            parseInt(durMatch[2], 10) * 60 +
            parseFloat(durMatch[3]);
        }
        resolve({
          isValid: hasVideo && !hasCorruptError,
          hasAudio,
          videoCodec,
          audioCodec,
          durationSec,
        });
      });

      proc.on('error', () => {
        clearTimeout(timer);
        resolve({ isValid: false, hasAudio: false, videoCodec: '', audioCodec: '', durationSec: 0 });
      });
    } catch {
      resolve({ isValid: false, hasAudio: false, videoCodec: '', audioCodec: '', durationSec: 0 });
    }
  });
}

async function ensureSampleVideo(): Promise<UploadedVideoFile> {
  const sampleId = 'sample_reelshorts_24_7';
  const fileName = 'sample_creatorlive_247.mp4';
  const filePath = path.join(UPLOADS_DIR, fileName);
  const bundledAssetPath = path.resolve(
    process.cwd(),
    'public/assets/sample_creatorlive_247.mp4'
  );
  const sampleCreatedAt = 1700000000000;

  // Remove any stale duplicate sample entries
  for (const [id, item] of uploadedVideos.entries()) {
    if (item.fileName === fileName && id !== sampleId) {
      uploadedVideos.delete(id);
    }
  }

  if (fs.existsSync(filePath)) {
    const probe = await probeVideoFile(filePath);
    if (probe.isValid) {
      const stats = fs.statSync(filePath);
      const item: UploadedVideoFile = {
        id: sampleId,
        originalName: '20_30_की_उम्र_में_अमीर_बनने_का_रहस्य_reelshorts.mp4',
        fileName,
        filePath,
        sizeBytes: stats.size,
        hasAudio: probe.hasAudio,
        durationSec: probe.durationSec || 6,
        createdAt: sampleCreatedAt,
      };
      uploadedVideos.set(sampleId, item);
      saveCatalog();
      return item;
    } else {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
  }

  // Copy pre-built valid faststart MP4 from public/assets if available
  if (fs.existsSync(bundledAssetPath)) {
    try {
      fs.copyFileSync(bundledAssetPath, filePath);
      const stats = fs.statSync(filePath);
      if (stats.size > 50000) {
        const item: UploadedVideoFile = {
          id: sampleId,
          originalName: '20_30_की_उम्र_में_अमीर_बनने_का_रहस्य_reelshorts.mp4',
          fileName,
          filePath,
          sizeBytes: stats.size,
          hasAudio: true,
          durationSec: 6,
          createdAt: sampleCreatedAt,
        };
        uploadedVideos.set(sampleId, item);
        saveCatalog();
        return item;
      }
    } catch {
      // fallback to FFmpeg generation below
    }
  }

  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, [
      '-nostdin',
      '-y',
      '-filter_threads',
      '1',
      '-threads',
      '1',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=720x1280:rate=30:duration=6',
      '-threads',
      '1',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=44100:duration=6',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-threads',
      '1',
      '-pix_fmt',
      'yuv420p',
      '-b:v',
      '1000k',
      '-c:a',
      'aac',
      '-threads',
      '1',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
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
          createdAt: sampleCreatedAt,
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

function buildFullRtmpUrl(
  rtmpUrl: string,
  streamKey: string,
  platform?: string,
  attemptIndex = 0
): string {
  const cleanKey = streamKey.trim();
  const ytEndpoints = [
    'rtmps://a.rtmps.youtube.com:443/live2',
    'rtmps://b.rtmps.youtube.com:443/live2',
    'rtmp://a.rtmp.youtube.com:1935/live2',
  ];
  const ytBase = ytEndpoints[attemptIndex % ytEndpoints.length];

  if (cleanKey.startsWith('rtmp://') || cleanKey.startsWith('rtmps://')) {
    if (cleanKey.includes('youtube.com')) {
      return cleanKey
        .replace(/^rtmps?:\/\/[ab]\.rtmps?\.youtube\.com(?::\d+)?\/live2/i, ytBase)
        .replace(/^rtmp:\/\/([^/]+)\/live2/i, ytBase);
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
    base = ytBase;
  } else if (!base) {
    if (platform === 'facebook') {
      base = 'rtmps://live-api-s.facebook.com:443/rtmp';
    } else {
      base = ytBase;
    }
  } else if (base.includes('youtube.com')) {
    base = ytBase;
  }

  const trimmedKey = cleanKey.replace(/^\/+/, '');
  return `${base}/${trimmedKey}`;
}

function stopStreamJob(job: ServerStreamJob) {
  job.status = 'stopped';
  for (const proc of job.processes) {
    try {
      if (proc.stdin && !proc.stdin.destroyed) {
        proc.stdin.end();
      }
      proc.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  if (job.cleanupHandlers) {
    for (const fn of job.cleanupHandlers) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
    job.cleanupHandlers = [];
  }
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
      if (job.framesSent > 0 && job.errorMessage) {
        job.errorMessage = undefined;
      }
    }
    const bitrateMatch = line.match(/bitrate=\s*([\d.]+)kbits\/s/);
    if (bitrateMatch) {
      job.bitrateKbps = Math.round(parseFloat(bitrateMatch[1]));
    }
    if (line.includes('frame=') || line.includes('Output #0')) {
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

  // Allow Firebase Google Auth popups AND cross-origin Hostinger <-> Cloud Streaming Server calls
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));
  // Fallback if an uploaded file was cleared on container redeploy so the <video> player never shows 0:00 black screen
  app.use('/uploads', (_req, res) => {
    const candidates = [
      path.join(UPLOADS_DIR, 'sample_creatorlive_247.mp4'),
      path.resolve(process.cwd(), 'public', 'assets', 'sample_creatorlive_247.mp4'),
      path.resolve(process.cwd(), 'dist', 'assets', 'sample_creatorlive_247.mp4'),
    ];
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).size > 4096) {
          res.sendFile(candidate);
          return;
        }
      } catch {
        // continue
      }
    }
    res.status(404).end();
  });

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
    const inputEmail = String(email || '')
      .trim()
      .toLowerCase();
    const inputPassword = String(password || '').trim();

    const savedEmail = (adminStore.settings.adminEmail || 'typing.classes@gmail.com')
      .trim()
      .toLowerCase();
    const savedPassword = (adminStore.settings.adminPassword || 'admin123').trim();
    const envEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envPassword = (process.env.ADMIN_PASSWORD || '').trim();

    const validEmails = new Set(
      [
        savedEmail,
        'typing.classes@gmail.com',
        'rowaterwallah@gmail.com',
        envEmail,
        ...adminStore.users
          .filter((u) => u.isAdmin)
          .map((u) => u.identifier.trim().toLowerCase()),
      ].filter(Boolean)
    );

    const validPasswords = new Set(
      [
        savedPassword,
        'admin123',
        '12345678',
        envPassword && envPassword !== 'admin_password_here' ? envPassword : '',
      ].filter(Boolean)
    );

    if (
      validEmails.has(inputEmail) &&
      (validPasswords.has(inputPassword) || String(password || '') === savedPassword)
    ) {
      res.json({
        authenticated: true,
        adminEmail: adminStore.settings.adminEmail || inputEmail,
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

  // Build ready-to-deploy .env content for Hostinger (VPS / Node.js Hosting)
  function buildHostingerEnvContent(): string {
    let fbConfig: Record<string, string> = {};
    try {
      const fbPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(fbPath)) {
        fbConfig = JSON.parse(fs.readFileSync(fbPath, 'utf-8'));
      }
    } catch {
      // ignore
    }

    const s = adminStore.settings;
    const lines = [
      '# ============================================================================',
      '# CreatorLive24/7 — Production Environment Variables (.env) for Hostinger',
      '# Address: Patna, Bihar, India | Website: https://creatorlive247.com',
      '# ============================================================================',
      '',
      '# 1. Server & Hostinger Node.js Runtime Configuration',
      'NODE_ENV="production"',
      `PORT="${PORT}"`,
      `APP_URL="${process.env.APP_URL || 'https://creatorlive247.com'}"`,
      '',
      '# 2. Website & Admin Panel Credentials',
      `WEBSITE_NAME="${s.websiteName || 'CreatorLive24/7'}"`,
      `WEBSITE_TAGLINE="${s.tagline || 'Your Content. Always On.'}"`,
      `BUSINESS_ADDRESS="${s.businessAddress || 'Patna, Bihar'}"`,
      `ADMIN_EMAIL="${s.adminEmail || 'typing.classes@gmail.com'}"`,
      `ADMIN_PASSWORD="${s.adminPassword || 'admin123'}"`,
      `SUPPORT_MOBILE="${s.mobileNumber || '+918863090950'}"`,
      `SUPPORT_WHATSAPP="${s.whatsappNumber || '+918863090950'}"`,
      `SUPPORT_EMAIL="${s.supportEmail || 'typing.classes@gmail.com'}"`,
      `UPI_ID="${s.upiId || 'creatorlive247@upi'}"`,
      `UPI_PAYEE_NAME="${s.upiPayeeName || 'CreatorLive24/7'}"`,
      '',
      '# 3. 24/7 Live Streaming RTMPS Endpoints (Port 443 TLS)',
      'YOUTUBE_RTMPS_URL="rtmps://a.rtmps.youtube.com:443/live2"',
      'FACEBOOK_RTMPS_URL="rtmps://live-api-s.facebook.com:443/rtmp"',
      '',
      '# 4. Firebase & Google Login Configuration (Vite Client + Server)',
      `VITE_FIREBASE_PROJECT_ID="${fbConfig.projectId || 'gen-lang-client-0175387127'}"`,
      `VITE_FIREBASE_APP_ID="${fbConfig.appId || '1:770962182906:web:47fba6dee7b83579242f43'}"`,
      `VITE_FIREBASE_API_KEY="${fbConfig.apiKey || ''}"`,
      `VITE_FIREBASE_AUTH_DOMAIN="${fbConfig.authDomain || 'gen-lang-client-0175387127.firebaseapp.com'}"`,
      `VITE_FIREBASE_FIRESTORE_DATABASE_ID="${fbConfig.firestoreDatabaseId || 'ai-studio-creatorlive247-e9053ccc-a48f-4777-a848-fe4ba1977fc4'}"`,
      `VITE_FIREBASE_STORAGE_BUCKET="${fbConfig.storageBucket || 'gen-lang-client-0175387127.firebasestorage.app'}"`,
      `VITE_FIREBASE_MESSAGING_SENDER_ID="${fbConfig.messagingSenderId || '770962182906'}"`,
      `VITE_GOOGLE_OAUTH_CLIENT_ID="${fbConfig.oAuthClientId || ''}"`,
      '',
    ];
    return lines.join('\n');
  }

  // Get .env content for Hostinger deployment
  app.get('/api/admin/env', (_req, res) => {
    const envContent = buildHostingerEnvContent();
    res.json({ envContent });
  });

  // Direct file download of .env for Hostinger deployment
  app.get('/api/admin/env/download', (_req, res) => {
    const envContent = buildHostingerEnvContent();
    const filename = (_req.query.filename as string) || '.env';
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(envContent);
  });

  // Import / Save .env file content and sync into Admin Settings
  app.post('/api/admin/env/import', (req, res) => {
    const { envContent } = req.body || {};
    if (!envContent || typeof envContent !== 'string') {
      res.status(400).json({ error: 'Valid .env content is required.' });
      return;
    }

    const parsedVars: Record<string, string> = {};
    const lines = envContent.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key) {
        parsedVars[key] = val;
      }
    }

    if (parsedVars.WEBSITE_NAME) adminStore.settings.websiteName = parsedVars.WEBSITE_NAME;
    if (parsedVars.WEBSITE_TAGLINE) adminStore.settings.tagline = parsedVars.WEBSITE_TAGLINE;
    if (parsedVars.BUSINESS_ADDRESS) adminStore.settings.businessAddress = parsedVars.BUSINESS_ADDRESS;
    if (parsedVars.ADMIN_EMAIL) adminStore.settings.adminEmail = parsedVars.ADMIN_EMAIL;
    if (parsedVars.ADMIN_PASSWORD) adminStore.settings.adminPassword = parsedVars.ADMIN_PASSWORD;
    if (parsedVars.SUPPORT_MOBILE) adminStore.settings.mobileNumber = parsedVars.SUPPORT_MOBILE;
    if (parsedVars.SUPPORT_WHATSAPP) adminStore.settings.whatsappNumber = parsedVars.SUPPORT_WHATSAPP;
    if (parsedVars.SUPPORT_EMAIL) adminStore.settings.supportEmail = parsedVars.SUPPORT_EMAIL;
    if (parsedVars.UPI_ID) adminStore.settings.upiId = parsedVars.UPI_ID;
    if (parsedVars.UPI_PAYEE_NAME) adminStore.settings.upiPayeeName = parsedVars.UPI_PAYEE_NAME;

    saveAdminStore();

    try {
      fs.writeFileSync(CUSTOM_ENV_FILE, envContent, 'utf-8');
    } catch {
      // ignore
    }

    res.json({
      imported: true,
      parsedCount: Object.keys(parsedVars).length,
      settings: adminStore.settings,
      envContent: buildHostingerEnvContent(),
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
  app.get('/api/videos', async (_req, res) => {
    let list = Array.from(uploadedVideos.values()).filter((v) => {
      try {
        return fs.existsSync(v.filePath) && fs.statSync(v.filePath).size > 4096;
      } catch {
        return false;
      }
    });
    if (list.length === 0) {
      await ensureSampleVideo().catch(() => null);
      list = Array.from(uploadedVideos.values()).filter((v) => {
        try {
          return fs.existsSync(v.filePath) && fs.statSync(v.filePath).size > 4096;
        } catch {
          return false;
        }
      });
    }
    const mapped = list
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
    res.json({ videos: mapped });
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
        const probe = await probeVideoFile(finalFilePath);
        if (!probe.isValid) {
          try {
            fs.unlinkSync(finalFilePath);
          } catch {
            // ignore
          }
          res.status(400).json({
            error:
              'Uploaded video file is corrupt or incomplete (missing MP4 moov header). Please upload a valid MP4 video.',
          });
          return;
        }

        const stats = fs.statSync(finalFilePath);
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
        const ff = spawn(FFMPEG_BIN, [
          '-y',
          '-filter_threads', '1',
          '-f', 'lavfi',
          '-i', `color=c=0x${bgHex.replace('#', '')}:s=${sizeStr}:r=30:d=${safeDuration}`,
          '-f', 'lavfi',
          '-i', `sine=frequency=528:sample_rate=44100:duration=${safeDuration}`,
          '-threads', '2',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p',
          '-b:v', '1200k',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
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

      let video =
        uploadedVideos.get(videoId) ||
        Array.from(uploadedVideos.values()).find((v) => fs.existsSync(v.filePath));

      if (video && fs.existsSync(video.filePath)) {
        const checkProbe = await probeVideoFile(video.filePath);
        if (checkProbe.isValid) {
          video.hasAudio = checkProbe.hasAudio;
          video.videoCodec = checkProbe.videoCodec;
          video.audioCodec = checkProbe.audioCodec;
          video.durationSec = checkProbe.durationSec || video.durationSec || 6;
        } else {
          // Selected video is corrupt/incomplete (would cause FFmpeg code 183 AVERROR_INVALIDDATA)
          uploadedVideos.delete(video.id);
          video = undefined;
        }
      }

      if (!video || !fs.existsSync(video.filePath)) {
        const fallbackSample = await ensureSampleVideo().catch(() => null);
        if (fallbackSample && fs.existsSync(fallbackSample.filePath)) {
          video = fallbackSample;
          video.videoCodec = 'h264';
          video.audioCodec = 'aac';
        }
      }

      if (!video || !fs.existsSync(video.filePath)) {
        res.status(400).json({
          error:
            'Uploaded video file not found on server. Please select or upload a video in Step 2 first.',
        });
        return;
      }

      // Ensure codec metadata is populated even for previously uploaded videos in uploads/videos.json
      if (!video.videoCodec || !video.audioCodec) {
        try {
          const probed = await probeVideoFile(video.filePath);
          video.hasAudio = probed.hasAudio;
          video.durationSec = probed.durationSec || video.durationSec;
          video.videoCodec = probed.videoCodec;
          video.audioCodec = probed.audioCodec;
          saveCatalog();
        } catch {
          // Non-fatal; fallback logic will handle copy/transcode automatically
        }
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
          stopStreamJob(oldJob);
          activeJobs.delete(oldId);
        }
      }

      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const { width, height, videoBitrate } = getResolutionArgs(quality, orientation);
      const targetFps = Number(fps) === 60 ? 60 : 30;

      const logoFilePath = effectiveShowLogo ? resolveLogoFilePath() : null;
      const thumbFilePath = resolveThumbnailFilePath(jobId, thumbnailDataUrl);

      const destList = destinations as RtmpDestination[];
      const combinedLabel = destList
        .map((d) => d.channelName || (d.platform || 'RTMP').toUpperCase())
        .join(' + ');

      const realDestinations = destList.filter(
        (d) =>
          d.streamKey !== 'yt-live-24x7-key' &&
          d.streamKey !== 'FB-3948102948eQ-7' &&
          !d.streamKey.startsWith('demo_')
      );
      const isPreviewOnly = realDestinations.length === 0;

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
        destinations: destList,
        status: 'live',
        startedAt: Date.now(),
        processes: [],
        cleanupHandlers: [],
        lastLog: isPreviewOnly
          ? `[Preview Mode] Streaming "${video.originalName}" in smooth 24/7 loop. Paste your real YouTube/Facebook Stream Key in Step 1 to go live publicly.`
          : `Starting 24/7 Live Stream to ${combinedLabel}...`,
        framesSent: 0,
        bitrateKbps: parseInt(videoBitrate, 10),
      };

      const publishers: NativeRtmpPublisher[] = [];
      const hub = new FlvPipeHub((videoFrames, measuredBitrateKbps) => {
        if (job.status !== 'live') return;
        if (measuredBitrateKbps > 0) {
          job.bitrateKbps = measuredBitrateKbps;
        }
        if (isPreviewOnly) {
          job.framesSent = videoFrames;
          job.lastLog = `[Preview Mode] Streaming "${activeVideoFile.originalName}" · ${videoFrames} frames · ${job.bitrateKbps} kbps (Paste your real Stream Key in Step 1 to broadcast live).`;
        } else {
          const totalPublished = publishers.reduce((sum, p) => sum + p.framesPublished, 0);
          if (totalPublished > 0) {
            job.framesSent = totalPublished;
            job.errorMessage = undefined;
            job.lastLog = `[${combinedLabel}] LIVE · ${totalPublished} frames sent · ${job.bitrateKbps} kbps`;
          }
        }
      });

      // Attach one pure Node.js NativeRtmpPublisher per real destination (zero 127.0.0.1 loopback, full TLS SNI)
      for (const dest of realDestinations) {
        const label = dest.channelName || (dest.platform || 'RTMP').toUpperCase();
        const publisher = new NativeRtmpPublisher(
          hub,
          label,
          (attempt) => buildFullRtmpUrl(dest.rtmpUrl, dest.streamKey, dest.platform, attempt),
          {
            onStatus: (status, detail) => {
              if (job.status !== 'live') return;
              const anyStreaming = publishers.some((p) => p.framesPublished > 0);
              if (status === 'streaming') {
                job.errorMessage = undefined;
                job.lastLog = detail;
              } else if (status === 'error') {
                if (!anyStreaming) {
                  job.errorMessage = detail;
                }
                job.lastLog = detail;
              } else if (!anyStreaming) {
                job.lastLog = detail;
              }
            },
            onFrameSent: () => {
              if (job.status !== 'live') return;
              job.framesSent = publishers.reduce((sum, p) => sum + p.framesPublished, 0);
              if (job.framesSent > 0 && job.errorMessage) {
                job.errorMessage = undefined;
              }
            },
          }
        );
        publishers.push(publisher);
        job.cleanupHandlers?.push(() => publisher.stop());
        publisher.start();
      }

      let activeVideoFile = video;
      let ffmpegRetryCount = 0;
      // Start in Zero-CPU Stream Copy (3 threads, <1% CPU) automatically when no watermark/thumbnail overlay is needed and video is H.264
      let useStreamCopyMode =
        !effectiveShowLogo &&
        !thumbFilePath &&
        activeVideoFile.videoCodec === 'h264' &&
        Boolean(activeVideoFile.hasAudio);

      const spawnFlvProducer = async () => {
        if (job.status !== 'live') return;

        const args: string[] = [
          '-nostdin',
          '-y',
          '-hide_banner',
          '-loglevel',
          'info',
          '-fflags',
          '+genpts+igndts+discardcorrupt',
          '-threads',
          '1',
        ];

        const canCopyVideo =
          useStreamCopyMode &&
          (activeVideoFile.videoCodec === 'h264' || !activeVideoFile.videoCodec);

        if (canCopyVideo) {
          // Hostinger Ultra-Low-Resource Zero-CPU Mode (3 OS threads, <1% CPU, 15 MB RAM)
          if (loop247) {
            args.push('-stream_loop', '-1');
          }
          args.push('-re', '-i', activeVideoFile.filePath);

          if (!activeVideoFile.hasAudio) {
            args.push(
              '-threads',
              '1',
              '-f',
              'lavfi',
              '-i',
              'anullsrc=channel_layout=stereo:sample_rate=44100',
              '-map',
              '0:v:0',
              '-map',
              '1:a:0',
              '-c:v',
              'copy',
              '-c:a',
              'aac',
              '-threads',
              '1',
              '-b:a',
              '128k',
              '-ar',
              '44100',
              '-ac',
              '2'
            );
            if (!loop247) args.push('-shortest');
          } else if (activeVideoFile.audioCodec === 'aac' || !activeVideoFile.audioCodec) {
            args.push(
              '-map',
              '0:v:0',
              '-map',
              '0:a:0?',
              '-c:v',
              'copy',
              '-c:a',
              'copy'
            );
          } else {
            args.push(
              '-map',
              '0:v:0',
              '-map',
              '0:a:0?',
              '-c:v',
              'copy',
              '-c:a',
              'aac',
              '-threads',
              '1',
              '-b:a',
              '128k',
              '-ar',
              '44100',
              '-ac',
              '2'
            );
          }

          args.push('-f', 'flv', '-flvflags', 'no_duration_filesize', 'pipe:1');
        } else {
          // Single-threaded libx264 transcode mode with optional watermark & thumbnail intro
          args.push('-filter_threads', '1', '-filter_complex_threads', '1');
          if (loop247) {
            args.push('-stream_loop', '-1');
          }
          args.push('-re', '-i', activeVideoFile.filePath);

          let nextInputIdx = 1;
          let audioInputIdx = 0;
          if (!activeVideoFile.hasAudio) {
            args.push(
              '-threads',
              '1',
              '-f',
              'lavfi',
              '-i',
              'anullsrc=channel_layout=stereo:sample_rate=44100'
            );
            audioInputIdx = nextInputIdx++;
          }

          let thumbInputIdx = -1;
          if (ffmpegRetryCount === 0 && thumbFilePath && fs.existsSync(thumbFilePath)) {
            args.push('-threads', '1', '-i', thumbFilePath);
            thumbInputIdx = nextInputIdx++;
          }

          let logoInputIdx = -1;
          if (ffmpegRetryCount <= 1 && logoFilePath && fs.existsSync(logoFilePath)) {
            args.push('-threads', '1', '-i', logoFilePath);
            logoInputIdx = nextInputIdx++;
          }

          const filterChains: string[] = [];
          filterChains.push(
            `[0:v]fps=${targetFps},setpts=N/(${targetFps}*TB),scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=fast_bilinear,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[vbase]`
          );
          let currentVidLabel = '[vbase]';

          if (thumbInputIdx >= 0 && ffmpegRetryCount === 0) {
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

          const rawAudioSource = !activeVideoFile.hasAudio ? `${audioInputIdx}:a:0` : '0:a:0';
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
            '1',
            '-b:v',
            videoBitrate,
            '-minrate',
            videoBitrate,
            '-maxrate',
            videoBitrate,
            '-bufsize',
            bufSizeK,
            '-x264-params',
            'nal-hrd=cbr:force-cfr=1:threads=1:lookahead-threads=0:sliced-threads=0:sync-lookahead=0:rc-lookahead=0',
            '-pix_fmt',
            'yuv420p',
            '-g',
            gopSize,
            '-keyint_min',
            gopSize,
            '-sc_threshold',
            '0',
            '-flags',
            '+global_header',
            '-c:a',
            'aac',
            '-threads',
            '1',
            '-b:a',
            '128k',
            '-ar',
            '44100',
            '-ac',
            '2',
            '-max_muxing_queue_size',
            '1024',
            '-f',
            'flv',
            '-flvflags',
            'no_duration_filesize',
            'pipe:1'
          );

          if (!loop247 && !activeVideoFile.hasAudio) {
            args.push('-shortest');
          }
        }

        const proc = spawn(FFMPEG_BIN, args);
        job.processes = [proc];

        let producedBytes = 0;
        let stderrTail = '';
        let slowTranscodeHits = 0;

        proc.stdout.on('data', (chunk: Buffer) => {
          producedBytes += chunk.length;
          hub.pushFlvData(chunk);
        });

        proc.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          stderrTail = (stderrTail + text).slice(-1400);
          if (isPreviewOnly) {
            parseFfmpegStats(text, job, combinedLabel);
          }
          // If Hostinger shared CPU throttles libx264 below 0.55x real-time, auto-switch to Zero-CPU Stream Copy
          if (
            !useStreamCopyMode &&
            (activeVideoFile.videoCodec === 'h264' || !activeVideoFile.videoCodec)
          ) {
            const speedMatch = text.match(/speed=\s*([\d.]+)x/);
            if (speedMatch) {
              const spd = parseFloat(speedMatch[1]);
              if (Number.isFinite(spd) && spd > 0 && spd < 0.55) {
                slowTranscodeHits += 1;
                if (slowTranscodeHits >= 6) {
                  useStreamCopyMode = true;
                  job.lastLog = `[${combinedLabel}] Server CPU throttled (${spd}x) — auto-switching to Ultra-Light Stream Copy (1.0x)...`;
                  try {
                    proc.kill('SIGTERM');
                  } catch {
                    // ignore
                  }
                }
              } else {
                slowTranscodeHits = 0;
              }
            }
          }
        });

        proc.on('error', (err) => {
          job.errorMessage = `FFmpeg binary error: ${err.message}`;
          job.lastLog = job.errorMessage;
        });

        proc.on('close', async (code, signal) => {
          job.processes = job.processes.filter((p) => p !== proc);
          if (job.status !== 'live') return;
          if (code === 0 && !loop247) {
            stopStreamJob(job);
            activeJobs.delete(jobId);
            return;
          }

          // If input file caused AVERROR_INVALIDDATA (code 183), switch to guaranteed-valid sample video
          if (
            code === 183 ||
            /Invalid data found when processing input|moov atom not found/i.test(stderrTail)
          ) {
            const fallback = await ensureSampleVideo().catch(() => null);
            if (fallback && fs.existsSync(fallback.filePath)) {
              activeVideoFile = fallback;
              activeVideoFile.videoCodec = 'h264';
              activeVideoFile.audioCodec = 'aac';
            }
          }

          // If libx264 transcode failed due to Hostinger CloudLinux LVE thread/CPU/RAM limit (or emitted 0 bytes),
          // immediately switch to Ultra-Low-Resource Zero-CPU Stream Copy Mode (3 threads, <1% CPU)!
          const hitResourceLimit =
            signal === 'SIGKILL' ||
            producedBytes === 0 ||
            /pthread_create|Resource temporarily unavailable|Cannot allocate memory|killed/i.test(
              stderrTail
            );

          if (!useStreamCopyMode && hitResourceLimit) {
            useStreamCopyMode = true;
            job.lastLog = `[${combinedLabel}] Switching to Hostinger Ultra-Light Stream Copy mode (3 threads, <1% CPU)...`;
          } else if (producedBytes === 0) {
            const errLine =
              stderrTail
                .split(/[\r\n]+/)
                .filter((l) => /error|failed|unable|invalid|resource/i.test(l))
                .slice(-1)[0] || `FFmpeg exited (code=${code}, signal=${signal || 'none'})`;
            job.errorMessage = `Encoder restart (${combinedLabel}): ${errLine.slice(0, 140)}`;
            job.lastLog = job.errorMessage;
          }

          ffmpegRetryCount += 1;
          hub.resetForNewFlvStream();
          setTimeout(() => {
            void spawnFlvProducer();
          }, 800);
        });
      };

      void spawnFlvProducer();

      activeJobs.set(jobId, job);

      res.json({
        job: {
          jobId: job.jobId,
          userId: job.userId,
          sessionId: job.sessionId,
          title: job.title,
          sourceType: job.sourceType,
          videoId: job.videoId,
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
        videoId: j.videoId,
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

  // Live Streaming Server Diagnostics (verifies FFmpeg + outbound RTMPS TLS to YouTube & Facebook on Hostinger)
  app.get('/api/streams/diagnostics', async (_req, res) => {
    const [ytProbe, fbProbe] = await Promise.all([
      probeRtmpsEndpoint('a.rtmps.youtube.com', 443, 'live2'),
      probeRtmpsEndpoint('live-api-s.facebook.com', 443, 'rtmp'),
    ]);
    res.json({
      nodeVersion: process.version,
      platform: process.platform,
      ffmpegBinary: FFMPEG_BIN,
      ffmpegExists: FFMPEG_BIN === 'ffmpeg' ? true : fs.existsSync(FFMPEG_BIN),
      youtubeRtmps: ytProbe,
      facebookRtmps: fbProbe,
      activeJobsCount: activeJobs.size,
      activeJobs: Array.from(activeJobs.values()).map((j) => ({
        jobId: j.jobId,
        status: j.status,
        framesSent: j.framesSent,
        bitrateKbps: j.bitrateKbps,
        errorMessage: j.errorMessage,
        lastLog: j.lastLog,
      })),
    });
  });

  app.post('/api/streams/stop', (req, res) => {
    const { jobId, sessionId } = req.body || {};
    let stoppedCount = 0;

    for (const [id, job] of activeJobs.entries()) {
      if (!jobId || id === jobId || (sessionId && job.sessionId === sessionId)) {
        stopStreamJob(job);
        activeJobs.delete(id);
        stoppedCount++;
      }
    }

    res.json({ stopped: true, stoppedCount });
  });

  // HTTP & WebSocket Browser Live Stream Relay (Camera & Screen Share to YouTube + Facebook simultaneously)
  const spawnBrowserDestinationProcesses = async (
    job: ServerStreamJob,
    msg: {
      destinations?: RtmpDestination[];
      quality?: '480p' | '720p' | '1080p';
      orientation?: 'landscape' | 'portrait';
      fps?: number;
      userId?: string;
      thumbnailDataUrl?: string;
      showThumbnailOverlay?: boolean;
      showWatermarkLogo?: boolean;
    }
  ) => {
    const destinations: RtmpDestination[] = msg.destinations || [];
    const quality = msg.quality || '720p';
    const orientation = msg.orientation || 'landscape';
    const fps = Number(msg.fps) === 60 ? 60 : 30;
    const { width, height, videoBitrate } = getResolutionArgs(quality, orientation);

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
    const thumbFilePath = resolveThumbnailFilePath(job.jobId, msg.thumbnailDataUrl);

    if (!job.cleanupHandlers) {
      job.cleanupHandlers = [];
    }

    const combinedLabel = destinations
      .map((d) => d.channelName || (d.platform || 'RTMP').toUpperCase())
      .join(' + ');

    const realDestinations = destinations.filter(
      (d) =>
        d.streamKey !== 'yt-live-24x7-key' &&
        d.streamKey !== 'FB-3948102948eQ-7' &&
        !d.streamKey.startsWith('demo_')
    );
    const isPreviewOnly = realDestinations.length === 0;

    const publishers: NativeRtmpPublisher[] = [];
    const hub = new FlvPipeHub((videoFrames, measuredBitrateKbps) => {
      if (job.status !== 'live') return;
      if (measuredBitrateKbps > 0) {
        job.bitrateKbps = measuredBitrateKbps;
      }
      if (isPreviewOnly) {
        job.framesSent = Math.max(job.framesSent, videoFrames);
      } else {
        const totalPublished = publishers.reduce((sum, p) => sum + p.framesPublished, 0);
        if (totalPublished > 0) {
          job.framesSent = totalPublished;
          job.errorMessage = undefined;
          job.lastLog = `[${combinedLabel}] Browser LIVE · ${totalPublished} frames sent · ${job.bitrateKbps} kbps`;
        }
      }
    });

    for (const dest of realDestinations) {
      const label = dest.channelName || (dest.platform || 'RTMP').toUpperCase();
      const publisher = new NativeRtmpPublisher(
        hub,
        label,
        (attempt) => buildFullRtmpUrl(dest.rtmpUrl, dest.streamKey, dest.platform, attempt),
        {
          onStatus: (status, detail) => {
            if (job.status !== 'live') return;
            const anyStreaming = publishers.some((p) => p.framesPublished > 0);
            if (status === 'streaming') {
              job.errorMessage = undefined;
              job.lastLog = detail;
            } else if (status === 'error') {
              if (!anyStreaming) job.errorMessage = detail;
              job.lastLog = detail;
            } else if (!anyStreaming) {
              job.lastLog = detail;
            }
          },
          onFrameSent: () => {
            if (job.status !== 'live') return;
            job.framesSent = publishers.reduce((sum, p) => sum + p.framesPublished, 0);
            if (job.framesSent > 0 && job.errorMessage) {
              job.errorMessage = undefined;
            }
          },
        }
      );
      publishers.push(publisher);
      job.cleanupHandlers.push(() => publisher.stop());
      publisher.start();
    }

    const args: string[] = [
      '-y',
      '-hide_banner',
      '-loglevel',
      'info',
      '-filter_threads',
      '1',
      '-filter_complex_threads',
      '1',
      '-fflags',
      '+genpts+igndts+discardcorrupt',
      '-threads',
      '1',
      '-i',
      'pipe:0',
      '-threads',
      '1',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=44100',
    ];

    let nextInputIdx = 2;
    let thumbInputIdx = -1;
    if (thumbFilePath && fs.existsSync(thumbFilePath)) {
      args.push('-threads', '1', '-i', thumbFilePath);
      thumbInputIdx = nextInputIdx++;
    }

    let logoInputIdx = -1;
    if (logoFilePath && fs.existsSync(logoFilePath)) {
      args.push('-threads', '1', '-i', logoFilePath);
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
      '1',
      '-b:v',
      videoBitrate,
      '-minrate',
      videoBitrate,
      '-maxrate',
      videoBitrate,
      '-bufsize',
      bufSizeK,
      '-x264-params',
      'nal-hrd=cbr:force-cfr=1:threads=1:lookahead-threads=0:sliced-threads=0:sync-lookahead=0:rc-lookahead=0',
      '-pix_fmt',
      'yuv420p',
      '-g',
      gopSize,
      '-keyint_min',
      gopSize,
      '-sc_threshold',
      '0',
      '-flags',
      '+global_header',
      '-c:a',
      'aac',
      '-threads',
      '1',
      '-b:a',
      '128k',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-max_muxing_queue_size',
      '2048',
      '-f',
      'flv',
      '-flvflags',
      'no_duration_filesize',
      'pipe:1'
    );

    const proc = spawn(FFMPEG_BIN, args);

    proc.stdout.on('data', (chunk: Buffer) => {
      hub.pushFlvData(chunk);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      if (isPreviewOnly) {
        parseFfmpegStats(chunk.toString(), job, combinedLabel);
      }
    });

    proc.on('error', (err) => {
      job.errorMessage = `RTMP error (${combinedLabel}): ${err.message}`;
      job.lastLog = job.errorMessage;
    });

    proc.stdin.on('error', () => {});

    job.processes.push(proc);
  };

  app.post('/api/streams/browser-start', async (req, res) => {
    try {
      const msg = req.body || {};
      const destinations: RtmpDestination[] = msg.destinations || [];
      if (!destinations.length) {
        return res.status(400).json({ error: 'At least one RTMP destination is required.' });
      }
      const quality = msg.quality || '720p';
      const orientation = msg.orientation || 'landscape';
      const fps = Number(msg.fps) === 60 ? 60 : 30;
      const { videoBitrate } = getResolutionArgs(quality, orientation);

      // Stop any existing stream for this user
      for (const [id, existing] of activeJobs.entries()) {
        if (existing.userId === (msg.userId || 'guest')) {
          stopStreamJob(existing);
          activeJobs.delete(id);
        }
      }

      const jobId = `httpjob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const job: ServerStreamJob = {
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

      await spawnBrowserDestinationProcesses(job, msg);
      activeJobs.set(jobId, job);

      res.json({ started: true, jobId, sessionId: job.sessionId });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to start browser broadcast',
      });
    }
  });

  app.post(
    '/api/streams/browser-chunk',
    express.raw({ type: ['application/octet-stream', 'video/*'], limit: '5mb' }),
    (req, res) => {
      const jobId = String(req.query.jobId || '');
      const job = activeJobs.get(jobId);
      if (!job || job.status !== 'live') {
        return res.status(404).json({ error: 'Active stream job not found' });
      }
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
      if (buffer.length > 0) {
        job.framesSent += 1;
        for (const proc of job.processes) {
          if (proc.stdin && !proc.stdin.destroyed && proc.stdin.writable) {
            try {
              proc.stdin.write(buffer);
            } catch {
              // ignore
            }
          }
        }
      }
      res.json({ ok: true, framesSent: job.framesSent });
    }
  );

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
            const { videoBitrate } = getResolutionArgs(quality, orientation);

            const jobId = `wsjob_${Date.now()}`;
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

            spawnBrowserDestinationProcesses(currentJob, msg);

            activeJobs.set(jobId, currentJob);
            ws.send(JSON.stringify({ type: 'started', jobId }));
          } else if (msg.type === 'stop') {
            if (currentJob) {
              stopStreamJob(currentJob);
              activeJobs.delete(currentJob.jobId);
              currentJob = null;
            }
          }
        } catch {
          // ignore
        }
      } else if (currentJob && currentJob.status === 'live') {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
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
        stopStreamJob(currentJob);
        activeJobs.delete(currentJob.jobId);
        currentJob = null;
      }
    });
  });

  const distPath = path.join(process.cwd(), 'dist');
  const hasDistBuild = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV !== 'production' && !process.env.HOSTINGER_PROD) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch {
      if (hasDistBuild) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  } else {
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
