import { ethers } from "ethers";
import { ERC20_ABI } from "../../src";
// @ts-ignore
import config from "../../config.json";
import { Client, Presets, UserOperationBuilder } from "userop";
import { abi as TestERC20Abi } from "../../abis/TestERC20.json";
import { abi as baseAccountContractAbi } from "../../abis/BaseAccount.json";
import { abi as BaseAccountFactoryAbi } from "../../abis/BaseAccountFactory.json";
import { parseEther, hexConcat } from "ethers/lib/utils";
import {
  Interface,
  keccak256,
  defaultAbiCoder,
  arrayify,
} from "ethers/lib/utils";
import { Wallet } from "ethers";
import { UserOperationStruct } from "userop/dist/typechain/EntryPoint";
import * as typ from "./solidityTypes";
import {
  ecsign,
  toRpcSig,
  keccak256 as keccak256_buffer,
} from "ethereumjs-util";

export interface UserOperation {
  sender: typ.address;
  nonce: typ.uint256;
  initCode: typ.bytes;
  callData: typ.bytes;
  callGasLimit: typ.uint256;
  verificationGasLimit: typ.uint256;
  preVerificationGas: typ.uint256;
  maxFeePerGas: typ.uint256;
  maxPriorityFeePerGas: typ.uint256;
  paymasterAndData: typ.bytes;
  signature: typ.bytes;
}

//get interface of baseAccountFactory
const baseAccountFactory = new Interface(BaseAccountFactoryAbi);

function packUserOp(op: UserOperation, forSignature = true): string {
  if (forSignature) {
    return defaultAbiCoder.encode(
      [
        "address",
        "uint256",
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes32",
      ],
      [
        op.sender,
        op.nonce,
        keccak256(op.initCode),
        keccak256(op.callData),
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        keccak256(op.paymasterAndData),
      ]
    );
  } else {
    // for the purpose of calculating gas cost encode also signature (and no keccak of bytes)
    return defaultAbiCoder.encode(
      [
        "address",
        "uint256",
        "bytes",
        "bytes",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes",
        "bytes",
      ],
      [
        op.sender,
        op.nonce,
        op.initCode,
        op.callData,
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        op.paymasterAndData,
        op.signature,
      ]
    );
  }
}

function getUserOpHash(
  op: UserOperation,
  entryPoint: string,
  chainId: number
): string {
  const userOpHash = keccak256(packUserOp(op, true));
  const enc = defaultAbiCoder.encode(
    ["bytes32", "address", "uint256"],
    [userOpHash, entryPoint, chainId]
  );
  return keccak256(enc);
}

export function signUserOp(
  op: UserOperation,
  signer: Wallet,
  entryPoint: string,
  chainId: number
): string {
  const message = getUserOpHash(op, entryPoint, chainId);
  const msg1 = Buffer.concat([
    Buffer.from("\x19Ethereum Signed Message:\n32", "ascii"),
    Buffer.from(arrayify(message)),
  ]);

  const sig = ecsign(
    keccak256_buffer(msg1),
    Buffer.from(arrayify(signer.privateKey))
  );
  // that's equivalent of:  await signer.signMessage(message);
  // (but without "async"
  const signedMessage1 = toRpcSig(sig.v, sig.r, sig.s);
  return signedMessage1;
}

// 0xE5e0d68989E4C60dF4239E551cd109d7FAc3b433
// yarn run simpleAccount erc20Transfer --sender 0xed3056d496EAFf5FA54f03c3D43d82E405fa3bbA --owner 0xf0d5D3FcBFc0009121A630EC8AB67e012117f40c --salt "0xa" --token 0xE5e0d68989E4C60dF4239E551cd109d7FAc3b433 --to 0xf0d5D3FcBFc0009121A630EC8AB67e012117f40c --amount 1

export default async function main(
  s: string,
  o: string,
  st: string,
  tkn: string,
  t: string,
  amt: string,
  withPM: boolean
) {
  const initCode = hexConcat([
    config.simpleAccountFactory,
    baseAccountFactory.encodeFunctionData("createAccount", [o, st]),
  ]);

  let builder = new UserOperationBuilder();
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  let wallet = new ethers.Wallet(config.signingKey);
  builder = builder
    .setSender(s)
    .setInitCode(initCode)
    .useMiddleware(Presets.Middleware.estimateUserOperationGas(provider))
    .useMiddleware(Presets.Middleware.getGasPrice(provider));
  // .useMiddleware(Presets.Middleware.EOASignature(wallet))

  const client = await Client.init(config.rpcUrl, config.entryPoint);

  //get chainId from provider
  const chainId = await provider
    .getNetwork()
    .then((network) => network.chainId);

  const token = ethers.utils.getAddress(tkn);
  const to = ethers.utils.getAddress(t);
  const erc20 = new ethers.Contract(token, ERC20_ABI, provider);
  const [symbol, decimals] = await Promise.all([
    erc20.symbol(),
    erc20.decimals(),
  ]);
  const amount = ethers.utils.parseUnits(amt, decimals);
  console.log(`Transferring ${amt} ${symbol}...`);

  //get interface of the token
  const testToken = new ethers.Contract(token, TestERC20Abi, provider);

  let callData = testToken.interface.encodeFunctionData("transfer", [
    to,
    amount,
  ]);

  const baseAccountContract = new ethers.Contract(
    s,
    baseAccountContractAbi,
    provider
  );

  callData = await baseAccountContract.interface.encodeFunctionData("execute", [
    testToken.address,
    0,
    callData,
  ]);

  builder = builder.setCallData(callData);

  const op = builder.getOp();

  // const op = await builder.buildOp(config.entryPoint, chainId);

  // const userOp = await client.buildUserOperation(builder);

  builder = builder.setSignature(
    signUserOp(op, wallet, config.entryPoint, chainId)
  );

  console.log(builder);

  // 500
  const f = await builder.buildOp(config.entryPoint, chainId);

  // 500
  // const userOp = await builder.buildOp(config.entryPoint, chainId);

  // console.log(f);

  // const userOp = await client.buildUserOperation(builder);

  // console.log(userOp);

  // builder.

  // const userOp = await builder.buildOp(config.entryPoint, chainId);

  // console.log(chainId);

  // const userOp = await client.buildUserOperation(builder);
  // console.log("Signed UserOperation:", userOp);
  //
  // const res = await client.sendUserOperation(builder);

  // console.log(`UserOpHash: ${res.userOpHash}`);

  // console.log("Waiting for transaction...");
  // const ev = await res.wait();
  // console.log(`Transaction hash: ${ev?.transactionHash ?? null}`);
}
