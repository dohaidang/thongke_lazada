import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { z } from 'zod';
import { LazadaOrder, ScanCheckpoint } from './types';

// TODO: Define exact Zod schema once we get the real API sample payload from User
export const lazadaOrderSchema = z.object({
  orderId: z.string(),
  shopName: z.string(),
  status: z.string(),
  subtotal: z.number().optional(),
  finalTotal: z.number().optional(),
  items: z.array(z.object({
    itemId: z.string(),
    title: z.string(),
    price: z.number(),
    quantity: z.number(),
    picUrl: z.string(),
    skuText: z.string(),
    itemStatus: z.string()
  })),
  createdAt: z.number().optional()
});

interface LazadaExtDB extends DBSchema {
  orders: {
    key: string;
    value: LazadaOrder;
    indexes: {
      'by-date': number;
      'by-status': string;
    };
  };
  cache: {
    key: string;
    value: ScanCheckpoint;
  };
}

const DB_NAME = 'lazada_ext';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LazadaExtDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<LazadaExtDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('orders')) {
          const orderStore = db.createObjectStore('orders', { keyPath: 'orderId' });
          orderStore.createIndex('by-date', 'createdAt');
          orderStore.createIndex('by-status', 'status');
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache'); // No keyPath, using out-of-line keys
        }
      },
    });
  }
  return dbPromise;
};

// --- Orders Operations ---

export const putOrder = async (order: LazadaOrder): Promise<string> => {
  // Validate before inserting (optional but good for data integrity)
  const parsedOrder = lazadaOrderSchema.parse(order);
  const db = await initDB();
  return db.put('orders', parsedOrder as LazadaOrder);
};

export const getOrder = async (orderId: string): Promise<LazadaOrder | undefined> => {
  const db = await initDB();
  return db.get('orders', orderId);
};

export const getAllOrders = async (): Promise<LazadaOrder[]> => {
  const db = await initDB();
  return db.getAll('orders');
};

export const clearOrders = async (): Promise<void> => {
  const db = await initDB();
  return db.clear('orders');
};

// --- Checkpoint Cache Operations ---

export const saveCheckpoint = async (checkpoint: ScanCheckpoint): Promise<string> => {
  const db = await initDB();
  return db.put('cache', checkpoint, 'scan_checkpoint');
};

export const getCheckpoint = async (): Promise<ScanCheckpoint | undefined> => {
  const db = await initDB();
  return db.get('cache', 'scan_checkpoint');
};

export const clearCheckpoint = async (): Promise<void> => {
  const db = await initDB();
  return db.delete('cache', 'scan_checkpoint');
};
