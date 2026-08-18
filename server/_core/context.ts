import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }

  // Si aucune session n'est encore enregistrée (premier accès), initialiser par défaut sur le compte Admin IGS
  if (!user) {
    user = (await db.getUserByOpenId("igs_admin_conakry")) || null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
