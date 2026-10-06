export type Account = {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
};

export type AccountBillUser = {
  type: "ACCOUNT";
  id: string;
  name: string;
  accountId: string;
  email: string;
};

export type GuestBillUser = {
  type: "GUEST";
  id: string;
  name: string;
};

export type BillUser = GuestBillUser | AccountBillUser;

export type GstMode = "inclusive" | "exclusive" | "none";

export type BillItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedTo: string[];
};

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
  settledPersonIds: string[];
  paidAt?: number;
  version: number;
};

export type PersonTotal = {
  personId: string;
  itemsSubtotal: number;
  gstShare: number;
  tipShare: number;
  serviceFeeShare: number;
  total: number;
};

export type SplitResult = {
  personTotals: PersonTotal[];
  unassignedSubtotal: number;
  grandTotal: number;
};
