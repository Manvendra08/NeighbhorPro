import { Timestamp, FieldValue } from "firebase/firestore";

/** Use for all createdAt / updatedAt fields in Firestore documents. */
export type FirestoreTimestamp = Timestamp | FieldValue | null;
