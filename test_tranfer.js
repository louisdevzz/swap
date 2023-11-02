const nearAPI  = require('near-api-js');
const { connect, KeyPair, keyStores, utils ,transactions} = nearAPI;
const BN = require('bn.js')
//this is required if using a local .env file for private key
require('dotenv').config();

// configure accounts, network, and amount of NEAR to send
// converts NEAR amount into yoctoNEAR (10^-24) using a near-api-js utility
const ACCOUNT_ID = 'trialaccount.testnet';
const networkId = 'testnet';
const REF_FI_CONTRACT_ID = 'ref-finance-101.testnet';

const amount = nearAPI.utils.format.parseNearAmount('1');
  


async function handler() {
  // sets up an empty keyStore object in memory using near-api-js
  const keyStore = new keyStores.InMemoryKeyStore();
  // creates a keyPair from the private key provided in your .env file
  const keyPair = KeyPair.fromString(process.env.RELAYER_PRIVATE_KEY_NEAR_TESTNET);
  // adds the key you just created to your keyStore which can hold multiple keys
  await keyStore.setKey(networkId, ACCOUNT_ID, keyPair);

  // configuration used to connect to NEAR
  const config = {
    networkId,
    keyStore,
    nodeUrl: `https://rpc.${networkId}.near.org`,
    walletUrl: `https://wallet.${networkId}.near.org`,
    helperUrl: `https://helper.${networkId}.near.org`,
    explorerUrl: `https://explorer.${networkId}.near.org`
  };

  // connect to NEAR! :) 
  //0.130540 usdt = 0.1 near
  //token_account_ids: [ 'usdc.fakes.testnet', 'usdt.fakes.testnet' ],
  //0.0002826
  const near = await connect(config);
  const deposit = 1
  const actionList = [
    {
        pool_id: 6,
        token_in: 'wrap.testnet',
        token_out: "nusdc.ft-fin.testnet",
        amount_in: "10000000000000000000000",
        min_amount_out: "0",
    },
    {
        pool_id: 14,
        token_in: 'usdc.fakes.testnet',
        token_out: "usdt.fakes.testnet",
        min_amount_out: '0.130853',
    },
  ]
  const args={
    receiver_id: 'ref-finance-101.testnet',
    amount: amount,
    msg: JSON.stringify({
      force: 0,
      actions: actionList,
    }),
  }
  const senderAccount = await near.account(ACCOUNT_ID);
  const action = transactions.functionCall(
    "ft_transfer_call",
    args,
    new BN("200000000000000"),
    deposit
  )

  try {
    // const result = await senderAccount.sendMoney(receiver, amount);
    const result = await senderAccount.signAndSendTransaction({
      receiverId:'wrap.testnet',
      actions:[
        action
      ]
    })
    console.log(result)
  } catch(error) {
    // return an error if unsuccessful
    console.log(error);
  }
}
handler()


