export type PlaceRecord = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  city: string | null;
  country: string | null;
  category: string;
  isMain: boolean;
  latitude: number;
  longitude: number;
  linkUrl: string | null;
  dueDate: Date | null;
  budget: number | null;
  createdAt: Date;
  updatedAt: Date;
  imageUrl: string | null;
  imageAlt: string | null;
};

export type CardRecord = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  notes: string | null;
  linkUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  places: PlaceRecord[];
  primaryPlaceId: string | null;
  primaryPlace: PlaceRecord | null;
};

export type CardItemMediaRecord = {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  url: string;
  subfolder?: string;
};

export type CardItemRecord = {
  id: string;
  cardId: string;
  nameTitle: string;
  description: string | null;
  linkUrl: string | null;
  value: number;
  itemDate: Date | null;
  media: CardItemMediaRecord | null;
  createdAt: Date;
  updatedAt: Date;
};
