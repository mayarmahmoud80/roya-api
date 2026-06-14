import { Types } from 'mongoose';

/** Unified catalog row returned to the portal (builder + OAuth metadata in `datasources`). */
export type UnifiedCatalogRow = {
  _id: Types.ObjectId;
  providerKey: string;
  displayName: string;
  description?: string;
  category?: string;
  implClass?: string;
  authType?: string;
  authScope?: string;
  icon?: string;
  imageUrl?: string;
  isEnabled: boolean;
  /** `oauth` = seeded catalog row; `builder` = palette row; `unified` = merged/admin-maintained. */
  catalogSource?: 'builder' | 'oauth' | 'unified';
};
