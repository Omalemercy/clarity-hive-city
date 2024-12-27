import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types
} from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Land parcel minting - owner only",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;

        let block = chain.mineBlock([
            Tx.contractCall('hive-city', 'mint-land-parcel', [
                types.uint(1),
                types.uint(1),
                types.ascii("residential")
            ], deployer.address),
            
            // Should fail - not owner
            Tx.contractCall('hive-city', 'mint-land-parcel', [
                types.uint(2),
                types.uint(2),
                types.ascii("commercial")
            ], wallet1.address)
        ]);

        block.receipts[0].result.expectOk();
        block.receipts[1].result.expectErr(types.uint(100));
    }
});

Clarinet.test({
    name: "Land parcel transfer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;

        // First mint a parcel
        let mint = chain.mineBlock([
            Tx.contractCall('hive-city', 'mint-land-parcel', [
                types.uint(1),
                types.uint(1),
                types.ascii("residential")
            ], deployer.address)
        ]);

        let parcelId = mint.receipts[0].result.expectOk();

        // Then transfer it
        let transfer = chain.mineBlock([
            Tx.contractCall('hive-city', 'transfer-land-parcel', [
                parcelId,
                types.principal(wallet1.address)
            ], deployer.address)
        ]);

        transfer.receipts[0].result.expectOk();

        // Verify new owner
        let query = chain.mineBlock([
            Tx.contractCall('hive-city', 'get-land-parcel', [
                parcelId
            ], deployer.address)
        ]);

        let parcel = query.receipts[0].result.expectOk();
        assertEquals(parcel.owner, wallet1.address);
    }
});

Clarinet.test({
    name: "Proposal and voting flow",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;

        // Create proposal
        let proposal = chain.mineBlock([
            Tx.contractCall('hive-city', 'submit-zoning-proposal', [
                types.uint(1),
                types.ascii("commercial")
            ], wallet1.address)
        ]);

        let proposalId = proposal.receipts[0].result.expectOk();

        // Vote on proposal
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

        voting.receipts[0].result.expectOk();
        voting.receipts[1].result.expectOk();

        // Check proposal status
        let query = chain.mineBlock([
            Tx.contractCall('hive-city', 'get-proposal', [
                proposalId
            ], deployer.address)
        ]);

        let proposalState = query.receipts[0].result.expectOk();
        assertEquals(proposalState.votes_for, types.uint(1));
        assertEquals(proposalState.votes_against, types.uint(1));
    }
});