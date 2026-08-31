import { StoryFragment } from './challenge';

export interface Round {
  id: string;
  name: string;
  order_number: number;
  story_fragment?: StoryFragment | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoundDto {
  name: string;
  order_number: number;
  story_fragment?: StoryFragment;
  is_active?: boolean;
}

export interface UpdateRoundDto {
  name?: string;
  order_number?: number;
  story_fragment?: StoryFragment;
  is_active?: boolean;
}
