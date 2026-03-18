use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("H2wDBbPRayvzc1Y3vD7NxYr19qVTNDQjmhW98HSWHuS8");

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const PROFIT_SPLIT_BPS: u64 = 8_000; // 80 % in basis points
const BPS_DENOMINATOR: u64 = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────────────────
#[program]
pub mod confit_escrow {
    use super::*;

    /// Initialise the singleton ProgramState and its two PDA token accounts.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.admin = ctx.accounts.admin.key();
        state.vault_bump = ctx.bumps.vault;
        state.trading_capital_bump = ctx.bumps.trading_capital;
        state.challenge_count = 0;
        Ok(())
    }

    /// Trader enters a challenge: creates a Challenge PDA and transfers the
    /// entry fee from the trader's token account into the Vault.
    pub fn enter_challenge(
        ctx: Context<EnterChallenge>,
        entry_fee: u64,
        tier: u8,
        profit_target_pct: u8,
        profit_split_pct: u8,
        expires_at: i64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;
        let nonce = state.challenge_count.checked_add(1).unwrap();
        state.challenge_count = nonce;

        let challenge = &mut ctx.accounts.challenge;
        challenge.trader = ctx.accounts.trader.key();
        challenge.entry_fee = entry_fee;
        challenge.tier = tier;
        challenge.status = ChallengeStatus::Active;
        challenge.profit_target_pct = profit_target_pct;
        challenge.profit_split_pct = profit_split_pct;
        challenge.created_at = Clock::get()?.unix_timestamp;
        challenge.expires_at = expires_at;
        challenge.nonce = nonce;

        // Transfer entry fee: trader → vault
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.trader_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.trader.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, entry_fee)?;

        Ok(())
    }

    /// Admin marks a challenge as Failed (entry fee stays in vault).
    pub fn fail_challenge(ctx: Context<AdminChallenge>) -> Result<()> {
        require!(
            ctx.accounts.state.admin == ctx.accounts.admin.key(),
            EscrowError::Unauthorized
        );
        let challenge = &mut ctx.accounts.challenge;
        require!(
            challenge.status == ChallengeStatus::Active,
            EscrowError::ChallengeNotActive
        );
        challenge.status = ChallengeStatus::Failed;
        Ok(())
    }

    /// Admin marks a challenge as Passed and pays out the trader's profit
    /// share from TradingCapital (80 % of total_profit by default).
    pub fn pass_challenge(ctx: Context<PassChallenge>, total_profit: u64) -> Result<()> {
        require!(
            ctx.accounts.state.admin == ctx.accounts.admin.key(),
            EscrowError::Unauthorized
        );
        let challenge = &mut ctx.accounts.challenge;
        require!(
            challenge.status == ChallengeStatus::Active,
            EscrowError::ChallengeNotActive
        );
        challenge.status = ChallengeStatus::Passed;

        let trader_payout = total_profit
            .checked_mul(PROFIT_SPLIT_BPS)
            .unwrap()
            .checked_div(BPS_DENOMINATOR)
            .unwrap();

        if trader_payout > 0 {
            let state_key = ctx.accounts.state.key();
            let seeds: &[&[u8]] = &[
                b"trading_capital",
                state_key.as_ref(),
                &[ctx.accounts.state.trading_capital_bump],
            ];
            let signer = &[seeds];

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.trading_capital.to_account_info(),
                    to: ctx.accounts.trader_token_account.to_account_info(),
                    authority: ctx.accounts.trading_capital.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi_ctx, trader_payout)?;
        }

        Ok(())
    }

    /// Trader voluntarily withdraws (forfeits entry fee, marks as Failed).
    pub fn withdraw_challenge(ctx: Context<WithdrawChallenge>) -> Result<()> {
        let challenge = &mut ctx.accounts.challenge;
        require!(
            challenge.status == ChallengeStatus::Active,
            EscrowError::ChallengeNotActive
        );
        require!(
            challenge.trader == ctx.accounts.trader.key(),
            EscrowError::Unauthorized
        );
        challenge.status = ChallengeStatus::Failed;
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// State accounts
// ─────────────────────────────────────────────────────────────────────────────
#[account]
pub struct ProgramState {
    pub admin: Pubkey,
    pub vault_bump: u8,
    pub trading_capital_bump: u8,
    pub challenge_count: u64,
}

impl ProgramState {
    pub const LEN: usize = 8 + 32 + 1 + 1 + 8;
}

#[account]
pub struct Challenge {
    pub trader: Pubkey,
    pub entry_fee: u64,
    pub tier: u8,
    pub status: ChallengeStatus,
    pub profit_target_pct: u8,
    pub profit_split_pct: u8,
    pub created_at: i64,
    pub expires_at: i64,
    pub nonce: u64,
}

impl Challenge {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 1 + 1 + 1 + 8 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ChallengeStatus {
    Active,
    Passed,
    Failed,
}

// ─────────────────────────────────────────────────────────────────────────────
// Instruction contexts
// ─────────────────────────────────────────────────────────────────────────────
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = ProgramState::LEN,
        seeds = [b"state", admin.key().as_ref()],
        bump,
    )]
    pub state: Account<'info, ProgramState>,

    /// USDC mint (or any SPL token mint used for entry fees)
    pub mint: Account<'info, Mint>,

    /// Vault token account -- holds entry fees
    #[account(
        init,
        payer = admin,
        token::mint = mint,
        token::authority = vault,
        seeds = [b"vault", state.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// TradingCapital token account -- source of profit payouts
    #[account(
        init,
        payer = admin,
        token::mint = mint,
        token::authority = trading_capital,
        seeds = [b"trading_capital", state.key().as_ref()],
        bump,
    )]
    pub trading_capital: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(entry_fee: u64, tier: u8, profit_target_pct: u8, profit_split_pct: u8, expires_at: i64)]
pub struct EnterChallenge<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,

    #[account(
        mut,
        seeds = [b"state", state.admin.as_ref()],
        bump,
    )]
    pub state: Account<'info, ProgramState>,

    #[account(
        init,
        payer = trader,
        space = Challenge::LEN,
        seeds = [b"challenge", state.key().as_ref(), &(state.challenge_count + 1).to_le_bytes()],
        bump,
    )]
    pub challenge: Account<'info, Challenge>,

    /// Trader's token account (source of entry fee)
    #[account(
        mut,
        token::mint = mint,
        token::authority = trader,
    )]
    pub trader_token_account: Account<'info, TokenAccount>,

    /// Vault receives the entry fee
    #[account(
        mut,
        seeds = [b"vault", state.key().as_ref()],
        bump = state.vault_bump,
        token::mint = mint,
        token::authority = vault,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AdminChallenge<'info> {
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"state", state.admin.as_ref()],
        bump,
    )]
    pub state: Account<'info, ProgramState>,

    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
}

#[derive(Accounts)]
pub struct PassChallenge<'info> {
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"state", state.admin.as_ref()],
        bump,
    )]
    pub state: Account<'info, ProgramState>,

    #[account(mut)]
    pub challenge: Account<'info, Challenge>,

    /// TradingCapital PDA -- sends profit to trader
    #[account(
        mut,
        seeds = [b"trading_capital", state.key().as_ref()],
        bump = state.trading_capital_bump,
    )]
    pub trading_capital: Account<'info, TokenAccount>,

    /// Trader's token account receives the profit share
    #[account(mut)]
    pub trader_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawChallenge<'info> {
    pub trader: Signer<'info>,

    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────
#[error_code]
pub enum EscrowError {
    #[msg("Challenge is not in Active status")]
    ChallengeNotActive,
    #[msg("Caller is not authorized to perform this action")]
    Unauthorized,
}
