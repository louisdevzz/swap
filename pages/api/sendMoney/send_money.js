const nearAPI  = require('near-api-js');
const { connect, KeyPair, keyStores, utils ,transactions} = nearAPI;
const BN = require('bn.js')
//this is required if using a local .env file for private key
require('dotenv').config();

// configure accounts, network, and amount of NEAR to send
// converts NEAR amount into yoctoNEAR (10^-24) using a near-api-js utility
const sender = 'trialaccount.testnet';
const networkId = 'testnet';

export default async function handler(req, res) {
  // sets up an empty keyStore object in memory using near-api-js
  const keyStore = new keyStores.InMemoryKeyStore();
  // creates a keyPair from the private key provided in your .env file
  const keyPair = KeyPair.fromString(process.env.RELAYER_PRIVATE_KEY_NEAR_TESTNET);
  // adds the key you just created to your keyStore which can hold multiple keys
  await keyStore.setKey(networkId, sender, keyPair);

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
  const near = await connect(config);
  // create a NEAR account object
  const args={
    registration_only: true,
    account_id: sender,
  }
  const senderAccount = await near.account(sender);
  const action = transactions.functionCall(
    "storage_deposit",
    args,
    new BN("200000000000000"),
    new BN("100000000000000000000000")
  )

  try {
    // const result = await senderAccount.sendMoney(receiver, amount);
    const result = await senderAccount.signAndSendTransaction({
      receiverId:'wrap.testnet',
      actions:[
        action
      ]
    })
    res.status(200).json({result})
  } catch(error) {
    // return an error if unsuccessful
    console.log(error);
    res.status(500).json({error})
  }
}
