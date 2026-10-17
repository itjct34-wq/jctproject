import type { Locale } from '@/lib/i18n/config';
import en, { type MessageTree } from './en';
import ja from './ja';

export const messages: Record<Locale, MessageTree> = { en, ja };

export type { MessageTree };
