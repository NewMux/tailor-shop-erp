import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { erpRouter } from "./erp";
import { posRouter } from "./pos";

// Registration, login, logout, and password recovery are exposed by the
// standalone local auth routes. This tRPC procedure reports the synced
// app-level user profile to the authenticated ERP client.
const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
});

export const appRouter = router({ system: systemRouter, auth: authRouter, erp: erpRouter, pos: posRouter });
export type AppRouter = typeof appRouter;
