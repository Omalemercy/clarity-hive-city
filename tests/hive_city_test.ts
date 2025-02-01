import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types
} from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Staking functionality",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        // Stake tokens
        let block = chain.mineBlock([
            Tx.contractCall('hive-city', 'stake', [
                types.uint(200)
            ], wallet1.address)
        ]);

        block.receipts[0].result.expectOk();

        // Check staking position
        let query = chain.mineBlock([
            Tx.contractCall('hive-city', 'get-staking-position', [
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);

        let position = query.receipts[0].result.expectOk();
        assertEquals(position.amount, types.uint(200));
    }
});

Clarinet.test({
    name: "Voting power based on stake",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;

        // Setup stakes
        let setup = chain.mineBlock([
            Tx.contractCall('hive-city', 'stake', [
                types.uint(200)
            ], wallet1.address),
            Tx.contractCall('hive-city', 'stake', [
                types.uint(300)
            ], wallet2.address)
        ]);

        // Create proposal
        let proposal = chain.mineBlock([
            Tx.contractCall('hive-city', 'submit-zoning-proposal', [
                types.uint(1),
                types.ascii("commercial")
            ], wallet1.address)
        ]);

        let proposalId = proposal.receipts[0].result.expectOk();

        // Vote with different stake weights
        let voting = chain.mineBlock([
            Tx.contractCall('hive-city', 'vote-on-proposal', [
                proposalId,
                types.bool(true)
            ], wallet1.address),
            Tx.contractCall('hive-city', 'vote-on-proposal', [
                proposalId,
                types.bool(false)
            ], wallet2.address)
        ]);

        // Check weighted votes
        let query = chain.mineBlock([
            Tx.contractCall('hive-city', 'get-proposal', [
                proposalId
            ], wallet1.address)
        ]);

        let proposalState = query.receipts[0].result.expectOk();
        assertEquals(proposalState.votes_for, types.uint(200));
        assertEquals(proposalState.votes_against, types.uint(300));
    }
});
