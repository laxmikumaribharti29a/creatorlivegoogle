import React, { useEffect } from 'react';
import { X, FileText, ShieldCheck, RefreshCcw, Mail, Phone, MapPin } from 'lucide-react';

export type LegalPolicyTab = 'terms' | 'privacy' | 'refund';

interface LegalPoliciesModalProps {
  activeTab: LegalPolicyTab;
  onChangeTab: (tab: LegalPolicyTab) => void;
  onClose: () => void;
  websiteName: string;
  businessAddress: string;
  supportEmail: string;
  mobileNumber: string;
  whatsappNumber: string;
}

export default function LegalPoliciesModal({
  activeTab,
  onChangeTab,
  onClose,
  websiteName,
  businessAddress,
  supportEmail,
  mobileNumber,
  whatsappNumber,
}: LegalPoliciesModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const brand = websiteName || 'CreatorLive24/7';
  const address = businessAddress ? `${businessAddress}, India` : 'Patna, Bihar, India';
  const email = supportEmail || 'typing.classes@gmail.com';
  const phone = mobileNumber || '+91 81020 35505';
  const cleanWa = (whatsappNumber || mobileNumber || '').replace(/[^0-9]/g, '');

  const tabs: { id: LegalPolicyTab; label: string; icon: React.ReactNode }[] = [
    { id: 'terms', label: 'Terms & Conditions', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'privacy', label: 'Privacy Policy', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'refund', label: 'Refund Policy', icon: <RefreshCcw className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Legal Policies"
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              {activeTab === 'terms'
                ? 'Terms & Conditions'
                : activeTab === 'privacy'
                ? 'Privacy Policy'
                : 'Refund & Cancellation Policy'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {brand} (creatorlive247.com) · Last updated: November 2026
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close legal policy modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Policy Switcher Tabs */}
        <div className="px-5 sm:px-7 pt-3 pb-3 border-b border-slate-200 bg-white flex flex-wrap items-center gap-2 shrink-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#0a101f] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Legal Content */}
        <div className="px-5 sm:px-7 py-6 overflow-y-auto space-y-5 text-sm text-slate-700 leading-relaxed">
          {activeTab === 'terms' && (
            <>
              <p className="text-slate-600">
                Welcome to <strong className="text-slate-900">{brand}</strong> (accessible at{' '}
                <strong className="text-slate-900">creatorlive247.com</strong>). By accessing or
                using our 24/7 cloud live streaming platform, you agree to be bound by these Terms
                &amp; Conditions. If you do not agree with any part of these terms, please do not
                use our service.
              </p>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">1. Description of Service</h3>
                <p>
                  {brand} provides cloud-based 24/7 pre-recorded video looping and live RTMP/RTMPS
                  broadcasting tools that allow creators to stream videos, camera feeds, or screen
                  captures to supported platforms such as YouTube Live, Facebook Live, and custom
                  RTMP endpoints.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  2. User Accounts &amp; Stream Keys
                </h3>
                <p>
                  You are responsible for maintaining the confidentiality of your account login
                  credentials and third-party RTMP Stream Keys. You must ensure that your YouTube,
                  Facebook, or third-party broadcast account is enabled for live streaming and
                  complies with each destination platform&apos;s community guidelines.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  3. Content Ownership &amp; Acceptable Use
                </h3>
                <p>
                  You retain full ownership of the videos you upload. You represent and warrant that
                  you own or have the necessary rights and licenses to broadcast all audio and video
                  content uploaded to {brand}. You agree not to stream copyrighted material without
                  authorization, adult/explicit content, hate speech, spam, or any content that
                  violates applicable Indian or international laws. We reserve the right to suspend
                  or terminate streams or accounts that violate this policy without prior notice.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  4. Plans, Quotas &amp; Fair Usage
                </h3>
                <p>
                  Free accounts include standard streaming limits and platform watermark branding.
                  Paid subscription plans unlock higher resolution, watermark removal, extended
                  storage, and simultaneous multi-platform streaming as displayed on our Plans page.
                  Abuse of server resources or automated scraping may result in account restriction.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  5. Service Availability &amp; Limitation of Liability
                </h3>
                <p>
                  While we strive for continuous 24/7 streaming uptime with automatic reconnection,
                  broadcasts may occasionally be interrupted due to destination platform limits
                  (YouTube/Facebook RTMP server resets), network conditions, or scheduled server
                  maintenance. {brand} shall not be liable for any indirect, incidental, or
                  consequential damages, including loss of revenue, channel strikes, or viewer
                  counts.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">6. Governing Law</h3>
                <p>
                  These Terms &amp; Conditions are governed by and construed in accordance with the
                  laws of India. Any disputes arising from these terms shall be subject to the
                  jurisdiction of competent courts in Bihar, India.
                </p>
              </section>
            </>
          )}

          {activeTab === 'privacy' && (
            <>
              <p className="text-slate-600">
                At <strong className="text-slate-900">{brand}</strong> (
                <strong className="text-slate-900">creatorlive247.com</strong>), we respect your
                privacy and are committed to protecting your personal data. This Privacy Policy
                explains what information we collect, how we use it, and your rights regarding your
                data.
              </p>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  1. Information We Collect
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Account Information:</strong> Name, email address (via Google Sign-In),
                    or mobile phone number when you register or log in.
                  </li>
                  <li>
                    <strong>Streaming Configuration:</strong> Saved RTMP URLs, Stream Keys, stream
                    titles, thumbnails, and video files you upload to your Video Library.
                  </li>
                  <li>
                    <strong>Payment Records:</strong> Transaction IDs, plan names, and payment
                    status processed through our payment partners (we do not store full card numbers
                    or UPI PINs on our servers).
                  </li>
                  <li>
                    <strong>Technical Logs:</strong> Basic server logs, stream uptime, bitrate, and
                    connection status used strictly to maintain and troubleshoot live streams.
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  2. How We Use Your Information
                </h3>
                <p>
                  We use your information solely to operate your account, deliver 24/7 cloud live
                  streaming to your chosen platforms (YouTube, Facebook, Custom RTMP), process
                  subscriptions, provide customer support, and prevent fraud or service abuse. We
                  never sell or rent your personal information or uploaded videos to third parties.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  3. Data Storage &amp; Security
                </h3>
                <p>
                  All live streams to YouTube and Facebook are transmitted using encrypted TLS
                  (RTMPS) connections where supported. Your Stream Keys are masked in the user
                  interface and used exclusively to initiate broadcasts requested by you.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  4. Data Retention &amp; Deletion
                </h3>
                <p>
                  You can delete your saved Stream Keys or uploaded videos directly from your
                  Dashboard or Video Library at any time. To request complete deletion of your
                  account and associated records, contact us at{' '}
                  <a href={`mailto:${email}`} className="text-[#e60012] font-semibold underline">
                    {email}
                  </a>
                  .
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  5. Third-Party Services
                </h3>
                <p>
                  Our service interacts with third-party platforms such as Google Authentication,
                  YouTube Live, Facebook Live, and payment processors. Your use of those services is
                  also subject to their respective privacy policies.
                </p>
              </section>
            </>
          )}

          {activeTab === 'refund' && (
            <>
              <p className="text-slate-600">
                Thank you for choosing <strong className="text-slate-900">{brand}</strong> (
                <strong className="text-slate-900">creatorlive247.com</strong>). Because our cloud
                streaming infrastructure allocates dedicated bandwidth and processing capacity
                immediately upon plan activation, please review our Refund &amp; Cancellation Policy
                below before purchasing a subscription.
              </p>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  1. Free Tier Evaluation
                </h3>
                <p>
                  We provide a Free tier so you can test video uploads, RTMP key setup, and live
                  streaming compatibility with your YouTube or Facebook channel before upgrading to
                  a paid subscription plan.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  2. Eligibility for Refunds
                </h3>
                <p>A full or partial refund may be approved under the following circumstances:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Duplicate Payment:</strong> You were accidentally charged more than once
                    for the same subscription order.
                  </li>
                  <li>
                    <strong>Payment Deducted Without Plan Activation:</strong> Your payment was
                    successfully debited, but the plan was not activated on your account within 24
                    hours and could not be manually activated by support.
                  </li>
                  <li>
                    <strong>Verified Technical Non-Delivery:</strong> A persistent server-side issue
                    prevents live streaming from working on your account, reported within{' '}
                    <strong>7 days</strong> of purchase, and our support team is unable to resolve
                    it.
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  3. Non-Refundable Situations
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Change of mind after a subscription plan has been actively used.</li>
                  <li>
                    Streaming interruptions caused by invalid/expired YouTube or Facebook Stream
                    Keys, copyright strikes, or third-party platform restrictions/bans on your
                    channel.
                  </li>
                  <li>Accounts suspended due to violation of our Terms &amp; Conditions.</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  4. Subscription Cancellation
                </h3>
                <p>
                  You may cancel your upcoming renewal at any time before the next billing cycle by
                  contacting our support team. Your current paid benefits will remain active until
                  the end of the already paid billing period.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  5. How to Request a Refund &amp; Processing Time
                </h3>
                <p>
                  To request a refund, email{' '}
                  <a href={`mailto:${email}`} className="text-[#e60012] font-semibold underline">
                    {email}
                  </a>{' '}
                  or message our WhatsApp support with your registered email/mobile number, payment
                  date, and Transaction/Order ID. Approved refunds are processed within{' '}
                  <strong>5–7 business days</strong> back to your original payment method.
                </p>
              </section>
            </>
          )}

          {/* Contact Box */}
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-600">
            <p className="font-bold text-slate-900">Contact {brand} Support</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1.5 hover:text-slate-900"
              >
                <Mail className="w-3.5 h-3.5 text-[#e60012]" />
                <span>{email}</span>
              </a>
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 hover:text-slate-900"
              >
                <Phone className="w-3.5 h-3.5 text-[#e60012]" />
                <span>{phone}</span>
              </a>
              {cleanWa && (
                <a
                  href={`https://wa.me/${cleanWa}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold hover:underline"
                >
                  <span>WhatsApp Support</span>
                </a>
              )}
            </div>
            <p className="inline-flex items-center gap-1.5 text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{address}</span>
            </p>
          </div>
        </div>

        {/* Footer Action */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0a101f] hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
