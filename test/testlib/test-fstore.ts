import { Settings } from '@google-cloud/firestore';
import { FirestoreService } from '@fp8proj/firestore';

export const testStoreSettings: Settings = {
    host: '127.0.0.1',
    port: 9901,
    ssl: false,
};

export const testStore = new FirestoreService(testStoreSettings);
