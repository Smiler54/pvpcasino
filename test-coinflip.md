# Coinflip Game Test

Let me test the coinflip functionality by simulating a complete game flow:

## Current State
- **Active Offer**: Ddenbror betting $10 on heads (ID: de26ed11-6ae1-4b88-a20c-4c1dc29d5ef1)
- **Available Users**: 3 profiles with different balances
- **Game Tables**: game_offers, game_matches exist

## Test Flow
1. Join the existing offer as tails
2. Observe match creation and completion
3. Check provably fair verification
4. Monitor balance updates

## Expected Behavior
- Match gets created in game_matches table
- Random result determines winner (heads or tails)
- Winner gets 2x the bet amount
- Loser loses their bet amount
- Provably fair verification data recorded

Let me execute this test...