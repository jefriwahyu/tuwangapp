import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gacqrwzcqatvcjidqkbi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhY3Fyd3pjcWF0dmNqaWRxa2JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwOTQyMjcsImV4cCI6MjEwMzY3MDIyN30.ndUitWp_rl55qXRSmFqcL1RRzj_Y7kDMOvs9o1YUvg0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);