import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

function cleanEnvValue(val: string | undefined, fallback: string): string {
  if (!val) return fallback;
  const trimmed = val.trim();
  if (
    !trimmed ||
    trimmed.startsWith('YOUR_') ||
    trimmed.startsWith('MY_') ||
    trimmed === 'undefined' ||
    trimmed === 'null'
  ) {
    return fallback;
  }
  return trimmed;
}

const resolvedFirebaseConfig = {
  projectId: cleanEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID, firebaseConfigJson.projectId),
  appId: cleanEnvValue(import.meta.env.VITE_FIREBASE_APP_ID, firebaseConfigJson.appId),
  apiKey: cleanEnvValue(import.meta.env.VITE_FIREBASE_API_KEY, firebaseConfigJson.apiKey),
  authDomain: cleanEnvValue(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    firebaseConfigJson.authDomain
  ),
  firestoreDatabaseId: cleanEnvValue(
    import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
    firebaseConfigJson.firestoreDatabaseId
  ),
  storageBucket: cleanEnvValue(
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    firebaseConfigJson.storageBucket
  ),
  messagingSenderId: cleanEnvValue(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    firebaseConfigJson.messagingSenderId
  ),
};

const app = initializeApp(resolvedFirebaseConfig);
export const db = getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const firebaseProjectId = resolvedFirebaseConfig.projectId;

// Validate connection to Firestore on boot as required
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation constants synchronized with firebase-blueprint.json
export const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const MAX_CHANNEL_NAME_LEN = 100;
export const MAX_STREAM_KEY_LEN = 512;
export const MAX_RTMP_URL_LEN = 512;
export const MAX_TITLE_LEN = 160;

export interface StreamKeyRecord {
  id: string;
  userId: string;
  platform: 'youtube' | 'facebook' | 'custom';
  channelName: string;
  streamKey: string;
  rtmpUrl: string;
  enabled: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface StreamSessionRecord {
  id: string;
  userId: string;
  title: string;
  sourceType: 'camera' | 'screen' | 'video';
  videoFileName: string;
  videoServerId: string;
  orientation: 'landscape' | 'portrait';
  quality: '480p' | '720p' | '1080p';
  fps: number;
  loop247: boolean;
  status: 'live' | 'stopped';
  destinations: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(auth, googleProvider);
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export {
  onAuthStateChanged,
  getRedirectResult,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
};
export type { User };

