import { ForbiddenError } from "@shared/_core/errors";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { getUserForRequest } from "./localAuth";

class SDKServer {
  /**
   * Authenticates a request using the local opaque session created by the
   * self-hosted auth endpoints. The frontend sends it as a Bearer token; the
   * HttpOnly cookie is also supported for same-origin deployments.
   */
  async authenticateRequest(req: Request): Promise<User> {
    const user = await getUserForRequest(req);
    if (!user) throw ForbiddenError("Missing or invalid session");
    return user;
  }
}

export const sdk = new SDKServer();
