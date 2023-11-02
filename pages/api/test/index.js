const nearAPI  = require('near-api-js');
const { connect, KeyPair, keyStores,Contract,utils,transactions} = nearAPI;
const BN = require('bn.js');
import axios from "axios";
const math=require("mathjs");
import {getConfig,getExtraStablePoolConfig} from '../../../helper/utils/near/config';
// const {
//   getExtraStablePoolConfig,getConfig
// } =require("./helper/utils/near/config");
const config = getConfig();



//this is required if using a local .env file for private key
require('dotenv').config();

// configure accounts, network, and amount of NEAR to send
// converts NEAR amount into yoctoNEAR (10^-24) using a near-api-js utility
const ACCOUNT_ID = 'trialaccount.testnet';
const networkId = 'testnet';
const REF_FI_CONTRACT_ID = 'ref-finance-101.testnet';
const STORAGE_TO_REGISTER_WITH_MFT = "0.1";
const ONE_YOCTO_NEAR = "0.000000000000000000000001";
const WRAP_NEAR_CONTRACT_ID = 'wrap.testnet'
const DEFAULT_PAGE_LIMIT = 100;


const BLACKLIST_POOL_IDS = config.BLACKLIST_POOL_IDS;
const STABLE_TOKEN_INDEX = config.STABLE_TOKEN_INDEX;
const STABLE_TOKEN_USN_INDEX = config.STABLE_TOKEN_USN_INDEX;
const {
  BTCIDS,
  CUSDIDS,
  BTC_STABLE_POOL_ID,
  CUSD_STABLE_POOL_ID,
  STNEAR_POOL_ID,
  STNEARIDS,
  BTC_STABLE_POOL_INDEX,
  CUSD_STABLE_POOL_INDEX,
  STNEAR_POOL_INDEX,
  LINEARIDS,
  LINEAR_POOL_INDEX,
  LINEAR_POOL_ID,
  NEAX_POOL_ID,
  NEAX_POOL_INDEX,
  NEARXIDS,
} = getExtraStablePoolConfig();
const {
  STABLE_POOL_USN_ID,
  STABLE_TOKEN_IDS,
  STABLE_POOL_ID,
  STABLE_TOKEN_USN_IDS,
} = require("../../../helper/utils/near/utils");

export default async function handler(req,res) {
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
    const PoolMode = {
      PARALLEL:"parallel swap",
      SMART:"smart routing",
      SMART_V2:"stableSmart",
      STABLE:"stable swap",
      
    }
    const SWAP_MODE ={
      NORMAL : "normal",
      STABLE : "stable",
    }
    const ONLY_ZEROS = /^0*\.?0*$/;
    const ALL_STABLE_POOL_IDS = [
      STABLE_POOL_ID,
      STABLE_POOL_USN_ID,
      BTC_STABLE_POOL_ID,
      STNEAR_POOL_ID,
      CUSD_STABLE_POOL_ID,
      LINEAR_POOL_ID,
      NEAX_POOL_ID,
    ]
    const isStableToken = (id) => {
      return (
        STABLE_TOKEN_IDS.includes(id) ||
        STABLE_TOKEN_USN_IDS.includes(id) ||
        BTCIDS.includes(id) ||
        STNEARIDS.includes(id) ||
        CUSDIDS.includes(id) ||
        LINEARIDS.includes(id) ||
        NEARXIDS.includes(id)
      );
    };
    const near = await connect(config);
    const refFiViewFunction = async ({
        methodName,
        args,
      }) => {
        try {
            console.log(args)
            const account = await near.account(ACCOUNT_ID);
            // args:{"account_id":ACCOUNT_ID}
            let data = await account.viewFunction({
                contractId:REF_FI_CONTRACT_ID,
                methodName:methodName,
                args:args
            });
            return data;
        } catch (error) {
            console.log("er", error);
        }
      };
      const ftViewFunction = async (tokenId,{
        methodName,
        args,
      }) => {
        try {
            console.log(args);
            console.log(tokenId)
            const account = await near.account(ACCOUNT_ID);
            // args:{"account_id":ACCOUNT_ID}
            let data = await account.viewFunction({
                contractId:tokenId,
                methodName:methodName,
                args:args
            });
            console.log(data);
        } catch (error) {
            console.log("er", error);
        }
      };
      const ftGetStorageBalance = (
        tokenId
      ) => {
        console.log(ftViewFunction(
            tokenId,
            {methodName:'storage_balance_of',
            args:{"account_id":ACCOUNT_ID}
        }))
      };
      const transactions = [];
      const tokenOutActions = [];
      const registerToken = async (token) => {
        const tokenRegistered = await ftGetStorageBalance(token.id).catch(() => {
          throw new Error(`${token.id} doesn't exist.`);
        });
        if (tokenRegistered === null) {
          tokenOutActions.push({
            methodName: "storage_deposit",
            args: {
              registration_only: true,
              account_id: ACCOUNT_ID,
            },
            gas: "30000000000000",
            amount: STORAGE_TO_REGISTER_WITH_MFT,
          });
    
          transactions.push({
            receiverId: token.id,
            functionCalls: tokenOutActions,
          });
        }
      };
      registerToken()
      console.log(transactions)
      
       //console.log(ftGetStorageBalance('wrap.testnet'))

       //console.log(ftViewFunction('wrap.testnet',{methodName:'storage_balance_of',args:{"account_id":ACCOUNT_ID}}))
    const getGlobalTokens = async () => {
        const tokensIds = await refFiViewFunction({
          methodName: "get_whitelisted_tokens",
          args:{"account_id":ACCOUNT_ID}
        });
        const account = await near.account(ACCOUNT_ID);
      
        let tokensInfo = [];
      
        await Promise.all(
          tokensIds.map(async tk => {
            let data = await getTokensMetaData(tk, account);
            if (!data){
                throw new Error(`${data.id} doesn't exist.`);
            }else{
                tokensInfo.push(data);
            }
            
            //console.log(data)
          })
        );
        return tokensInfo
    };
    //console.log(getGlobalTokens())
    const getTokensMetaData = async (token, account,mode = "") => {
        let tokenInfo = await account.viewFunction({contractId:token, methodName:"ft_metadata"});
        let obj = {
          id: token,
          name: tokenInfo.name,
          symbol: tokenInfo.symbol,
      
          contractName: token,
          decimals: tokenInfo.decimals,
          onRef: true,
          onTri: true,
        };
        if (mode === "user_holdings") {
          if (token === 'wrap.testnet') {
            getAccountNearBalance(ACCOUNT_ID).then(
              ({ available }) =>
                (obj.balance = Number(available) / 10 ** tokenInfo.decimals)
            );
          } else {
            // token, "ft_balance_of", {account_id: ACCOUNT_ID,}
            let balance = await account.viewFunction({
                contractId:token,
                methodName:"ft_balance_of",
                args:{"account_id": ACCOUNT_ID}
            });
            obj.balance = balance / 10 ** tokenInfo.decimals;
          }
        }
      
        return obj;
    };
    //console.log(getUserTokens())
    const getUserTokens = async () => {
        try {
          const { data: tokensIds } = await axios.get(
            `https://testnet-api.kitwallet.app/account/${ACCOUNT_ID}/likelyTokens`
          );
          // const tokensIds: string[] = await refFiViewFunction({
          //   methodName: "get_user_whitelisted_tokens",
          //   args: { account_id: ACCOUNT_ID },
          // });
      
          const account = await near.account(ACCOUNT_ID);
      
          let tokensInfo = [];
      
          let unSupportedTokens = ["ref-finance-101.testnet"];
      
          let filtered = tokensIds.filter(
            (tk) => !unSupportedTokens.includes(tk)
          );
          console.log("filtered", filtered);
      
          filtered.length > 0 &&
            (await Promise.all(
              filtered.map(async (tk) => {
                let data = await getTokensMetaData(tk, account, "user_holdings");
                tokensInfo.push(data);
              })
            ));
      
          console.log("tokensInfo", tokensInfo);
      
          return tokensInfo.filter((tk) => tk.balance != 0);
        } catch (error) {
          console.log("ee====", error);
        }
    };
    const convertToPercentDecimal = (percent) => {
        return math.divide(percent, 100);
    };
      
    const percentOf = (percent, num) => {
        return math.evaluate(`${convertToPercentDecimal(percent)} * ${num}`);
    };
      
    const percentLess = (percent, num) => {
        return math.format(math.evaluate(`${num} - ${percentOf(percent, num)}`), {
          notation: "fixed",
        });
    };
    const toReadableNumber = (
        decimals,
        number= "0"
    ) => {
        if (!decimals) return number;
      
        const wholeStr = number.substring(0, number.length - decimals) || "0";
        const fractionStr = number
          .substring(number.length - decimals)
          .padStart(decimals, "0")
          .substring(0, decimals);
      
        return `${wholeStr}.${fractionStr}`.replace(/\.?0+$/, "");
    };
    function scientificNotationToString(strParam) {
        let flag = /e/.test(strParam);
        if (!flag) return strParam;
      
        let sysbol = true;
        if (/e-/.test(strParam)) {
          sysbol = false;
        }
      
        const negative = Number(strParam) < 0 ? "-" : "";
        let index = Number(strParam.match(/\d+$/)[0]);
        let basis = strParam.match(/[\d\.]+/)[0];
      
        const ifFraction = basis.includes(".");
      
        let wholeStr;
        let fractionStr;
      
        if (ifFraction) {
          wholeStr = basis.split(".")[0];
          fractionStr = basis.split(".")[1];
        } else {
          wholeStr = basis;
          fractionStr = "";
        }
      
        if (sysbol) {
          if (!ifFraction) {
            return negative + wholeStr.padEnd(index + wholeStr.length, "0");
          } else {
            if (fractionStr.length <= index) {
              return negative + wholeStr + fractionStr.padEnd(index, "0");
            } else {
              return (
                negative +
                wholeStr +
                fractionStr.substring(0, index) +
                "." +
                fractionStr.substring(index)
              );
            }
          }
        } else {
          if (!ifFraction)
            return (
              negative +
              wholeStr.padStart(index + wholeStr.length, "0").replace(/^0/, "0.")
            );
          else {
            return (
              negative +
              wholeStr.padStart(index + wholeStr.length, "0").replace(/^0/, "0.") +
              fractionStr
            );
          }
        }
    };
    const round = (decimals, minAmountOut) => {
        return Number.isInteger(Number(minAmountOut))
          ? minAmountOut
          : Math.ceil(
              Math.round(Number(minAmountOut) * Math.pow(10, decimals)) /
                Math.pow(10, decimals)
            ).toString();
    };
    const toNonDivisibleNumber = (
        decimals,
        number
      ) => {
        if (decimals === null || decimals === undefined) return number;
        const [wholePart, fracPart = ""] = number.split(".");
      
        return `${wholePart}${fracPart.padEnd(decimals, "0").slice(0, decimals)}`
          .replace(/^0+/, "")
          .padStart(1, "0");
    };
    const nearDepositTransaction = (amount) => {
        const transaction = {
          receiverId: WRAP_NEAR_CONTRACT_ID,
          functionCalls: [
            {
              methodName: "near_deposit",
              args: {},
              gas: "20000000000000",
              amount,
            },
          ],
        };
      
        return transaction;
    };
    function separateRoutes(
        actions,
        outputToken
    ) {
        const res = [];
        let curRoute = [];
      
        for (let i in actions) {
          curRoute.push(actions[i]);
          if (actions[i].outputToken === outputToken) {
            res.push(curRoute);
            curRoute = [];
          }
        }
      
        return res;
    };
    const getGas = (gas) => gas ? new BN(gas) : new BN("100000000000000");
    
    const instantSwap = async ({
        tokenIn,
        tokenOut,
        amountIn,
        swapsToDo,
        slippageTolerance,
      }) => {
        console.log("instantSwap");
        if (swapsToDo.every(todo => todo.pool.Dex !== "tri")) {
          console.log("IF========================");
          return nearInstantSwap({
            tokenIn,
            tokenOut,
            amountIn,
            swapsToDo,
            slippageTolerance,
          });
        } else {
          console.log("ELSE=========");
        }
    };
    
    const nearInstantSwap = async ({
        tokenIn,
        tokenOut,
        amountIn,
        swapsToDo,
        slippageTolerance,
      }) => {
        const transactions = [];
        const tokenInActions = [];
        const tokenOutActions = [];
      
        console.log("nearInstantSwap");
      
        const registerToken = async (token) => {
          const tokenRegistered = await ftGetStorageBalance(token.id).catch(() => {
            throw new Error(`${token.id} doesn't exist.`);
        });
      
          if (tokenRegistered === null) {
            tokenOutActions.push({
              methodName: "storage_deposit",
              args: {
                registration_only: true,
                account_id: ACCOUNT_ID,
              },
              gas: "30000000000000",
              amount: STORAGE_TO_REGISTER_WITH_MFT,
            });
      
            transactions.push({
              receiverId: token.id,
              functionCalls: tokenOutActions,
            });
          }
        };
      
        const isParallelSwap = swapsToDo.every(
          estimate => estimate.status === PoolMode.PARALLEL
        );
        const isSmartRouteV1Swap = swapsToDo.every(
          estimate => estimate.status === PoolMode.SMART
        );
      
        console.log("isParallelSwap", isParallelSwap, isSmartRouteV1Swap);
      
        if (isParallelSwap) {
          const swapActions = swapsToDo.map(s2d => {
            let minTokenOutAmount = s2d.estimate
              ? percentLess(slippageTolerance, s2d.estimate)
              : "0";
            let allocation = toReadableNumber(
              tokenIn.decimals,
              scientificNotationToString(s2d.pool.partialAmountIn)
            );
      
            return {
              pool_id: s2d.pool.id,
              token_in: tokenIn.id,
              token_out: tokenOut.id,
              amount_in: round(
                tokenIn.decimals,
                toNonDivisibleNumber(tokenIn.decimals, allocation)
              ),
              min_amount_out: round(
                tokenOut.decimals,
                toNonDivisibleNumber(tokenOut.decimals, minTokenOutAmount)
              ),
            };
          });
      
          await registerToken(tokenOut);
      
          tokenInActions.push({
            methodName: "ft_transfer_call",
            args: {
              receiver_id: REF_FI_CONTRACT_ID,
              amount: toNonDivisibleNumber(tokenIn.decimals, amountIn),
              msg: JSON.stringify({
                force: 0,
                actions: swapActions,
              }),
            },
            gas: "180000000000000",
            amount: ONE_YOCTO_NEAR,
            // deposit: '1',
          });
      
          transactions.push({
            receiverId: tokenIn.id,
            functionCalls: tokenInActions,
          });
        } else if (isSmartRouteV1Swap) {
          //making sure all actions get included for hybrid stable smart.
          await registerToken(tokenOut);
          var actionsList = [];
          // let allSwapsTokens = swapsToDo.map((s) => [s.inputToken, s.outputToken]); // to get the hop tokens
          let amountInInt = new Big(amountIn)
            .times(new Big(10).pow(tokenIn.decimals))
            .toString();
          let swap1 = swapsToDo[0];
          actionsList.push({
            pool_id: swap1.pool.id,
            token_in: swap1.inputToken,
            token_out: swap1.outputToken,
            amount_in: amountInInt,
            min_amount_out: "0",
          });
          let swap2 = swapsToDo[1];
          actionsList.push({
            pool_id: swap2.pool.id,
            token_in: swap2.inputToken,
            token_out: swap2.outputToken,
            min_amount_out: round(
              tokenOut.decimals,
              toNonDivisibleNumber(
                tokenOut.decimals,
                percentLess(slippageTolerance, swapsToDo[1].estimate)
              )
            ),
          });
      
          transactions.push({
            receiverId: tokenIn.id,
            functionCalls: [
              {
                methodName: "ft_transfer_call",
                args: {
                  receiver_id: REF_FI_CONTRACT_ID,
                  amount: toNonDivisibleNumber(tokenIn.decimals, amountIn),
                  msg: JSON.stringify({
                    force: 0,
                    actions: actionsList,
                  }),
                },
                gas: "180000000000000",
                amount: ONE_YOCTO_NEAR,
              },
            ],
          });
        } else {
          //making sure all actions get included.
          await registerToken(tokenOut);
          var actionsList = [];
          let allSwapsTokens = swapsToDo.map(s => [s.inputToken, s.outputToken]); // to get the hop tokens
          for (var i in allSwapsTokens) {
            let swapTokens = allSwapsTokens[i];
            if (swapTokens[0] == tokenIn.id && swapTokens[1] == tokenOut.id) {
              // parallel, direct hop route.
              actionsList.push({
                pool_id: swapsToDo[i].pool.id,
                token_in: tokenIn.id,
                token_out: tokenOut.id,
                amount_in: swapsToDo[i].pool.partialAmountIn,
                min_amount_out: round(
                  tokenOut.decimals,
                  toNonDivisibleNumber(
                    tokenOut.decimals,
                    percentLess(slippageTolerance, swapsToDo[i].estimate)
                  )
                ),
              });
            } else if (swapTokens[0] == tokenIn.id) {
              // first hop in double hop route
              //TODO -- put in a check to make sure this first hop matches with the next (i+1) hop as a second hop.
              actionsList.push({
                pool_id: swapsToDo[i].pool.id,
                token_in: swapTokens[0],
                token_out: swapTokens[1],
                amount_in: swapsToDo[i].pool.partialAmountIn,
                min_amount_out: "0",
              });
            } else {
              // second hop in double hop route.
              //TODO -- put in a check to make sure this second hop matches with the previous (i-1) hop as a first hop.
              actionsList.push({
                pool_id: swapsToDo[i].pool.id,
                token_in: swapTokens[0],
                token_out: swapTokens[1],
                min_amount_out: round(
                  tokenOut.decimals,
                  toNonDivisibleNumber(
                    tokenOut.decimals,
                    percentLess(slippageTolerance, swapsToDo[i].estimate)
                  )
                ),
              });
            }
          }
      
          transactions.push({
            receiverId: tokenIn.id,
            functionCalls: [
              {
                methodName: "ft_transfer_call",
                args: {
                  receiver_id: REF_FI_CONTRACT_ID,
                  amount: toNonDivisibleNumber(tokenIn.decimals, amountIn),
                  msg: JSON.stringify({
                    force: 0,
                    actions: actionsList,
                  }),
                },
                gas: "180000000000000",
                amount: ONE_YOCTO_NEAR,
              },
            ],
          });
        }
      
        if (tokenIn.id === WRAP_NEAR_CONTRACT_ID) {
          transactions.unshift(nearDepositTransaction(amountIn));
        }
        if (tokenOut.id === WRAP_NEAR_CONTRACT_ID) {
          let outEstimate = new Big(0);
          const routes = separateRoutes(swapsToDo, tokenOut.id);
      
          const bigEstimate = routes.reduce((acc, cur) => {
            const curEstimate = cur[cur.length - 1].estimate;
            return acc.plus(curEstimate);
          }, outEstimate);
      
          const minAmountOut = percentLess(
            slippageTolerance,
      
            scientificNotationToString(bigEstimate.toString())
          );
      
          // transactions.push(nearWithdrawTransaction(minAmountOut));
        }
      
        if (tokenIn.id === WRAP_NEAR_CONTRACT_ID) {
          const registered = await ftGetStorageBalance(WRAP_NEAR_CONTRACT_ID);
          if (registered === null) {
            transactions.unshift({
              receiverId: WRAP_NEAR_CONTRACT_ID,
              functionCalls: [registerAccountOnToken()],
            });
          }
        }
      
        return executeMultipleTransactions(transactions);
    };

    const executeMultipleTransactions = async (
        transactions,
        callbackUrl
      ) => {
        try {
          console.log("executeMultipleTransactions", transactions);
          const keyStore = new keyStores.InMemoryKeyStore();
          // creates a keyPair from the private key provided in your .env file
          const keyPair = KeyPair.fromString(PRIVATE_KEY);
        //   const keyPair = utils.key_pair.KeyPairEd25519.fromString(PRIVATE_KEY);
          await keyStore.setKey(networkId, ACCOUNT_ID, keyPair);
          const account = await near.account(ACCOUNT_ID);
      
          transactions.forEach(async transaction => {
            transaction.functionCalls.map(async fc => {
              try {
                await account.functionCall({
                  contractId: transaction.receiverId,
                  methodName: fc.methodName,
                  args: fc.args,
                  attachedDeposit: new BN(
                    utils.format.parseNearAmount(fc.amount || "0")
                  ),
                  gas: new BN(getGas(fc.gas).toNumber().toFixed()),
                });
              } catch (error) {
                console.log("err========", error);
              }
            });
          });
        } catch (error) {
          console.log("ERROR======", error);
        }
      };
      
    const nearWithdrawTransaction = (amount) => {
        const transaction = {
          receiverId: WRAP_NEAR_CONTRACT_ID,
          functionCalls: [
            {
              methodName: "near_withdraw",
              args: { amount: utils.format.parseNearAmount(amount) },
              amount: ONE_YOCTO_NEAR,
            },
          ],
        };
        return transaction;
      };
      
    const registerAccountOnToken = () => {
        return {
          methodName: "storage_deposit",
          args: {
            registration_only: true,
            account_id: ACCOUNT_ID,
          },
          gas: "30000000000000",
          amount: STORAGE_TO_REGISTER_WITH_MFT,
        };
      };
      
    const estimateSwap = async ({
        tokenIn,
        tokenOut,
        amountIn,
        swapMode,
        supportLedger,
        swapPro,
        setSwapsToDoRef,
        setSwapsToDoTri,
      })=> {
        const parsedAmountIn = toNonDivisibleNumber(tokenIn.decimals, amountIn);
        console.log("parsedAmountIn", parsedAmountIn);
      
        if (ONLY_ZEROS.test(parsedAmountIn)) throw new Error("Errr");
      
        const throwNoPoolError = () => {
          throw new Error("Error");
        };
      
        let pools = (
          await getPoolsByTokens({
            tokenInId: tokenIn.id,
            tokenOutId: tokenOut.id,
            amountIn: parsedAmountIn,
            crossSwap: swapPro,
          })
        ).filter(p => {
          return getLiquidity(p, tokenIn, tokenOut) > 0;
        });
      
        console.log("pools", pools);
      
        let { supportLedgerRes, triTodos, refTodos } = await getOneSwapActionResult(
          swapPro,
          pools,
          tokenIn,
          tokenOut,
          supportLedger,
          swapMode,
          throwNoPoolError,
          amountIn,
          parsedAmountIn
        );
        // ref smart routing
      
        if (supportLedger) {
          if (swapPro) {
            setSwapsToDoRef(refTodos);
            setSwapsToDoTri(triTodos);
          }
          return supportLedgerRes;
        }
      };
      const getTotalPools = async () => {
        return refFiViewFunction({
          methodName: "get_number_of_pools",
        });
      };
      
      const parsePool = (pool, id) => ({
        id: Number(id >= 0 ? id : pool.id),
        tokenIds: pool.token_account_ids,
        supplies: pool.amounts.reduce(
          (acc, amount, i) => {
            acc[pool.token_account_ids[i]] = amount;
            return acc;
          },
          {}
        ),
        fee: pool.total_fee,
        shareSupply: pool.shares_total_supply,
        tvl: pool.tvl,
        token0_ref_price: pool.token0_ref_price,
      });
      
      const getAllPools = async (
        page = 1,
        perPage = DEFAULT_PAGE_LIMIT
      ) => {
        const index = (page - 1) * perPage;
      
        const poolData= await refFiViewFunction({
          methodName: "get_pools",
          args: { from_index: index, limit: perPage },
        });
      
        return poolData.map((rawPool, i) => parsePool(rawPool, i + index));
      };
      
      const getPoolsByTokens = async ({
        tokenInId,
        tokenOutId,
        crossSwap,
      }) => {
        let filtered_pools;
      
        const totalPools = await getTotalPools();
        console.log("totalPools", totalPools, tokenInId, tokenOutId, crossSwap);
        const pages = Math.ceil(totalPools / DEFAULT_PAGE_LIMIT);
        const pools = (
          await Promise.all([...Array(pages)].map((_, i) => getAllPools(i + 1)))
        )
          .flat()
          .map(p => ({ ...p, Dex: "ref" }));
      
        let triPools;
      
        filtered_pools = pools
          .concat(triPools || [])
          .filter(isNotStablePool)
          .filter(filterBlackListPools);
      
        console.log("filtered_pools", filtered_pools);
      
        filtered_pools = filtered_pools.filter(
          p => p.supplies[tokenInId] && p.supplies[tokenOutId]
        );
        console.log(filtered_pools);
        await getAllStablePoolsFromCache();
      
        // @ts-ignore
        return filtered_pools.filter(p => crossSwap || !p.Dex || p.Dex !== "tri");
      };
      const getAllStablePoolsFromCache = async () => {
        const res = await Promise.all(
          ALL_STABLE_POOL_IDS.map(id => getStablePoolFromCache(id.toString()))
        );
      
        const allStablePoolsById = res.reduce((pre, cur, i) => {
          return {
            ...pre,
            [cur[0].id]: cur,
          };
        }, {}) 
        // as {
        //   [id: string]: [Pool, StablePool];
        // };
        const allStablePools = Object.values(allStablePoolsById).map(p => p[0]);
        const allStablePoolsInfo = Object.values(allStablePoolsById).map(p => p[1]);
      
        return {
          allStablePoolsById,
          allStablePools,
          allStablePoolsInfo,
        };
      };
      const getLiquidity = (
        pool,
        tokenIn,
        tokenOut
      ) => {
        const amount1 = toReadableNumber(tokenIn.decimals, pool.supplies[tokenIn.id]);
        const amount2 = toReadableNumber(
          tokenOut.decimals,
          pool.supplies[tokenOut.id]
        );
      
        const lp = new Big(amount1).times(new Big(amount2));
      
        return Number(lp);
      };
      const getStablePoolThisPair = ({
        tokenInId,
        tokenOutId,
        stablePools,
      }) => {
        return stablePools.filter(
          p =>
            p.tokenIds.includes(tokenInId) &&
            p.tokenIds.includes(tokenOutId) &&
            tokenInId !== tokenOutId
        );
      };
      const getStablePoolDecimal = (id) => {
        if (isRatedPool(id)) return RATED_POOL_LP_TOKEN_DECIMALS;
        else if (isStablePool(id)) return STABLE_LP_TOKEN_DECIMALS;
      };

      const getStableTokenIndex = (stable_pool_id) => {
        const id = stable_pool_id.toString();
        switch (id) {
          case STABLE_POOL_ID.toString():
            return STABLE_TOKEN_INDEX;
          case STABLE_POOL_USN_ID.toString():
            return STABLE_TOKEN_USN_INDEX;
          case BTC_STABLE_POOL_ID:
            return BTC_STABLE_POOL_INDEX;
          case STNEAR_POOL_ID:
            return STNEAR_POOL_INDEX;
          case CUSD_STABLE_POOL_ID:
            return CUSD_STABLE_POOL_INDEX;
          case LINEAR_POOL_ID:
            return LINEAR_POOL_INDEX;
          case NEAX_POOL_ID:
            return NEAX_POOL_INDEX;
        }
      };

      const getSwappedAmount = (
        tokenInId,
        tokenOutId,
        amountIn,
        stablePool
      ) => {
        const amp = stablePool.amp;
        const trade_fee = stablePool.total_fee;
      
        const STABLE_TOKEN_INDEX = getStableTokenIndex(stablePool.id);
        // @ts-ignore: Object is possibly 'null'.
        const in_token_idx = STABLE_TOKEN_INDEX[tokenInId];
        // @ts-ignore: Object is possibly 'null'.
        const out_token_idx = STABLE_TOKEN_INDEX[tokenOutId];
      
        const STABLE_LP_TOKEN_DECIMALS = getStablePoolDecimal(stablePool.id);
      
        const rates = stablePool.rates.map(r =>
          toReadableNumber(STABLE_LP_TOKEN_DECIMALS, r)
        );
      
        const base_old_c_amounts = stablePool.c_amounts.map(amount =>
          toReadableNumber(STABLE_LP_TOKEN_DECIMALS, amount)
        );
      
        const old_c_amounts = base_old_c_amounts
          .map((amount, i) =>
            toNonDivisibleNumber(
              STABLE_LP_TOKEN_DECIMALS,
              scientificNotationToString(
                new Big(amount || 0).times(new Big(rates[i])).toString()
              )
            )
          )
          .map(amount => Number(amount));
      
        const in_c_amount = Number(
          toNonDivisibleNumber(
            STABLE_LP_TOKEN_DECIMALS,
            scientificNotationToString(
              new Big(amountIn).times(new Big(rates[in_token_idx])).toString()
            )
          )
        );
      
        // const in_c_amount = Number(
        //   toNonDivisibleNumber(STABLE_LP_TOKEN_DECIMALS, amountIn)
        // );
      
        const [amount_swapped, fee, dy] = calc_swap(
          amp,
          in_token_idx,
          in_c_amount,
          out_token_idx,
          old_c_amounts,
          trade_fee
        );
      
        // TODO:
        return [
          amount_swapped / Number(rates[out_token_idx]),
          fee,
          dy / Number(rates[out_token_idx]),
        ];
      
        // return [amount_swapped, fee, dy];
      };

      const getStablePoolEstimate = ({
        tokenIn,
        tokenOut,
        amountIn,
        stablePoolInfo,
        stablePool,
      }) => {
        const STABLE_LP_TOKEN_DECIMALS = getStablePoolDecimal(stablePool.id);
      
        const [amount_swapped, fee, dy] = getSwappedAmount(
          tokenIn.id,
          tokenOut.id,
          amountIn,
          stablePoolInfo
        );
      
        const amountOut =
          amount_swapped < 0
            ? "0"
            : toPrecision(scientificNotationToString(amount_swapped.toString()), 0);
      
        const dyOut =
          amount_swapped < 0
            ? "0"
            : toPrecision(scientificNotationToString(dy.toString()), 0);
      
        return {
          estimate: toReadableNumber(STABLE_LP_TOKEN_DECIMALS, amountOut),
          noFeeAmountOut: toReadableNumber(STABLE_LP_TOKEN_DECIMALS, dyOut),
          pool: { ...stablePool, Dex: "ref" },
          token: tokenIn,
          outputToken: tokenOut.id,
          inputToken: tokenIn.id,
        };
      };

      const getOneSwapActionResult = async (
        swapPro,
        poolsOneSwap,
        tokenIn,
        tokenOut,
        supportLedger,
        swapMode,
        throwNoPoolError,
        amountIn,
        parsedAmountIn
      ) => {
        const { allStablePoolsById, allStablePools } =
          await getAllStablePoolsFromCache();
      
        let supportLedgerRes;
      
        /**
         * for swap pro, we need to calculate the result on tri pool
         * to do price comparison on tri result and ref result
         *
         */
      
        let triTodos;
        let refTodos;
        let pools = poolsOneSwap;
      
        if (isStableToken(tokenIn.id) && isStableToken(tokenOut.id)) {
          pools = pools.concat(
            getStablePoolThisPair({
              tokenInId: tokenIn.id,
              tokenOutId: tokenOut.id,
              stablePools: allStablePools,
            })
          );
        }
      
        /**s
         *  single swap action estimate for support ledger and swap pro mode
         *
         */
        if (supportLedger || swapPro) {
          if (swapMode === SWAP_MODE.STABLE) {
            pools = getStablePoolThisPair({
              tokenInId: tokenIn.id,
              tokenOutId: tokenOut.id,
              stablePools: allStablePools,
            });
          }
          if (pools.length === 0 && supportLedger) {
            throwNoPoolError();
          }
      
          if (pools.length > 0) {
            const bestPricePool =
              pools.length === 1
                ? pools[0]
                : _.maxBy(pools, p => {
                    if (isStablePool(p.id)) {
                      return Number(
                        getStablePoolEstimate({
                          tokenIn,
                          tokenOut,
                          stablePool: allStablePoolsById[p.id][0],
                          stablePoolInfo: allStablePoolsById[p.id][1],
                          amountIn,
                        }).estimate
                      );
                    }
                    return Number(
                      getSinglePoolEstimate(tokenIn, tokenOut, p, parsedAmountIn)
                        .estimate
                    );
                  });
      
            const estimateRes = await getPoolEstimate({
              tokenIn,
              tokenOut,
              amountIn: parsedAmountIn,
              
              Pool: bestPricePool,
            });
      
            const res = [
              {
                ...estimateRes,
                status: PoolMode.PARALLEL,
                routeInputToken: tokenIn.id,
                totalInputAmount: parsedAmountIn,
                pool: {
                  ...bestPricePool,
                  partialAmountIn: parsedAmountIn,
                },
                tokens: [tokenIn, tokenOut],
                inputToken: tokenIn.id,
                outputToken: tokenOut.id,
              },
            ];
      
            supportLedgerRes = res;
          }
      
          // get result on tri pools but just one swap action
          if (swapPro) {
            // find tri pool for this pair
            const triPoolThisPair = pools.find(
              p =>
                p.Dex === "tri" &&
                p.tokenIds &&
                p.tokenIds.includes(tokenIn.id) &&
                p.tokenIds.includes(tokenOut.id)
            );
      
            if (triPoolThisPair) {
              const triPoolEstimateRes = getSinglePoolEstimate(
                tokenIn,
                tokenOut,
                triPoolThisPair,
                parsedAmountIn
              );
      
              triTodos = [
                {
                  ...triPoolEstimateRes,
                  status: PoolMode.PARALLEL,
                  routeInputToken: tokenIn.id,
                  totalInputAmount: parsedAmountIn,
                  pool: {
                    ...triPoolThisPair,
                    partialAmountIn: parsedAmountIn,
                  },
                  tokens: [tokenIn, tokenOut],
                  inputToken: tokenIn.id,
                  outputToken: tokenOut.id,
                },
              ];
              const refPools = pools.filter(p => p.Dex !== "tri");
      
              const refPoolThisPair =
                refPools.length === 1
                  ? refPools[0]
                  : _.maxBy(refPools, p => {
                      if (isStablePool(p.id)) {
                        return Number(
                          getStablePoolEstimate({
                            tokenIn,
                            tokenOut,
                            stablePoolInfo: allStablePoolsById[p.id][1],
                            stablePool: allStablePoolsById[p.id][0],
                            amountIn,
                          }).estimate
                        );
                      } else
                        return Number(
                          getSinglePoolEstimate(tokenIn, tokenOut, p, parsedAmountIn)
                            .estimate
                        );
                    });
      
              if (refPoolThisPair) {
                const refPoolEstimateRes = await getPoolEstimate({
                  tokenIn,
                  tokenOut,
                  amountIn: parsedAmountIn,
                  Pool: refPoolThisPair,
                });
      
                refTodos = [
                  {
                    ...refPoolEstimateRes,
                    status: PoolMode.PARALLEL,
                    routeInputToken: tokenIn.id,
                    totalInputAmount: parsedAmountIn,
                    pool: {
                      ...refPoolThisPair,
                      partialAmountIn: parsedAmountIn,
                    },
                    tokens: [tokenIn, tokenOut],
                    inputToken: tokenIn.id,
                    outputToken: tokenOut.id,
                  },
                ];
              }
            }
          }
        }
      
        return {
          supportLedgerRes,
          triTodos,
          refTodos,
        };
      };
      try{
        console.log(getUserTokens())
        res.status(200).json({getUserTokens})
      }catch(error){
        console.log(error)
        res.status(500).json({error})
      }
}


