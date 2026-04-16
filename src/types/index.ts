export interface LazadaOrder {
  orderId: string;
  shopName: string;
  status: string;
  subtotal?: number;
  finalTotal?: number;
  items: LazadaOrderItem[];
  createdAt?: number;
}

export interface LazadaOrderItem {
  itemId: string;
  title: string;
  price: number;
  quantity: number;
  picUrl: string;
  skuText: string;
  itemStatus: string;
}

export interface ScanCheckpoint {
  selectedTabs: string[];
  currentTabIndex: number;
  currentPage: number;
  savedAt: number;
  isComplete: boolean;
}
