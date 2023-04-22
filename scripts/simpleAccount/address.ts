import { Presets } from "userop";
// @ts-ignore
import config from "../../config.json";
import { abi as BaseAccountFactoryAbi } from "../../abis/BaseAccountFactory.json";
import { Contract } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";

// yarn run simpleAccount address -o 0xf0d5D3FcBFc0009121A630EC8AB67e012117f40c -s 0xa

export default async function main(o: string, s: string) {
  const provider = new JsonRpcProvider(config.rpcUrl);
  const factory = new Contract(
    config.simpleAccountFactory,
    BaseAccountFactoryAbi,
    provider
  );

  const address = await factory.getAddress(o, s);

  console.log(`SimpleAccount address: ${address}`);
}
