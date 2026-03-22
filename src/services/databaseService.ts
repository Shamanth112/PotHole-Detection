import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export interface Pothole {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  severity?: 'low' | 'medium' | 'high';
  reportImageUrl?: string;
  resolvedImageUrl?: string;
  userId: string;
  userName?: string;
  address?: string;
  status?: 'reported' | 'verified' | 'fixing' | 'resolved';
  notes?: string;
}

export interface UserProfile {
  uid: string;
  displayName?: string;
  email: string;
  photoURL?: string;
  role: 'user' | 'admin' | 'municipal';
}

export interface PermittedUser {
  email: string;
  role: 'user' | 'admin' | 'municipal';
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const dbService = {
  // Potholes
  async getPotholes() {
    const path = 'potholes';
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pothole));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async getPotholesByUser(userId: string) {
    const path = 'potholes';
    try {
      const q = query(collection(db, path), where('userId', '==', userId), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pothole));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async addPothole(pothole: Omit<Pothole, 'id'>) {
    const path = 'potholes';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...pothole,
        timestamp: pothole.timestamp || new Date().toISOString()
      });
      return { id: docRef.id, ...pothole } as Pothole;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  async updatePothole(id: string, updates: Partial<Pothole>) {
    const path = `potholes/${id}`;
    try {
      const docRef = doc(db, 'potholes', id);
      await updateDoc(docRef, updates);
      const updatedDoc = await getDoc(docRef);
      return { id: updatedDoc.id, ...updatedDoc.data() } as Pothole;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  async deletePothole(id: string) {
    const path = `potholes/${id}`;
    try {
      await deleteDoc(doc(db, 'potholes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // Users
  async getUserProfile(uid: string) {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) return null;
      return snapshot.data() as UserProfile;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async upsertUserProfile(profile: UserProfile) {
    const path = `users/${profile.uid}`;
    try {
      const docRef = doc(db, 'users', profile.uid);
      await setDoc(docRef, profile, { merge: true });
      return profile;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async getAllUsers() {
    const path = 'users';
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(doc => doc.data() as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async deleteUser(uid: string) {
    const path = `users/${uid}`;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // Permitted Users
  async getPermittedUser(email: string) {
    const emailKey = email.toLowerCase().trim();
    const path = `permitted_users/${emailKey}`;
    try {
      const docRef = doc(db, 'permitted_users', emailKey);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) return null;
      return snapshot.data() as PermittedUser;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async getAllPermittedUsers() {
    const path = 'permitted_users';
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(doc => doc.data() as PermittedUser);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async addPermittedUser(permitted: PermittedUser) {
    const emailKey = permitted.email.toLowerCase().trim();
    const path = `permitted_users/${emailKey}`;
    try {
      await setDoc(doc(db, 'permitted_users', emailKey), {
        ...permitted,
        email: emailKey
      });
      return permitted;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async deletePermittedUser(email: string) {
    const emailKey = email.toLowerCase().trim();
    const path = `permitted_users/${emailKey}`;
    try {
      await deleteDoc(doc(db, 'permitted_users', emailKey));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // Real-time subscriptions
  subscribeToPotholes(callback: (potholes: Pothole[]) => void) {
    const path = 'potholes';
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const potholes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pothole));
      callback(potholes);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  subscribeToPermittedUsers(callback: (users: PermittedUser[]) => void) {
    const path = 'permitted_users';
    return onSnapshot(collection(db, path), (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as PermittedUser);
      callback(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }
};
