export interface Profile {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  code: string;
  creator_id: string;
  starting_balance: number;
  created_at: string;
  member_count?: number;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  cash_balance: number;
  joined_at: string;
  profile?: Profile;
  portfolio_value?: number;
  total_value?: number;
  rank?: number;
}

export interface Portfolio {
  id: string;
  user_id: string;
  league_id: string;
  stock_symbol: string;
  quantity: number;
  avg_buy_price: number;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  league_id: string;
  stock_symbol: string;
  stock_name?: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  total_amount: number;
  created_at: string;
}

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  previous_close: number;
  change: number;
  change_percent: number;
  volume?: number;
  last_updated?: string;
}

export interface StockHistory {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
