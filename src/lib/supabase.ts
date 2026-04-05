import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = 'https://lahzrlyhojyfadjasdrc.supabase.co';
const SUPABASE_ANON_KEY =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhaHpybHlob2p5ZmFkamFzZHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk0NzUwNDAsImV4cCI6MjA1NTA1MTA0MH0.0IwuqcrHrPS6AqJKVYbNVhP1gjKTh4sP_BPDF8TKHiY';

export function createClient() {
	return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
