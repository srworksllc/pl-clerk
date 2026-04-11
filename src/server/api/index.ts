import { Hono } from "hono";
import { logger } from "hono/logger";
import { statementsRoute } from "./routes/statements";
import { transactionsRoute } from "./routes/transactions";
import { categoriesRoute } from "./routes/categories";
import { vendorsRoute } from "./routes/vendors";
import { reportsRoute } from "./routes/reports";
import { shareRoute } from "./routes/share";
import { aiRoute } from "./routes/ai";
import { authMiddleware } from "./middleware";

const app = new Hono().basePath("/api");

app.use("*", logger());

// Public routes
app.route("/share", shareRoute);

// Protected routes
app.use("*", authMiddleware);
app.route("/statements", statementsRoute);
app.route("/transactions", transactionsRoute);
app.route("/categories", categoriesRoute);
app.route("/vendors", vendorsRoute);
app.route("/reports", reportsRoute);
app.route("/ai", aiRoute);

export default app;
export type AppType = typeof app;
