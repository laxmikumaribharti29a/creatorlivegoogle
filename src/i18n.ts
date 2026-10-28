export type Language = 'en' | 'hi';

export const translations = {
  en: {
    brandSubtitle: 'CreatorLive24/7 Live Provider · Patna, Bihar',
    heroHeadline: 'Go Live 24/7 on YouTube & Facebook — Even After You Close the Tab.',
    heroSub:
      'Stream your camera or screen from the browser, or upload a video and let our servers loop it non-stop — even after you close the tab for seamless 24/7 broadcasting to multiple platforms.',
    loginCtaGoogle: 'Continue with Google',
    loginOrEmailPlaceholder: 'Or enter your Google Email ID (e.g. name@gmail.com)',
    loginWithEmailBtn: 'Login & Open Streaming Setup',
    openSetupBtn: 'Open Streaming Setup Studio →',
    howItWorksTitle: 'Go Live in 3 Simple Steps After Login',
    howStep1Title: '01. Stream Keys',
    howStep1Desc:
      'Connect your YouTube Live, Facebook Live, or Custom RTMP stream keys. Select one or multiple platforms at once.',
    howStep2Title: '02. Stream Source',
    howStep2Desc:
      'Choose browser Webcam, Screen Broadcast with audio, or upload any short/long video to run 24/7 on our cloud server.',
    howStep3Title: '03. Go Live Studio',
    howStep3Desc:
      'Preview your broadcast in 720p/1080p at 30/60 FPS, add a custom thumbnail, and click Go Live Now. Close your tab anytime!',
    bentoTitle: 'Built for Non-Stop 24/7 Creators',
    bento1Title: '01. 24/7 Cloud Video Loop (Tab-Independent)',
    bento1Desc:
      'Upload your pre-recorded video once. Our dedicated FFmpeg cloud servers loop it continuously 24 hours a day, 7 days a week — even when your phone or PC is turned off.',
    bento2Title: '02. YouTube + Facebook Multi-Stream',
    bento2Desc:
      'Save multiple RTMP keys and broadcast to YouTube and Facebook Pages simultaneously from a single studio.',
    bento3Title: '03. Browser Camera & Screen Studio',
    bento3Desc:
      'Go live directly from your webcam or share your screen with system audio without installing OBS or heavy software.',
    bento4Title: '04. Long-Format & High-Bitrate Upload',
    bento4Desc:
      'High-speed chunked uploader supports both vertical Shorts/Reels and long-format full HD 1080p videos at 60 FPS.',
    step1Tab: '1. Stream Keys',
    step2Tab: '2. Stream Source',
    step3Tab: '3. Go Live Studio',
    navHome: 'Home',
    navSetup: 'Streaming Setup',
    navDashboard: '24/7 Dashboard',
    navGuide: 'RTMP Guide',
    signInGoogle: 'Login with Google',
    signOut: 'Sign Out',
    // Step 1
    streamKeysTitle: 'Stream Keys',
    streamKeysSubtitle: 'Select where you want to go live. You can pick more than one.',
    channelNamePlaceholder: 'Channel name (optional)',
    streamKeyPlaceholder: 'Stream key',
    rtmpUrlPlaceholder: 'rtmp://server-url/live',
    saveStreamKey: 'Save stream key',
    savingKey: 'Saving...',
    nextBtn: 'Next',
    // Step 2
    streamSourceTitle: 'Stream Source',
    destinationLabel: 'Destination:',
    noDestinationSelected: 'None selected (select in Step 1)',
    streamCameraTitle: 'Stream Camera',
    streamCameraDesc: 'Front Webcam / Selfie Cam · 720p @ 30fps',
    screenBroadcastTitle: 'Screen Broadcast',
    screenBroadcastDesc: 'Capture Entire Screen, Window, or Browser Tab with Audio',
    videoSourceTitle: 'Video',
    videoSourceDesc: 'Upload a video · runs 24/7 on server in a loop',
    chooseVideoBtn: 'Choose Video from Device',
    uploadingVideo: 'Uploading...',
    openVideoStudioBtn: 'Open Video Studio',
    // Step 3
    goLiveStudioTitle: 'Go Live Studio',
    addThumbnail: 'Add thumbnail',
    changeThumbnail: 'Thumbnail set',
    statusOffline: 'OFFLINE',
    statusLive: 'LIVE NOW',
    streamTitlePlaceholder: 'My Live Stream',
    serverLoopBanner:
      'This video streams from our server in a 24/7 loop. You can close the browser — stop it anytime from the Dashboard.',
    browserStreamBanner:
      'Streaming live from your browser camera/screen. Keep this tab open while broadcasting live.',
    goLiveNowBtn: 'Go Live Now',
    stopLiveBtn: 'Stop Live Stream',
    startingStream: 'Starting Live Stream...',
    // Bottom toolbar
    toolbarTips: 'Tips',
    toolbarLandscape: 'Landscape',
    toolbarPortrait: 'Portrait',
    toolbarQuality: 'Quality',
    toolbarFps: 'FPS',
    toolbarLoop: '24/7 Loop',
    toolbarDashboard: 'Dashboard',
    // Dashboard modal / view
    dashboardTitle: '24/7 Cloud Broadcast Dashboard',
    dashboardSubtitle:
      'Active server-side 24/7 loops keep running even when your browser is closed. Manage or stop them here anytime.',
    activeCloudStreams: 'Active 24/7 Cloud & Live Streams',
    noActiveStreams: 'No active streams running on the server right now.',
    startNewStreamBtn: 'Configure New Stream',
    stopServerStream: 'Stop 24/7 Stream',
    recentHistory: 'Saved Stream Sessions',
    // Tips modal
    tipsTitle: 'How to Get Your YouTube & Facebook Stream Keys',
    tipsYoutubeTitle: 'YouTube Live Stream Key',
    tipsYoutubeSteps:
      '1. Open YouTube Studio (studio.youtube.com) and click Create -> Go Live.\n2. Under Stream Settings, copy "Stream key (paste in encoder)".\n3. Paste it into Step 1 under YouTube. Default URL: rtmps://a.rtmps.youtube.com:443/live2',
    tipsFacebookTitle: 'Facebook Live Stream Key',
    tipsFacebookSteps:
      '1. Open Facebook Live Producer (facebook.com/live/producer).\n2. Select "Streaming software" as your video source.\n3. Copy the "Stream Key" (e.g., FB-3...eQ-7) and enable "Persistent stream key" for 24/7 loops.\n4. Default URL: rtmps://live-api-s.facebook.com:443/rtmp',
    // Video Studio modal
    videoStudioTitle: 'CreatorLive24/7 Video Studio',
    videoStudioSubtitle:
      'Generate or customize a server-ready loop video clip with audio for instant 24/7 broadcasting.',
    generateLoopVideo: 'Generate & Select 24/7 Video',
    generatingVideo: 'Rendering on Server...',
    footerAddress: 'CreatorLive24/7 Live Provider · Address: Patna, Bihar, India',
  },
  hi: {
    brandSubtitle: 'CreatorLive24/7 Live Provider · पटना, बिहार',
    heroHeadline: 'YouTube और Facebook पर 24/7 नॉन-स्टॉप लाइव चलाएं — ब्राउज़र बंद होने के बाद भी!',
    heroSub:
      'ब्राउज़र से अपना कैमरा या स्क्रीन लाइव स्ट्रीम करें, या वीडियो अपलोड करें जिसे हमारा सर्वर 24/7 नॉन-स्टॉप लूप में चलाएगा — टैब बंद करने के बाद भी कई प्लेटफॉर्म पर एक साथ प्रसारण के लिए।',
    loginCtaGoogle: 'Google से लॉगिन करें (Continue with Google)',
    loginOrEmailPlaceholder: 'या अपनी Google Email ID दर्ज करें (जैसे name@gmail.com)',
    loginWithEmailBtn: 'लॉगिन करें और स्ट्रीमिंग सेटअप खोलें',
    openSetupBtn: 'स्ट्रीमिंग सेटअप स्टूडियो खोलें →',
    howItWorksTitle: 'लॉगिन के बाद 3 आसान स्टेप्स में लाइव जाएं',
    howStep1Title: '01. Stream Keys (स्ट्रीम कीज़)',
    howStep1Desc:
      'अपनी YouTube Live, Facebook Live या Custom RTMP स्ट्रीम की जोड़ें। एक साथ कई प्लेटफॉर्म चुनें।',
    howStep2Title: '02. Stream Source (स्ट्रीम सोर्स)',
    howStep2Desc:
      'वेबकैम, स्क्रीन ब्रॉडकास्ट चुनें या 24/7 सर्वर लूप के लिए कोई भी शॉर्ट/लॉन्ग वीडियो अपलोड करें।',
    howStep3Title: '03. Go Live Studio (गो लाइव स्टूडियो)',
    howStep3Desc:
      '720p/1080p और 30/60 FPS सेट करें, थंबनेल लगाएं और Go Live Now दबाएं। ब्राउज़र बंद होने पर भी लाइव चलता रहेगा!',
    bentoTitle: '24/7 क्रिएटर्स के लिए विशेष फीचर्स',
    bento1Title: '01. 24/7 क्लाउड वीडियो लूप (ब्राउज़र बंद होने पर भी चले)',
    bento1Desc:
      'एक बार वीडियो अपलोड करें। हमारा क्लाउड सर्वर इसे बिना रुके 24x7 लूप में YouTube/Facebook पर स्ट्रीम करता रहेगा — चाहे आपका मोबाइल या कंप्यूटर बंद हो।',
    bento2Title: '02. YouTube + Facebook मल्टी-स्ट्रीमिंग',
    bento2Desc:
      'एक ही समय पर YouTube और Facebook दोनों पर एक साथ लाइव प्रसारण करें।',
    bento3Title: '03. ब्राउज़र कैमरा और स्क्रीन शेयरिंग',
    bento3Desc:
      'बिना किसी भारी सॉफ्टवेयर या OBS के सीधे अपने ब्राउज़र से कैमरा या स्क्रीन लाइव करें।',
    bento4Title: '04. लॉन्ग-फॉर्मेट HD वीडियो अपलोड',
    bento4Desc:
      'हाई-स्पीड चंक्ड अपलोडर से बड़े और लंबे (Long Format) 1080p 60fps वीडियो आसानी से अपलोड करें।',
    step1Tab: '1. Stream Keys',
    step2Tab: '2. Stream Source',
    step3Tab: '3. Go Live Studio',
    navHome: 'होम पेज',
    navSetup: 'स्ट्रीमिंग सेटअप',
    navDashboard: '24/7 डैशबोर्ड',
    navGuide: 'RTMP गाइड',
    signInGoogle: 'Google लॉगिन',
    signOut: 'लॉग आउट',
    // Step 1
    streamKeysTitle: 'Stream Keys',
    streamKeysSubtitle: 'चुनें कि आप कहाँ लाइव जाना चाहते हैं। आप एक से अधिक चुन सकते हैं।',
    channelNamePlaceholder: 'Channel name (optional)',
    streamKeyPlaceholder: 'Stream key',
    rtmpUrlPlaceholder: 'rtmp://server-url/live',
    saveStreamKey: 'Save stream key',
    savingKey: 'सेव हो रहा है...',
    nextBtn: 'Next',
    // Step 2
    streamSourceTitle: 'Stream Source',
    destinationLabel: 'Destination:',
    noDestinationSelected: 'कोई प्लेटफॉर्म नहीं चुना गया (Step 1 में चुनें)',
    streamCameraTitle: 'Stream Camera',
    streamCameraDesc: 'Front Webcam / Selfie Cam · 720p @ 30fps',
    screenBroadcastTitle: 'Screen Broadcast',
    screenBroadcastDesc: 'Capture Entire Screen, Window, or Browser Tab with Audio',
    videoSourceTitle: 'Video',
    videoSourceDesc: 'Upload a video · runs 24/7 on server in a loop',
    chooseVideoBtn: 'Choose Video from Device',
    uploadingVideo: 'अपलोड हो रहा है...',
    openVideoStudioBtn: 'Open Video Studio',
    // Step 3
    goLiveStudioTitle: 'Go Live Studio',
    addThumbnail: 'Add thumbnail',
    changeThumbnail: 'Thumbnail set',
    statusOffline: 'OFFLINE',
    statusLive: 'LIVE NOW',
    streamTitlePlaceholder: 'My Live Stream',
    serverLoopBanner:
      'यह वीडियो हमारे सर्वर से 24/7 लूप में स्ट्रीम होता है। आप ब्राउज़र बंद कर सकते हैं — इसे कभी भी Dashboard से रोकें।',
    browserStreamBanner:
      'आपके ब्राउज़र कैमरा/स्क्रीन से सीधा प्रसारण। लाइव के दौरान यह टैब खुला रखें।',
    goLiveNowBtn: 'Go Live Now',
    stopLiveBtn: 'Stop Live Stream',
    startingStream: 'लाइव शुरू हो रहा है...',
    // Bottom toolbar
    toolbarTips: 'Tips',
    toolbarLandscape: 'Landscape',
    toolbarPortrait: 'Portrait',
    toolbarQuality: 'Quality',
    toolbarFps: 'FPS',
    toolbarLoop: '24/7 Loop',
    toolbarDashboard: 'Dashboard',
    // Dashboard modal / view
    dashboardTitle: '24/7 क्लाउड ब्रॉडकास्ट डैशबोर्ड',
    dashboardSubtitle:
      'अपलोड किए गए 24/7 वीडियो स्ट्रीम ब्राउज़र बंद होने पर भी हमारे सर्वर पर चलते रहते हैं। उन्हें यहाँ से प्रबंधित या बंद करें।',
    activeCloudStreams: 'सक्रिय 24/7 सर्वर लाइव स्ट्रीम्स',
    noActiveStreams: 'इस समय सर्वर पर कोई सक्रिय लाइव स्ट्रीम नहीं चल रहा है।',
    startNewStreamBtn: 'नया स्ट्रीम सेटअप करें',
    stopServerStream: '24/7 स्ट्रीम बंद करें',
    recentHistory: 'सेव किए गए स्ट्रीम सेशन',
    // Tips modal
    tipsTitle: 'YouTube और Facebook स्ट्रीम की (Stream Key) कैसे प्राप्त करें',
    tipsYoutubeTitle: 'YouTube Live Stream Key',
    tipsYoutubeSteps:
      '1. YouTube Studio (studio.youtube.com) खोलें और Create -> Go Live पर क्लिक करें।\n2. Stream Settings के अंतर्गत "Stream key" कॉपी करें।\n3. इसे Step 1 में YouTube में पेस्ट करें। डिफ़ॉल्ट URL: rtmp://a.rtmp.youtube.com/live2',
    tipsFacebookTitle: 'Facebook Live Stream Key',
    tipsFacebookSteps:
      '1. Facebook Live Producer (facebook.com/live/producer) खोलें।\n2. वीडियो सोर्स के रूप में "Streaming software" चुनें।\n3. "Stream Key" कॉपी करें और Step 1 में Facebook में पेस्ट करें।\n4. डिफ़ॉल्ट URL: rtmps://live-api-s.facebook.com:443/rtmp',
    // Video Studio modal
    videoStudioTitle: 'CreatorLive24/7 वीडियो स्टूडियो',
    videoStudioSubtitle:
      'तुरंत 24/7 लूप ब्रॉडकास्टिंग के लिए सर्वर पर नया वीडियो क्लिप तैयार करें।',
    generateLoopVideo: '24/7 वीडियो जनरेट और सेलेक्ट करें',
    generatingVideo: 'सर्वर पर बन रहा है...',
    footerAddress: 'CreatorLive24/7 Live Provider · पता: पटना, बिहार (Patna, Bihar, India)',
  },
};
