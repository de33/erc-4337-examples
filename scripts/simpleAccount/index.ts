#!/usr/bin/env node
import { Command } from "commander";
import address from "./address";
import transfer from "./transfer";
import erc20Transfer from "./erc20Transfer";
import erc20Approve from "./erc20Approve";
import batchErc20Transfer from "./batchErc20Transfer";

const program = new Command();

program
  .name("ERC-4337 SimpleAccount")
  .description(
    "A collection of example scripts for working with ERC-4337 SimpleAccount.sol"
  )
  .version("0.1.0");

program
  .command("address")
  .description("Generate a counterfactual address.")
  .requiredOption("-o, --owner <address>", "The owner")
  .requiredOption("-s, --salt <uint256>", "The salt")
  .action(async (opts) => address(opts.owner, opts.salt));
program
  .command("transfer")
  .description("Transfer ETH")
  .option("-pm, --withPaymaster", "Use a paymaster for this transaction")
  .requiredOption("-t, --to <address>", "The recipient address")
  .requiredOption("-amt, --amount <eth>", "Amount in ETH to transfer")
  .action(async (opts) =>
    transfer(opts.to, opts.amount, Boolean(opts.withPaymaster))
  );

program
  .command("erc20Transfer")
  .description("Transfer ERC-20 token")
  .option("-pm, --withPaymaster", "Use a paymaster for this transaction")
  .requiredOption("-s, --sender <address>", "The sender address")
  .requiredOption("-o, --owner <address>", "The owner address")
  .requiredOption("-st, --salt <uint256>", "The salt")
  .requiredOption("-tkn, --token <address>", "The token address")
  .requiredOption("-t, --to <address>", "The recipient address")
  .requiredOption("-amt, --amount <decimal>", "Amount of the token to transfer")
  .action(async (opts) =>
    erc20Transfer(
      opts.sender,
      opts.owner,
      opts.salt,
      opts.token,
      opts.to,
      opts.amount,
      Boolean(opts.withPaymaster)
    )
  );

program
  .command("erc20Approve")
  .description("Approve spender for ERC-20 token")
  .option("-pm, --withPaymaster", "Use a paymaster for this transaction")
  .requiredOption("-tkn, --token <address>", "The token address")
  .requiredOption("-s, --spender <address>", "The spender address")
  .requiredOption("-amt, --amount <decimal>", "Amount of the token to transfer")
  .action(async (opts) =>
    erc20Approve(
      opts.token,
      opts.spender,
      opts.amount,
      Boolean(opts.withPaymaster)
    )
  );

program
  .command("batchErc20Transfer")
  .description("Batch transfer ERC-20 token")
  .option("-pm, --withPaymaster", "Use a paymaster for this transaction")
  .requiredOption("-tkn, --token <address>", "The token address")
  .requiredOption(
    "-t, --to <addresses>",
    "Comma separated list of recipient addresses"
  )
  .requiredOption("-amt, --amount <decimal>", "Amount of the token to transfer")
  .action(async (opts) =>
    batchErc20Transfer(
      opts.token,
      opts.to.split(","),
      opts.amount,
      Boolean(opts.withPaymaster)
    )
  );

program.parse();
