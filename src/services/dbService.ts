import { supabase } from './supabase';
import { League, LeagueMember, Portfolio, Transaction, PortfolioSnapshot } from '../types';
import { fetchStockPrice } from './stockService';

const COMMISSION_RATE = 0.002; // %0.2

// ─── LEAGUES ──────────────────────────────────────────────

export async function createLeague(name: string, userId: string, startingBalance = 100000): Promise<League | null> {
  // Generate unique 6-char code
  let code = '';
  let unique = false;
  while (!unique) {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data } = await supabase.from('leagues').select('id').eq('code', code).maybeSingle();
    if (!data) unique = true;
  }

  const { data, error } = await supabase
    .from('leagues')
    .insert({ name, code, creator_id: userId, starting_balance: startingBalance })
    .select()
    .maybeSingle();

  if (error || !data) return null;

  // Creator joins own league
  await joinLeague(data.id, userId, startingBalance);
  return data;
}

export async function joinLeagueByCode(code: string, userId: string): Promise<{ success: boolean; error?: string; league?: League }> {
  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle();

  if (!league) return { success: false, error: 'Geçersiz lig kodu.' };

  // Check already member
  const { data: existing } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', league.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return { success: false, error: 'Zaten bu ligdeysin.' };

  await joinLeague(league.id, userId, league.starting_balance);
  return { success: true, league };
}

async function joinLeague(leagueId: string, userId: string, cashBalance: number) {
  await supabase.from('league_members').insert({
    league_id: leagueId,
    user_id: userId,
    cash_balance: cashBalance,
  });
}

export async function getUserLeagues(userId: string): Promise<League[]> {
  const { data } = await supabase
    .from('league_members')
    .select('league_id, leagues(*)')
    .eq('user_id', userId);

  if (!data) return [];
  return data.map((d: any) => d.leagues).filter(Boolean);
}

export async function getLeagueMembership(leagueId: string, userId: string): Promise<LeagueMember | null> {
  const { data } = await supabase
    .from('league_members')
    .select('*')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .maybeSingle();
  return data || null;
}

// ─── LEADERBOARD ──────────────────────────────────────────

export async function getLeagueLeaderboard(leagueId: string): Promise<LeagueMember[]> {
  const { data: members } = await supabase
    .from('league_members')
    .select('*')
    .eq('league_id', leagueId);

  if (!members) return [];

  // Fetch profiles separately
  const userIds = members.map((m: any) => m.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds);

  const profileMap: Record<string, any> = {};
  (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

  // For each member, calculate portfolio value
  const withValues = await Promise.all(
    members.map(async (member: any) => {
      const portfolioValue = await calculatePortfolioValue(member.user_id, leagueId);
      return {
        ...member,
        portfolio_value: portfolioValue,
        total_value: member.cash_balance + portfolioValue,
        profile: profileMap[member.user_id] || null,
      };
    })
  );

  return withValues.sort((a, b) => b.total_value - a.total_value).map((m, i) => ({ ...m, rank: i + 1 }));
}

export async function calculatePortfolioValue(userId: string, leagueId: string): Promise<number> {
  const { data: positions } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .gt('quantity', 0);

  if (!positions || positions.length === 0) return 0;

  const values = await Promise.all(
    positions.map(async (pos: any) => {
      const price = await fetchStockPrice(pos.stock_symbol);
      const unitPrice = price ?? (pos.avg_buy_price || 0);
      return unitPrice * (pos.quantity || 0);
    })
  );
  return values.reduce((sum, v) => sum + v, 0);
}

// ─── TRADING ──────────────────────────────────────────────

export async function buyStock(
  userId: string,
  leagueId: string,
  symbol: string,
  stockName: string,
  quantity: number,
  price: number
): Promise<{ success: boolean; error?: string }> {
  const totalCost = price * quantity;
  const commission = Math.round(totalCost * COMMISSION_RATE * 100) / 100;
  const totalDeducted = totalCost + commission;

  // Get current cash
  const { data: member } = await supabase
    .from('league_members')
    .select('cash_balance')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!member) return { success: false, error: 'Üyelik bulunamadı.' };
  if (member.cash_balance < totalDeducted) return { success: false, error: 'Yetersiz bakiye.' };

  const newCash = member.cash_balance - totalDeducted;

  // Update cash
  const { error: cashError } = await supabase
    .from('league_members')
    .update({ cash_balance: newCash })
    .eq('league_id', leagueId)
    .eq('user_id', userId);

  if (cashError) return { success: false, error: cashError.message };

  // Upsert portfolio position
  const { data: existing } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .eq('stock_symbol', symbol)
    .maybeSingle();

  if (existing) {
    const newQty = existing.quantity + quantity;
    const newAvg = (existing.avg_buy_price * existing.quantity + price * quantity) / newQty;
    await supabase
      .from('portfolios')
      .update({ quantity: newQty, avg_buy_price: newAvg, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('portfolios').insert({
      user_id: userId,
      league_id: leagueId,
      stock_symbol: symbol,
      quantity,
      avg_buy_price: price,
    });
  }

  // Record transaction
  await supabase.from('transactions').insert({
    user_id: userId,
    league_id: leagueId,
    stock_symbol: symbol,
    stock_name: stockName,
    type: 'buy',
    quantity,
    price,
    commission,
    total_amount: totalDeducted,
  });

  return { success: true };
}

export async function sellStock(
  userId: string,
  leagueId: string,
  symbol: string,
  stockName: string,
  quantity: number,
  price: number
): Promise<{ success: boolean; error?: string }> {
  // Check portfolio
  const { data: position } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .eq('stock_symbol', symbol)
    .maybeSingle();

  if (!position || position.quantity < quantity) {
    return { success: false, error: 'Yeterli hisse miktarı yok.' };
  }

  const totalReceived = price * quantity;
  const commission = Math.round(totalReceived * COMMISSION_RATE * 100) / 100;
  const netReceived = totalReceived - commission;

  // Update portfolio
  const newQty = position.quantity - quantity;
  if (newQty === 0) {
    await supabase.from('portfolios').delete().eq('id', position.id);
  } else {
    await supabase
      .from('portfolios')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', position.id);
  }

  // Update cash
  const { data: member } = await supabase
    .from('league_members')
    .select('cash_balance')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .maybeSingle();

  if (member) {
    await supabase
      .from('league_members')
      .update({ cash_balance: member.cash_balance + netReceived })
      .eq('league_id', leagueId)
      .eq('user_id', userId);
  }

  // Record transaction
  await supabase.from('transactions').insert({
    user_id: userId,
    league_id: leagueId,
    stock_symbol: symbol,
    stock_name: stockName,
    type: 'sell',
    quantity,
    price,
    commission,
    total_amount: netReceived,
  });

  return { success: true };
}

// ─── PORTFOLIO ────────────────────────────────────────────

export async function getUserPortfolio(userId: string, leagueId: string): Promise<Portfolio[]> {
  const { data } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .gt('quantity', 0);
  return data || [];
}

// ─── TRANSACTIONS ─────────────────────────────────────────

export async function getUserTransactions(userId: string, leagueId: string): Promise<Transaction[]> {
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(100);
  return data || [];
}

export async function getLeagueRecentTransactions(leagueId: string, limit = 30): Promise<any[]> {
  const { data: txns } = await supabase
    .from('transactions')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!txns || txns.length === 0) return [];

  const userIds = [...new Set(txns.map((t: any) => t.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds);

  const profileMap: Record<string, any> = {};
  (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

  return txns.map((t: any) => ({ ...t, profile: profileMap[t.user_id] || null }));
}

// ─── PRICE ALERTS ─────────────────────────────────────────

export interface PriceAlert {
  id: string;
  user_id: string;
  stock_symbol: string;
  target_price: number;
  direction: 'above' | 'below';
  is_active: boolean;
  triggered_at: string | null;
  created_at: string;
}

export async function getUserAlerts(userId: string): Promise<PriceAlert[]> {
  const { data } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function createPriceAlert(
  userId: string,
  stockSymbol: string,
  targetPrice: number,
  direction: 'above' | 'below'
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('price_alerts').insert({
    user_id: userId,
    stock_symbol: stockSymbol,
    target_price: targetPrice,
    direction,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deletePriceAlert(alertId: string): Promise<void> {
  await supabase.from('price_alerts').delete().eq('id', alertId);
}

export async function checkAndTriggerAlerts(userId: string, symbol: string, currentPrice: number): Promise<PriceAlert[]> {
  const { data: alerts } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('stock_symbol', symbol)
    .eq('is_active', true);

  if (!alerts) return [];

  const triggered: PriceAlert[] = [];
  for (const alert of alerts) {
    const hit =
      (alert.direction === 'above' && currentPrice >= alert.target_price) ||
      (alert.direction === 'below' && currentPrice <= alert.target_price);

    if (hit) {
      await supabase
        .from('price_alerts')
        .update({ is_active: false, triggered_at: new Date().toISOString() })
        .eq('id', alert.id);
      triggered.push(alert);
    }
  }
  return triggered;
}

// ─── PORTFOLIO SNAPSHOTS ──────────────────────────────────

export async function savePortfolioSnapshot(userId: string, leagueId: string, totalValue: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await supabase.from('portfolio_snapshots').upsert(
    { user_id: userId, league_id: leagueId, total_value: totalValue, snapshot_date: today },
    { onConflict: 'user_id,league_id,snapshot_date' }
  );
}

export async function getPortfolioSnapshots(userId: string, leagueId: string, days = 30): Promise<PortfolioSnapshot[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .gte('snapshot_date', since.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true });
  return data || [];
}

// ─── LEAGUE CHAT ──────────────────────────────────────────

export interface LeagueMessage {
  id: string;
  league_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export async function getLeagueMessages(leagueId: string, limit = 50): Promise<LeagueMessage[]> {
  const { data } = await supabase
    .from('league_messages')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return data || [];
}

export async function sendLeagueMessage(
  leagueId: string,
  userId: string,
  username: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('league_messages').insert({
    league_id: leagueId,
    user_id: userId,
    username,
    content: content.trim(),
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
