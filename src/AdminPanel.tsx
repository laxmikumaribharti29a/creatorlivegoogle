import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  Users,
  CreditCard,
  Tag,
  Radio,
  ArrowLeft,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
  Download,
  Copy,
  Server,
  FileCode,
} from 'lucide-react';

export interface ManagedUser {
  id: string;
  identifier: string;
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
  adminEmail?: string;
  adminPassword?: string;
}

interface AdminPanelProps {
  settings: MainPageSettings;
  users: ManagedUser[];
  plans: SubscriptionPlan[];
  offers: PromoOffer[];
  payments: PaymentRecord[];
  activeStreamCount: number;
  onRefreshAdminData: () => Promise<void>;
  onBackToSite: () => void;
}

const ADMIN_AUTH_STORAGE_KEY = 'creatorlive247_admin_logged_in_v1';

export default function AdminPanel({
  settings: initialSettings,
  users,
  plans: initialPlans,
  offers: initialOffers,
  payments,
  activeStreamCount,
  onRefreshAdminData,
  onBackToSite,
}: AdminPanelProps) {
  // Admin Login Auth State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [adminTab, setAdminTab] = useState<
    'overview' | 'users' | 'plans' | 'payments' | 'settings' | 'hostinger'
  >('settings');

  // Users search & add state
  const [userSearch, setUserSearch] = useState('');
  const [newUserIdentifier, setNewUserIdentifier] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [showAddUserForm, setShowAddUserForm] = useState(false);

  // Plans & Offers local edit state
  const [plansList, setPlansList] = useState<SubscriptionPlan[]>(initialPlans);
  const [offersList, setOffersList] = useState<PromoOffer[]>(initialOffers);
  const [savingPlans, setSavingPlans] = useState(false);

  // Main Page Settings local edit state
  const [formSettings, setFormSettings] = useState<MainPageSettings>(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Admin Login Email & Password Change State inside Admin Panel
  const [newAdminEmail, setNewAdminEmail] = useState(
    initialSettings.adminEmail || 'typing.classes@gmail.com'
  );
  const [newAdminPassword, setNewAdminPassword] = useState(
    initialSettings.adminPassword || 'admin123'
  );
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Environment Variables (.env) & Hostinger Deployment State
  const [envText, setEnvText] = useState<string>('');
  const [savingEnv, setSavingEnv] = useState<boolean>(false);
  const envFileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchHostingerEnv = async () => {
    try {
      const res = await fetch('/api/admin/env');
      if (!res.ok) return;
      const data = await res.json();
      if (data.envContent) {
        setEnvText(data.envContent);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchHostingerEnv();
  }, []);

  useEffect(() => {
    setFormSettings(initialSettings);
    if (initialSettings.adminEmail) {
      setNewAdminEmail(initialSettings.adminEmail);
    }
    if (initialSettings.adminPassword) {
      setNewAdminPassword(initialSettings.adminPassword);
    }
  }, [initialSettings]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtered users matching search
  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.identifier.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.plan.toLowerCase().includes(q)
    );
  });

  // Update user plan or active status
  const handleUpdateUser = async (userId: string, patch: Partial<ManagedUser>) => {
    try {
      await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await onRefreshAdminData();
      showToast('User updated successfully.');
    } catch {
      // ignore
    }
  };

  // Add new user manually
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserIdentifier.trim()) return;
    try {
      await fetch('/api/users/register-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: newUserIdentifier.trim(),
          name: newUserName.trim() || newUserIdentifier.trim(),
        }),
      });
      setNewUserIdentifier('');
      setNewUserName('');
      setShowAddUserForm(false);
      await onRefreshAdminData();
      showToast('New user added.');
    } catch {
      // ignore
    }
  };

  // Save Plans & Offers
  const handleSavePlansAndOffers = async () => {
    setSavingPlans(true);
    try {
      await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plans: plansList,
          offers: offersList,
        }),
      });
      await onRefreshAdminData();
      showToast('Plans & Offers saved and published to website!');
    } finally {
      setSavingPlans(false);
    }
  };

  // Upload new logo for Main Page Settings
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormSettings((prev) => ({ ...prev, logoUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Main Page Settings (including Admin Login Email & Password)
  const handleSaveMainSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload: MainPageSettings = {
        ...formSettings,
        adminEmail: newAdminEmail.trim() || 'typing.classes@gmail.com',
        adminPassword: newAdminPassword.trim() || 'admin123',
      };
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await onRefreshAdminData();
      showToast('Main Page Settings & Admin Login Credentials saved!');
    } finally {
      setSavingSettings(false);
    }
  };

  // Dedicated Save Admin Login Email & Password Handler
  const handleSaveAdminCredentials = async () => {
    if (!newAdminEmail.trim() || !newAdminPassword.trim()) {
      showToast('Please enter both Admin Login Email and Password.');
      return;
    }
    setSavingCredentials(true);
    try {
      const res = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: newAdminEmail.trim(),
          newPassword: newAdminPassword.trim(),
        }),
      });
      if (res.ok) {
        await onRefreshAdminData();
        await fetchHostingerEnv();
        showToast('Admin Login Email & Password updated successfully!');
      }
    } finally {
      setSavingCredentials(false);
    }
  };

  // Download .env file for Hostinger deployment
  const handleDownloadEnvFile = (fileName = '.env') => {
    const content = envText.trim() || '# CreatorLive24/7 Hostinger .env\nNODE_ENV="production"\nPORT="3000"\n';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${fileName} for Hostinger deployment!`);
  };

  // Copy .env content to clipboard
  const handleCopyEnvText = async () => {
    try {
      await navigator.clipboard.writeText(envText);
      showToast('Copied all .env Environment Variables to clipboard!');
    } catch {
      showToast('Could not copy automatically — please select and copy from the box.');
    }
  };

  // Import / Save edited .env content to Server
  const handleSaveAndImportEnv = async (customContent?: string) => {
    const payloadText = customContent !== undefined ? customContent : envText;
    if (!payloadText.trim()) return;
    setSavingEnv(true);
    try {
      const res = await fetch('/api/admin/env/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envContent: payloadText }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.envContent) setEnvText(data.envContent);
        await onRefreshAdminData();
        showToast(`Imported & applied ${data.parsedCount || ''} Environment Variables (.env)!`);
      } else {
        showToast(data.error || 'Failed to import .env file.');
      }
    } catch {
      showToast('Failed to import .env variables.');
    } finally {
      setSavingEnv(false);
    }
  };

  // Upload a .env file from device to import
  const handleImportEnvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        setEnvText(reader.result);
        await handleSaveAndImportEnv(reader.result);
      }
    };
    reader.readAsText(file);
    if (envFileInputRef.current) envFileInputRef.current.value = '';
  };

  // Admin Login Submit
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmailInput.trim(),
          password: loginPasswordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Invalid Admin Email or Password.');
        return;
      }
      try {
        localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
      setIsAdminAuthenticated(true);
      setLoginPasswordInput('');
    } catch {
      setLoginError('Could not verify credentials. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    try {
      localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    setIsAdminAuthenticated(false);
  };

  // Approve / Reject Payment
  const handleUpdatePaymentStatus = async (
    paymentId: string,
    status: 'approved' | 'rejected'
  ) => {
    try {
      await fetch(`/api/admin/payments/${encodeURIComponent(paymentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await onRefreshAdminData();
      showToast(`Payment marked as ${status}.`);
    } catch {
      // ignore
    }
  };

  // If Admin is not authenticated yet, show Admin Login Card
  if (!isAdminAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 sm:py-20">
        <div className="bg-white rounded-[28px] border border-slate-200 p-7 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#e60012] uppercase">
                ADMIN PANEL
              </p>
              <h1 className="text-2xl font-black text-slate-900 mt-1">
                Admin Login
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Sign in with your Admin Email &amp; Password to manage {initialSettings.websiteName}
              </p>
            </div>
            <button
              type="button"
              onClick={onBackToSite}
              className="p-2 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLoginSubmit} autoComplete="off" className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Admin Login Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={loginEmailInput}
                  onChange={(e) => setLoginEmailInput(e.target.value)}
                  placeholder="Enter admin email"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={loginPasswordInput}
                  onChange={(e) => setLoginPasswordInput(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full pl-10 pr-10 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showLoginPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              {loggingIn ? 'Signing in...' : 'Login to Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-slate-500 uppercase">
            ADMIN PANEL
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">
            Manage {formSettings.websiteName || 'CreatorLive24/7'}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleDownloadEnvFile('.env')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .env (Hostinger)</span>
          </button>
          <button
            type="button"
            onClick={onBackToSite}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <button
            type="button"
            onClick={handleAdminLogout}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock Admin</span>
          </button>
        </div>
      </div>

      {/* Navigation Pill Tabs (Matching Screenshots) */}
      <div className="inline-flex flex-wrap items-center gap-1 bg-white border border-slate-200 rounded-full p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setAdminTab('overview')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            adminTab === 'overview'
              ? 'bg-[#0f172a] text-white font-bold'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('users')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            adminTab === 'users'
              ? 'bg-[#0f172a] text-white font-bold'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          Users
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('plans')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            adminTab === 'plans'
              ? 'bg-[#0f172a] text-white font-bold'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          Plans & Offers
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('payments')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            adminTab === 'payments'
              ? 'bg-[#0f172a] text-white font-bold'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          Payments
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('settings')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            adminTab === 'settings'
              ? 'bg-[#0f172a] text-white font-bold'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          Main Page Settings
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('hostinger')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            adminTab === 'hostinger'
              ? 'bg-[#0f172a] text-white font-bold'
              : 'text-emerald-700 hover:text-emerald-900'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Hostinger &amp; .env</span>
        </button>
      </div>

      {/* Confirmation Toast */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ==================== TAB 1: OVERVIEW ==================== */}
      {adminTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold text-slate-500">Total Users</span>
                <Users className="w-4 h-4" />
              </div>
              <p className="text-3xl font-black text-slate-900 tabular-nums">{users.length}</p>
              <p className="text-xs text-slate-500">
                {users.filter((u) => u.active).length} active accounts
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold text-slate-500">Paid Subscribers</span>
                <CreditCard className="w-4 h-4" />
              </div>
              <p className="text-3xl font-black text-slate-900 tabular-nums">
                {users.filter((u) => u.plan !== 'Free').length}
              </p>
              <p className="text-xs text-slate-500">Pro Monthly & Yearly plans</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold text-slate-500">Active Offers</span>
                <Tag className="w-4 h-4" />
              </div>
              <p className="text-3xl font-black text-slate-900 tabular-nums">
                {offersList.filter((o) => o.active).length}
              </p>
              <p className="text-xs text-slate-500">
                {plansList.filter((p) => p.active).length} active subscription plans
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold text-slate-500">24/7 Live Now</span>
                <Radio className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-3xl font-black text-red-600 tabular-nums">{activeStreamCount}</p>
              <p className="text-xs text-slate-500">Running on FFmpeg cloud server</p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: USERS (EXACT MATCH TO SCREENSHOT) ==================== */}
      {adminTab === 'users' && (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-2xs overflow-hidden">
          {/* Top Search & Count Bar */}
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-0 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by email, mobile or name"
                className="w-full pl-7 pr-4 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowAddUserForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add User</span>
              </button>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {filteredUsers.length} users
              </span>
            </div>
          </div>

          {/* Optional Add User Row */}
          {showAddUserForm && (
            <form
              onSubmit={handleCreateUser}
              className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3"
            >
              <input
                type="text"
                value={newUserIdentifier}
                onChange={(e) => setNewUserIdentifier(e.target.value)}
                placeholder="Email ID or 10-digit Mobile Number"
                className="px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl flex-1 min-w-[200px]"
              />
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="User Full Name"
                className="px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl flex-1 min-w-[160px]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#0f172a] text-white text-xs font-bold cursor-pointer"
              >
                Save User
              </button>
            </form>
          )}

          {/* Users Table Header */}
          <div className="grid grid-cols-12 px-6 py-3.5 border-b border-slate-100 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            <div className="col-span-4">EMAIL / MOBILE</div>
            <div className="col-span-3">SUBSCRIPTION PLAN</div>
            <div className="col-span-3">WEBSITE LOGO (HIDE / UNHIDE)</div>
            <div className="col-span-1 text-center">LIVE</div>
            <div className="col-span-1 text-right">ACTIVE</div>
          </div>

          {/* Users Table Rows */}
          <div className="divide-y divide-slate-100">
            {filteredUsers.map((u) => {
              const isLogoHideAllowed =
                typeof u.allowLogoHide === 'boolean' ? u.allowLogoHide : u.plan !== 'Free';
              return (
                <div
                  key={u.id}
                  className="grid grid-cols-12 items-center px-6 py-4 hover:bg-slate-50/50 transition-colors"
                >
                  {/* Col 1: Email / Mobile + Name */}
                  <div className="col-span-4 pr-3">
                    <p className="text-sm font-medium text-slate-900 break-all">{u.identifier}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {u.name}
                      {u.isAdmin ? ' · Admin' : ''}
                    </p>
                  </div>

                  {/* Col 2: Subscription Plan Dropdown + Expiry */}
                  <div className="col-span-3 pr-3">
                    <select
                      value={u.plan}
                      onChange={(e) => handleUpdateUser(u.id, { plan: e.target.value })}
                      className="px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 cursor-pointer min-w-[120px]"
                    >
                      <option value="Free">Free</option>
                      {plansList
                        .filter((p) => p.name !== 'Free')
                        .map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    {u.plan !== 'Free' && u.planExpiry && (
                      <p className="text-[11px] text-slate-500 mt-1 tabular-nums">{u.planExpiry}</p>
                    )}
                  </div>

                  {/* Col 3: Website Logo Hide / Unhide Permission Toggle in User List */}
                  <div className="col-span-3 pr-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isLogoHideAllowed}
                        onClick={() =>
                          handleUpdateUser(u.id, { allowLogoHide: !isLogoHideAllowed })
                        }
                        className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center shrink-0 cursor-pointer ${
                          isLogoHideAllowed
                            ? 'bg-emerald-600 justify-end'
                            : 'bg-slate-200 justify-start'
                        }`}
                        title="Allow or disallow this user to Hide / Unhide the website logo on their live stream"
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
                      </button>
                      <div className="leading-tight">
                        <span
                          className={`text-xs font-bold block ${
                            isLogoHideAllowed ? 'text-emerald-700' : 'text-slate-600'
                          }`}
                        >
                          {isLogoHideAllowed ? 'Hide/Unhide Allowed' : 'Logo Always Show'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {isLogoHideAllowed
                            ? 'User can hide logo'
                            : 'Free watermark locked'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Col 4: Live Count */}
                  <div className="col-span-1 text-center text-sm font-medium text-slate-800 tabular-nums">
                    {u.liveCount || 0}
                  </div>

                  {/* Col 5: Active / Deactive Red Switch */}
                  <div className="col-span-1 flex items-center justify-end">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={u.active}
                      onClick={() => handleUpdateUser(u.id, { active: !u.active })}
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                        u.active ? 'bg-[#e60012] justify-end' : 'bg-slate-200 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: PLANS & OFFERS ==================== */}
      {adminTab === 'plans' && (
        <div className="space-y-6">
          {/* Subscription Plans Management Card */}
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Manage Subscription Plans</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure pricing, resolution limits (720p/1080p), and 24/7 loop access.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPlansList((prev) => [
                    ...prev,
                    {
                      id: `plan_${Date.now()}`,
                      name: 'Custom Plan',
                      priceInr: 999,
                      billingCycle: 'per month',
                      resolution: '1080p',
                      loop247Allowed: true,
                      removeWatermark: true,
                      description: '24/7 non-stop HD streaming on all platforms.',
                      active: true,
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Plan</span>
              </button>
            </div>

            <div className="space-y-4">
              {plansList.map((plan, idx) => (
                <div
                  key={plan.id}
                  className="border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Plan Name
                    </label>
                    <input
                      type="text"
                      value={plan.name}
                      onChange={(e) => {
                        const next = [...plansList];
                        next[idx] = { ...plan, name: e.target.value };
                        setPlansList(next);
                      }}
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Price (₹ INR)
                    </label>
                    <input
                      type="number"
                      value={plan.priceInr}
                      onChange={(e) => {
                        const next = [...plansList];
                        next[idx] = { ...plan, priceInr: Number(e.target.value) };
                        setPlansList(next);
                      }}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl tabular-nums"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Max Quality
                    </label>
                    <select
                      value={plan.resolution}
                      onChange={(e) => {
                        const next = [...plansList];
                        next[idx] = {
                          ...plan,
                          resolution: e.target.value as '720p' | '1080p',
                        };
                        setPlansList(next);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="720p">720p HD</option>
                      <option value="1080p">1080p Full HD</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={plan.description}
                      onChange={(e) => {
                        const next = [...plansList];
                        next[idx] = { ...plan, description: e.target.value };
                        setPlansList(next);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-4 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...plansList];
                          next[idx] = { ...plan, active: !plan.active };
                          setPlansList(next);
                        }}
                        className={`w-10 h-5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                          plan.active ? 'bg-[#e60012] justify-end' : 'bg-slate-200 justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white block" />
                      </button>
                      <span className="text-xs font-medium text-slate-600">
                        {plan.active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    {plan.name !== 'Free' && (
                      <button
                        type="button"
                        onClick={() => setPlansList(plansList.filter((p) => p.id !== plan.id))}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Promotional Offers Active Card */}
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Promotional Offers (Offers Active)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle offers active to display a live discount banner on the Home Page.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setOffersList((prev) => [
                    ...prev,
                    {
                      id: `offer_${Date.now()}`,
                      title: 'New Creator Offer',
                      code: 'LIVE247',
                      discountPercent: 30,
                      bannerText: 'Limited Time: 30% OFF on Pro 24/7 Streaming Plan! Code: LIVE247',
                      validTill: '31/12/2026',
                      active: true,
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Offer</span>
              </button>
            </div>

            <div className="space-y-4">
              {offersList.map((offer, idx) => (
                <div
                  key={offer.id}
                  className="border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Offer Title
                    </label>
                    <input
                      type="text"
                      value={offer.title}
                      onChange={(e) => {
                        const next = [...offersList];
                        next[idx] = { ...offer, title: e.target.value };
                        setOffersList(next);
                      }}
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Coupon Code
                    </label>
                    <input
                      type="text"
                      value={offer.code}
                      onChange={(e) => {
                        const next = [...offersList];
                        next[idx] = { ...offer, code: e.target.value.toUpperCase() };
                        setOffersList(next);
                      }}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Home Page Banner Message
                    </label>
                    <input
                      type="text"
                      value={offer.bannerText}
                      onChange={(e) => {
                        const next = [...offersList];
                        next[idx] = { ...offer, bannerText: e.target.value };
                        setOffersList(next);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-4 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...offersList];
                          next[idx] = { ...offer, active: !offer.active };
                          setOffersList(next);
                        }}
                        className={`w-10 h-5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                          offer.active ? 'bg-[#e60012] justify-end' : 'bg-slate-200 justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white block" />
                      </button>
                      <span className="text-xs font-medium text-slate-600">
                        {offer.active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOffersList(offersList.filter((o) => o.id !== offer.id))}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={savingPlans}
            onClick={handleSavePlansAndOffers}
            className="px-6 py-3 rounded-xl bg-[#e60012] hover:bg-red-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            {savingPlans ? 'Saving...' : 'Save Plans & Offers'}
          </button>
        </div>
      )}

      {/* ==================== TAB 4: PAYMENTS ==================== */}
      {adminTab === 'payments' && (
        <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">UPI & Subscription Payments</h2>
            <span className="text-xs text-slate-500 tabular-nums">{payments.length} records</span>
          </div>

          <div className="divide-y divide-slate-100">
            {payments.map((pay) => (
              <div
                key={pay.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {pay.userIdentifier}{' '}
                    <span className="font-normal text-slate-500">({pay.userName})</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                    Plan: {pay.planName} · ₹{pay.amountInr} · UTR: {pay.utrNumber} · {pay.createdAt}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {pay.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdatePaymentStatus(pay.id, 'approved')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Approve & Activate Plan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdatePaymentStatus(pay.id, 'rejected')}
                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold cursor-pointer"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span
                      className={`text-xs font-bold uppercase ${
                        pay.status === 'approved' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {pay.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 5: MAIN PAGE SETTINGS (EXACT MATCH TO SCREENSHOT) ==================== */}
      {adminTab === 'settings' && (
        <form onSubmit={handleSaveMainSettings} className="space-y-5">
          {/* Card 1: Main page */}
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Main page</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Website name
                </label>
                <input
                  type="text"
                  value={formSettings.websiteName}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, websiteName: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Tagline
                </label>
                <input
                  type="text"
                  value={formSettings.tagline}
                  onChange={(e) => setFormSettings({ ...formSettings, tagline: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Business address
                </label>
                <input
                  type="text"
                  value={formSettings.businessAddress}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, businessAddress: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Logo on free users' live stream */}
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-40 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 flex items-center justify-center p-2 shrink-0">
                <img
                  src={formSettings.logoUrl}
                  alt="Stream Watermark Logo"
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Logo on free users&apos; live stream
                </h3>
                <p className="text-xs text-slate-500">
                  Shown at top-left for users without a paid plan. Paid users never get it. Best:
                  transparent PNG, wide logo.
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formSettings.showLogoOnFreeStream}
                    onClick={() =>
                      setFormSettings((prev) => ({
                        ...prev,
                        showLogoOnFreeStream: !prev.showLogoOnFreeStream,
                      }))
                    }
                    className={`w-10 h-5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                      formSettings.showLogoOnFreeStream
                        ? 'bg-[#e60012] justify-end'
                        : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white block" />
                  </button>
                  <span className="text-xs font-medium text-slate-700">
                    {formSettings.showLogoOnFreeStream ? 'Showing' : 'Hidden'}
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => logoFileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload new logo</span>
              </button>
            </div>
          </div>

          {/* Card 3: Support Us */}
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Support Us</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Mobile number
                </label>
                <input
                  type="text"
                  value={formSettings.mobileNumber}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, mobileNumber: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  WhatsApp number
                </label>
                <input
                  type="text"
                  value={formSettings.whatsappNumber}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, whatsappNumber: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Support email
                </label>
                <input
                  type="email"
                  value={formSettings.supportEmail}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, supportEmail: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Support message
                </label>
                <textarea
                  rows={2}
                  value={formSettings.supportMessage}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, supportMessage: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Social media links */}
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Social media links</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  YouTube
                </label>
                <input
                  type="text"
                  value={formSettings.youtubeUrl}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, youtubeUrl: e.target.value })
                  }
                  placeholder="https://youtube.com/yourpage"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Facebook
                </label>
                <input
                  type="text"
                  value={formSettings.facebookUrl}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, facebookUrl: e.target.value })
                  }
                  placeholder="https://facebook.com/yourpage"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Instagram
                </label>
                <input
                  type="text"
                  value={formSettings.instagramUrl}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, instagramUrl: e.target.value })
                  }
                  placeholder="https://instagram.com/yourpage"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  X (Twitter)
                </label>
                <input
                  type="text"
                  value={formSettings.twitterUrl}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, twitterUrl: e.target.value })
                  }
                  placeholder="https://x.com/yourpage"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Card 5: UPI payments (QR code) */}
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">UPI payments (QR code)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  UPI ID
                </label>
                <input
                  type="text"
                  value={formSettings.upiId}
                  onChange={(e) => setFormSettings({ ...formSettings, upiId: e.target.value })}
                  placeholder="name@bank"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Payee name shown in UPI app
                </label>
                <input
                  type="text"
                  value={formSettings.upiPayeeName}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, upiPayeeName: e.target.value })
                  }
                  placeholder="CreatorLive24/7"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Card 6: Admin Login Email & Password Change */}
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Admin Login Email &amp; Password
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Change the Login Email ID and Password used to access this Admin Panel.
                </p>
              </div>
              <button
                type="button"
                disabled={savingCredentials}
                onClick={handleSaveAdminCredentials}
                className="px-4 py-2 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold transition-colors self-start sm:self-auto cursor-pointer"
              >
                {savingCredentials ? 'Updating...' : 'Update Email & Password'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Admin Login Email ID
                </label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="typing.classes@gmail.com"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Admin Login Password
                </label>
                <div className="relative">
                  <input
                    type={showNewAdminPassword ? 'text' : 'password'}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Enter new admin password"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewAdminPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showNewAdminPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 7: Environment Variables (.env) Download & Import for Hostinger */}
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Environment Variables (.env) — Download &amp; Import for Hostinger
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download your ready-to-use <code className="font-mono font-bold text-slate-700">.env</code> file for Hostinger deployment, or import an existing <code className="font-mono font-bold text-slate-700">.env</code> file.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={envFileInputRef}
                  type="file"
                  accept=".env,text/plain"
                  onChange={handleImportEnvFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => envFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import .env File</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyEnvText}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy .env</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadEnvFile('.env')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .env</span>
                </button>
              </div>
            </div>

            <textarea
              rows={10}
              value={envText}
              onChange={(e) => setEnvText(e.target.value)}
              className="w-full p-3.5 text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
              placeholder="# Environment variables (.env)"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">
                Tip: Edit any variable above and click <strong>Apply &amp; Save .env</strong>, or click <strong>Download .env</strong> to upload to Hostinger.
              </span>
              <button
                type="button"
                disabled={savingEnv}
                onClick={() => handleSaveAndImportEnv()}
                className="px-4 py-2 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {savingEnv ? 'Applying...' : 'Apply & Save .env'}
              </button>
            </div>
          </div>

          {/* Save settings red button */}
          <div>
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-3 rounded-xl bg-[#e60012] hover:bg-red-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              {savingSettings ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </form>
      )}

      {/* ==================== TAB 6: HOSTINGER & .ENV DEPLOYMENT ==================== */}
      {adminTab === 'hostinger' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold mb-2">
                  <Server className="w-3.5 h-3.5" />
                  <span>HOSTINGER READY</span>
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  Environment Variables (<code className="font-mono text-emerald-700">.env</code>) &amp; Hostinger Deployment
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Download the <code className="font-mono font-bold">.env</code> file or import your custom <code className="font-mono font-bold">.env</code> variables to deploy CreatorLive24/7 on Hostinger VPS or Hostinger Node.js Web App.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => envFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import .env File</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyEnvText}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Variables</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadEnvFile('.env')}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .env File</span>
                </button>
              </div>
            </div>

            <textarea
              rows={16}
              value={envText}
              onChange={(e) => setEnvText(e.target.value)}
              className="w-full p-4 text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-slate-400"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <a
                  href="/api/admin/env/download?filename=.env"
                  download=".env"
                  className="text-xs font-bold text-emerald-700 hover:underline"
                >
                  Direct Server Download (.env)
                </a>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => handleDownloadEnvFile('hostinger.env.txt')}
                  className="text-xs font-bold text-slate-600 hover:underline cursor-pointer"
                >
                  Download as hostinger.env.txt
                </button>
              </div>

              <button
                type="button"
                disabled={savingEnv}
                onClick={() => handleSaveAndImportEnv()}
                className="px-5 py-2.5 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {savingEnv ? 'Applying...' : 'Save & Apply .env Variables'}
              </button>
            </div>
          </div>

          {/* Step-by-Step Hostinger Deployment Instructions */}
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              How to Deploy CreatorLive24/7 on Hostinger (Step-by-Step)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <p className="font-bold text-slate-900 text-sm">
                  Option A: Hostinger hPanel (Node.js Web App / GitHub)
                </p>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>Click <strong>Download .env File</strong> above or <strong>Copy Variables</strong>.</li>
                  <li>In Hostinger hPanel, open <strong>Websites → Node.js</strong> (Node v20+ or v22).</li>
                  <li>Upload your project ZIP or connect your GitHub repository.</li>
                  <li>In Hostinger <strong>Environment Variables</strong>, import the downloaded <code className="font-mono font-bold">.env</code> file (or paste the variables).</li>
                  <li>Set Build command: <code className="font-mono bg-white px-1.5 py-0.5 rounded border">npm run build</code></li>
                  <li>Set Start command: <code className="font-mono bg-white px-1.5 py-0.5 rounded border">npm start</code> and Port: <code className="font-mono bg-white px-1.5 py-0.5 rounded border">3000</code>.</li>
                </ol>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <p className="font-bold text-slate-900 text-sm">
                  Option B: Hostinger KVM VPS (Recommended for 24/7 FFmpeg Loop)
                </p>
                <p className="text-slate-500">
                  Run these commands on your Hostinger Ubuntu VPS terminal:
                </p>
                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed">
{`sudo apt update && sudo apt install -y ffmpeg nodejs npm
npm install
# Upload your downloaded .env file to the project folder
npm run build
sudo npm install -g pm2
pm2 start npm --name "creatorlive247" -- start
pm2 save && pm2 startup`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
