import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://fexxjzopaepyrxcjtpfp.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHhqem9wYWVweXJ4Y2p0cGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMDU3NzEsImV4cCI6MjA3MjY4MTc3MX0.cK_mcyldyx5LhKMHCkhnAQIK6um0zLJnY15q9Db1VeE"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
