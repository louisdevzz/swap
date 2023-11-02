import { KeyPair } from "@near-js/crypto";
import { InMemoryKeyStore } from "@near-js/keystores";
import { actionCreators } from "@near-js/transactions";
import BN from "bn.js";
import {
  connect,
  submitTransaction
} from "@/helper/utils/near/meta-transactions";
import type { NextApiRequest, NextApiResponse } from 'next'
import Big from "big.js";


//near call <ft-contract> ft_transfer '{"receiver_id": "<receiver-account>", "amount": "<amount>"}' --accountId <your-account> --depositYocto 1
//https://near-examples.github.io/token-factory/
//https://near-faucet.io/
export default async function GET(req: NextApiRequest,res: NextApiResponse) {
//   const body = await req.json();

  //const { privateKey, accountId ,receiverId , amount , tokenContract} = body;

    const accountId = "huunhan.testnet";
    const keyStore = new InMemoryKeyStore();

    await keyStore.setKey(process.env.NEXT_PUBLIC_NETWORK_ID as string, accountId, KeyPair.fromString(process.env.RELAYER_PRIVATE_KEY_NEAR_TESTNET as string));
    const signerAccount = await connect(accountId, keyStore, process.env.NEXT_PUBLIC_NETWORK_ID as string);
    const gas = "200000000000000";
    const deposit = "100000000000000000000000";
    const args = {
        registration_only: true,
        account_id: accountId,
    }
    const action = actionCreators.functionCall(
    "storage_deposit",
    args,
    new BN(gas),
    new BN(deposit),
    );

    const deserializeDelegate = await signerAccount.signedDelegate({
        actions: [action],
        blockHeightTtl: 600,
        receiverId: 'wrap.testnet',
    });
    

    try {
        const result = await submitTransaction({
        delegate: deserializeDelegate,
        network:  process.env.NEXT_PUBLIC_NETWORK_ID as string,
        });
        res.status(200).json({ result })
    } catch (error) {
        res.status(500).json({ error})
    }
}