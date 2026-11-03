-- Timbro update 20 (November 2026): Parzymy Tutaj signed up with their own account, so the live
-- demo card from update 19 goes: its business, card, demo customers, stamps and till phones.
-- Their real card is not touched (it belongs to their own account, another business).
-- Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

delete from businesses where id = '7a0c0000-0000-4000-8000-00000000a001';
