import { KeyPair } from "@near-js/crypto";
import { InMemoryKeyStore } from "@near-js/keystores";
import { actionCreators } from "@near-js/transactions";
import BN from "bn.js";
import Big from "big.js";
import {
  connect,
  submitTransaction
} from "@/helper/utils/near/meta-transactions";
import type { NextApiRequest, NextApiResponse } from 'next'



//near call <ft-contract> ft_transfer '{"receiver_id": "<receiver-account>", "amount": "<amount>"}' --accountId <your-account> --depositYocto 1
//https://near-examples.github.io/token-factory/
//https://near-faucet.io/
export default async function Handler(req: NextApiRequest,res: NextApiResponse) {
  //const body = await req.json();

  //const { privateKey, accountId ,receiverId , amount , tokenContract} = body;

  const accountId = "huunhan.testnet";
  const keyStore = new InMemoryKeyStore();
  const receiverId = "trialaccount.testnet"

  // Near.call(
  //   firsTokenAddress,
  //   "ft_transfer_call",
  //   {
  //     receiver_id: MANAGER_CONTRACT_ID,
  //     amount: Big(state.firstSelectedToken.amount).mul(1e24).toFixed(),
  //     msg: JSON.stringify({
  //       swap_single: {
  //         token_out: secondTokenAddress,
  //         fee: 3000,
  //       },
  //     }),
  //   },
  //   300000000000000,
  //   1
  // );


  await keyStore.setKey(process.env.NEXT_PUBLIC_NETWORK_ID as string, accountId, KeyPair.fromString(process.env.RELAYER_PRIVATE_KEY_NEAR_TESTNET as string));
  const signerAccount = await connect(accountId, keyStore, process.env.NEXT_PUBLIC_NETWORK_ID as string);
  const gas = "200000000000000";
  const deposit = 1;
  const args : any = {
    receiver_id: receiverId,
    amount: new Big(0.5),
    msg: JSON.stringify({
      swap_single:{
        token_out:'',
        fee: 2000,
      }
    })
  }
const action = actionCreators.functionCall(
  "ft_transfer_call",
  args,
  new BN(gas),
  new BN(deposit)
);

  const deserializeDelegate = await signerAccount.signedDelegate({
    actions: [action],
    blockHeightTtl: 600,
    receiverId: 'ref-finance-101.testnet',
  });
  

  try {
    const result = await submitTransaction({
      delegate: deserializeDelegate,
      network:  process.env.NEXT_PUBLIC_NETWORK_ID as string,
    });
    res.status(200).json(
        { 
        status: "successful" ,
        result
        }
    );
  } catch (error) {
    res.status(500).json(
      { error },
    );
  }
}