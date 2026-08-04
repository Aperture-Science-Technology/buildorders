import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey)
    : undefined;
