/**
 * Firestore Security Rules Test Specification (Dirty Dozen Verification)
 */
export interface SecurityTestCase {
  id: number;
  name: string;
  collection: 'streamKeys' | 'streamSessions';
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  docId: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on StreamKey Create',
    collection: 'streamKeys',
    operation: 'create',
    auth: { uid: 'attacker_1', email_verified: true },
    docId: 'valid_key_1',
    payload: {
      userId: 'victim_1',
      platform: 'youtube',
      channelName: 'My YT',
      streamKey: 'abcd-1234',
      rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
      enabled: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    collection: 'streamKeys',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: false },
    docId: 'valid_key_2',
    payload: {
      userId: 'user_1',
      platform: 'youtube',
      channelName: 'My YT',
      streamKey: 'abcd-1234',
      rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
      enabled: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow / Ghost Field Injection',
    collection: 'streamKeys',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'valid_key_3',
    payload: {
      userId: 'user_1',
      platform: 'youtube',
      channelName: 'My YT',
      streamKey: 'abcd-1234',
      rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
      enabled: true,
      isVerifiedAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Update-Gap Value Poisoning on enabled field',
    collection: 'streamKeys',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'valid_key_4',
    payload: {
      enabled: 'not_a_boolean',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Cross-User Read (get)',
    collection: 'streamKeys',
    operation: 'get',
    auth: { uid: 'attacker_1', email_verified: true },
    docId: 'victim_key_1',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Unfiltered List Query against another user resource',
    collection: 'streamKeys',
    operation: 'list',
    auth: { uid: 'attacker_1', email_verified: true },
    docId: 'victim_key_1',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Owner UID Mutation on Update',
    collection: 'streamKeys',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'valid_key_1',
    payload: {
      userId: 'user_2',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Forged Client Timestamp',
    collection: 'streamSessions',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'session_1',
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Oversized StreamKey String (> 512 chars)',
    collection: 'streamKeys',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'valid_key_9',
    payload: {
      streamKey: 'x'.repeat(600),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invalid Platform Enum Value',
    collection: 'streamKeys',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'valid_key_10',
    payload: {
      platform: 'invalid_platform',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal State Re-opening on Stopped Session',
    collection: 'streamSessions',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'stopped_session_1',
    payload: {
      status: 'live',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'ID Poisoning with Invalid Characters',
    collection: 'streamKeys',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'bad id with spaces!@#',
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
];
