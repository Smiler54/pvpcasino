// Test script to simulate a complete coinflip game
// This demonstrates how the coinflip game flows from offer creation to completion

import { supabase } from './src/integrations/supabase/client';

async function simulateCoinflipGame() {
  console.log("🎯 Starting Coinflip Game Simulation...\n");

  try {
    // Step 1: Check current offers
    console.log("1️⃣ Checking current game offers...");
    const { data: offers, error: offersError } = await supabase
      .from('game_offers')
      .select('*')
      .eq('status', 'open');

    if (offersError) throw offersError;
    
    if (offers && offers.length > 0) {
      const currentOffer = offers[0];
      console.log(`   Found offer: ${currentOffer.maker_name} betting $${currentOffer.amount} on ${currentOffer.side}`);
      
      // Step 2: Simulate joining the offer
      console.log("\n2️⃣ Simulating joining the offer...");
      
      // Generate client seed for provably fair
      const clientSeed = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      console.log(`   Client seed generated: ${clientSeed}`);
      console.log(`   Joining as: tails (opposite of ${currentOffer.side})`);
      
      // Step 3: Create the match (simulate the join process)
      console.log("\n3️⃣ Creating match...");
      
      // Update offer to matched status
      const { error: updateOfferError } = await supabase
        .from('game_offers')
        .update({ status: 'matched' })
        .eq('id', currentOffer.id);
      
      if (updateOfferError) throw updateOfferError;
      
      // Create the match record
      const { data: match, error: matchError } = await supabase
        .from('game_matches')
        .insert({
          offer_id: currentOffer.id,
          maker_id: currentOffer.user_id,
          taker_id: 'f2c3b499-c5b0-47ee-8023-e5fc5ec220c4', // Test user
          maker_name: currentOffer.maker_name,
          taker_name: 'TestTaker',
          amount: currentOffer.amount,
          client_seed: clientSeed,
          status: 'active'
        })
        .select()
        .single();
      
      if (matchError) throw matchError;
      
      console.log(`   Match created: ID ${match.id}`);
      
      // Step 4: Complete the match using our edge function
      console.log("\n4️⃣ Completing the match...");
      
      const { data: result, error: completeError } = await supabase.functions.invoke(
        'complete-coinflip-match',
        {
          body: { matchId: match.id }
        }
      );
      
      if (completeError) throw completeError;
      
      console.log(`   🎲 Result: ${result.resultSide}`);
      console.log(`   🏆 Winner: ${result.winnerName} (${result.winnerId})`);
      console.log(`   💰 Prize: $${result.winAmount}`);
      
      // Step 5: Verify the provably fair result
      console.log("\n5️⃣ Provably Fair Verification:");
      console.log(`   Client Seed: ${result.clientSeed}`);
      console.log(`   Server Seed: ${result.serverSeed}`);
      console.log(`   Salt: ${result.salt}`);
      console.log(`   Result: ${result.resultSide}`);
      
      // Step 6: Check final balances
      console.log("\n6️⃣ Checking final balances...");
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, balance')
        .in('user_id', [currentOffer.user_id, 'f2c3b499-c5b0-47ee-8023-e5fc5ec220c4']);
      
      if (profilesError) throw profilesError;
      
      profiles?.forEach(profile => {
        console.log(`   ${profile.username}: $${profile.balance}`);
      });
      
      console.log("\n✅ Coinflip game simulation completed successfully!");
      
    } else {
      console.log("   No open offers found. Creating a test offer first...");
      
      // Create a test offer
      const { data: newOffer, error: createError } = await supabase
        .from('game_offers')
        .insert({
          user_id: '3d4ef21b-8e70-4d55-8798-cc0c71b902cc',
          maker_name: 'TestMaker',
          amount: 5,
          side: 'heads',
          status: 'open'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      console.log(`   Created test offer: $5 on heads`);
      console.log("   🔄 Please run the simulation again to complete the game");
    }
    
  } catch (error) {
    console.error("❌ Simulation failed:", error);
  }
}

// This is a demonstration script - in the actual app, 
// games are completed automatically when players join
console.log("This demonstrates the complete coinflip game flow:");
console.log("1. Player creates offer (bet amount + side)");