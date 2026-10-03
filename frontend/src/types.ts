// --- Account ---

// For internal use only, not exposed to clients
export type UserDB = {
  id: string;
  email: string;
  display_name: string;
  created_at: number;
  password_hash: string;
  auth_method: "password" | "oauth";
};

// For external use, exposed to clients (authentication and authorization)
export type User = {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
};


// Bill session participants with account
export type AccountBillUser = {
  type: "ACCOUNT";
  id: string;
  name: string;
  accountId: string;
  email: string;
};

// Bill session participants without account
export type GuestBillUser = {
  type: "GUEST";
  id: string;
  name: string;
};

export type BillUser = GuestBillUser | AccountBillUser;

// --- Bill ---

// Bill, including items, participants, 
// and metadata such as GST, tip, and service fee
export type Bill = {
  id: string;
  ownerId: string;
  joinCode: string;
  createdAt: number;
  title: string;
  people: BillUser[];
  items: BillItem[];
  gstMode: GstMode;
  gstRate: number;
  tipAmount: number;
  serviceFeeAmount: number;
  receiptTotal?: number;
  settledUserIds: string[];
  paidAt?: number;
};

// Bill item, including price, quantity, and assigned users
export type BillItem = {
  id: string;
  name: string;
  price: number;
  assignedTo: string[];
};

export type GstMode =
  | "inclusive"
  | "exclusive"
  | "none";


// --- Split calculation ---

// Claimed item share for a specific user
export type ClaimedItemShare = {
  itemId: string;
  name: string;
  fullPrice: number;
  userShareAmount: number;
  splitRatio: number;
}

// Unclaimed item share 
export type UnclaimedItemShare = {
  itemId: string;
  name: string;
  fullPrice: number;
  unclaimedAmount: number;
  unclaimedRatio: number;
};

// Split information for a specific user, 
// including their claimed item shares and unclaimed item shares
export type SplitResultForUser = {
  userId: string;
  claimedItemShares: ClaimedItemShare[];
  itemsSubtotal: number;
  gstShare: number;
  tipShare: number;
  serviceFeeShare: number;
  total: number;
  hasPaid: boolean;
};

// Overall split result for a bill, 
// including each user's split and unclaimed item shares
export type SplitResult = {
  userSplits: SplitResultForUser[];
  unclaimedItemShares: UnclaimedItemShare[];
  unclaimedItemSharesTotal: number;
  unclaimedSubtotal: number;
  grandTotal: number;
};