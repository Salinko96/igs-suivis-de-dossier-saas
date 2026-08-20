import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (ctx.user.isActive === false) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Votre compte est désactivé. Veuillez contacter un administrateur IGS.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.isActive === false) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Votre compte est désactivé. Veuillez contacter un administrateur IGS.",
      });
    }

    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const declarantProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.isActive === false) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Votre compte est désactivé. Veuillez contacter un administrateur IGS.",
      });
    }

    if (!["admin", "manager", "declarant"].includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Accès refusé pour ce profil" });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const comptableProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.isActive === false) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Votre compte est désactivé. Veuillez contacter un administrateur IGS.",
      });
    }

    if (!["admin", "manager", "comptable"].includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Accès refusé pour ce profil" });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const internalProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.isActive === false) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Votre compte est désactivé. Veuillez contacter un administrateur IGS.",
      });
    }

    if (!["admin", "manager", "declarant", "comptable"].includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Accès refusé pour ce profil" });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

