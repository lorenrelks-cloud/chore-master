import { createClient } from '@supabase/supabase-js'

<<<<<<< HEAD
const supabaseUrl = "https://fexxjzopaepyrxcjtpfp.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHhqem9wYWVweXJ4Y2p0cGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMDU3NzEsImV4cCI6MjA3MjY4MTc3MX0.cK_mcyldyx5LhKMHCkhnAQIK6um0zLJnY15q9Db1VeE"
=======
// ✅ Your Supabase project details
const supabaseUrl = "https://fexqjzopaepyrxcjtfpf.supabase.co"
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHhqem9wYWVweXJ4Y2p0cGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMDU3NzEsImV4cCI6MjA3MjY4MTc3MX0.cK_mcyldyx5LhKMHCkhnAQIK6um0zLJnY15q9Db1VeE"
>>>>>>> 0c77821415e04d6067c6dfd86c452522bb507aad

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
