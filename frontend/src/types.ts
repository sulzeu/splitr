export type Person = {
  id: string;
  name: string;
};

export type Account = {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
};

export type BillItem = {
  id: string;
  name: string;
  price: number; // total price for this line, in dollars (e.g. quantity already folded in)
  quantity: number;
  /** ids of people this item is assigned to. Length > 1 means shared. */
  assignedTo: string[];
};

export type GstMode =
  | "inclusive" // prices already include GST (the AU default on menus/receipts)
  | "exclusive" // GST needs to be added on top of the listed prices
  | "none"; // no GST on this bill

export type Bill = {
  id: string;
  ownerId: string;
  /** Short human-typable code so other devices can load/edit this same bill. */
  joinCode: string;
  createdAt: number;
  title: string;
  people: Person[];
  items: BillItem[];
  gstMode: GstMode;
  gstRate: number; // e.g. 0.10 for Australia's 10%
  tipAmount: number; // flat dollar amount, 0 by default (AU has no tipping norm)
  serviceFeeAmount: number; // flat dollar amount, e.g. card surcharge or venue service fee
  /** Raw OCR/manual receipt totals, used to sanity-check the itemized sum against the printed total. */
  receiptTotal?: number;
  /** ids of people who have been marked as settled up, for the organizer's tracking view. */
  settledPersonIds: string[];
  paidAt?: number;
};

export type PersonTotal = {
  personId: string;
  itemsSubtotal: number; // this person's share of item prices before gst/tip/fees
  gstShare: number;
  tipShare: number;
  serviceFeeShare: number;
  total: number;
};

export type SplitResult = {
  personTotals: PersonTotal[];
  /** Sum of item prices not yet assigned to anyone. Should be 0 before settling. */
  unassignedSubtotal: number;
  grandTotal: number;
};
