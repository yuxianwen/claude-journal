import type { Message, MessageFilters, Provider } from '@/types';

export const SHARE_SCHEMA_VERSION = 1;

export interface SharePayload {
  v: number;
  session: {
    title: string;
    provider: Provider;
    model?: string;
    startTime?: string;
    endTime?: string;
    cwd?: string;
  };
  messages: Message[];
  filters: MessageFilters;
  redactions: {
    paths: number;
    secrets: number;
    imagesStripped: number;
  };
  createdAt: string;
}
