-- BistLeague Database Schema
-- Run this in Supabase SQL Editor

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Leagues table
CREATE TABLE leagues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  starting_balance INTEGER DEFAULT 100000 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leagues are viewable by everyone" ON leagues FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create leagues" ON leagues FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update their leagues" ON leagues FOR UPDATE USING (auth.uid() = creator_id);

-- League members table
CREATE TABLE league_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cash_balance INTEGER NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "League members viewable by members" ON league_members FOR SELECT USING (true);
CREATE POLICY "Users can join leagues" ON league_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own membership" ON league_members FOR UPDATE USING (auth.uid() = user_id);

-- Portfolios table
CREATE TABLE portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  stock_symbol TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  avg_buy_price NUMERIC(10, 4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, league_id, stock_symbol)
);

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolios viewable by everyone" ON portfolios FOR SELECT USING (true);
CREATE POLICY "Users can manage own portfolios" ON portfolios FOR ALL USING (auth.uid() = user_id);

-- Transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  stock_symbol TEXT NOT NULL,
  stock_name TEXT,
  type TEXT CHECK (type IN ('buy', 'sell')) NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10, 4) NOT NULL,
  commission NUMERIC(10, 4) NOT NULL,
  total_amount NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "League members can view league transactions" ON transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_id = transactions.league_id
      AND user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Stocks cache table (for caching Yahoo Finance data)
CREATE TABLE stocks_cache (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 4),
  previous_close NUMERIC(10, 4),
  change NUMERIC(10, 4),
  change_percent NUMERIC(8, 4),
  volume BIGINT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stocks_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stocks cache viewable by everyone" ON stocks_cache FOR SELECT USING (true);
CREATE POLICY "Service role can manage stocks cache" ON stocks_cache FOR ALL USING (true);

-- Function: auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function: generate unique league code
CREATE OR REPLACE FUNCTION generate_league_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
