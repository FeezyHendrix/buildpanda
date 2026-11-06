import type { FastifyPluginAsync } from "fastify";
import {
  adminMetricsRepository,
  priorRange,
  deltaPct,
  funnelConversions,
  type MetricRange,
} from "./metrics-repository.ts";
import { summarizeSignupJourneys } from "./signup-journey.ts";

const rangeQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    from: { type: "string", maxLength: 40 },
    to: { type: "string", maxLength: 40 },
  },
} as const;

function toRange(query: { from?: string; to?: string }): MetricRange {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

// Registered inside adminRoutes, so its admin gate and audit hooks apply here.
const adminMetricsRoutes: FastifyPluginAsync = async (fastify) => {
  const metrics = adminMetricsRepository(fastify.db);

  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    "/admin/metrics/overview",
    { schema: { querystring: rangeQuery } },
    async (request) => {
      const range = toRange(request.query);
      const prior = priorRange(range);
      const dayMs = 24 * 60 * 60 * 1000;
      const now = new Date();
      const [
        signups,
        signupsPrior,
        signupSeries,
        activeSeries,
        wau,
        mau,
        dau,
        tokenSeries,
        jobHealth,
        value,
      ] = await Promise.all([
        metrics.totalSignups(range),
        metrics.totalSignups(prior),
        metrics.signupSeries(range),
        metrics.activeUserSeries(range),
        metrics.activeUsers(new Date(now.getTime() - 7 * dayMs), now),
        metrics.activeUsers(new Date(now.getTime() - 30 * dayMs), now),
        metrics.activeUsers(new Date(now.getTime() - dayMs), now),
        metrics.aiTokenSeries(range),
        metrics.aiJobHealth(range),
        metrics.valueTracked(),
      ]);
      const totalTokens = tokenSeries.reduce((s, p) => s + p.tokensIn + p.tokensOut, 0);
      const totalCost = tokenSeries.reduce((s, p) => s + p.costUsd, 0);
      const jobTotals = jobHealth.reduce(
        (acc, j) => ({ total: acc.total + j.total, completed: acc.completed + j.completed }),
        { total: 0, completed: 0 },
      );
      return {
        asOf: new Date().toISOString(),
        range: { from: range.from.toISOString(), to: range.to.toISOString() },
        signups: { value: signups, deltaPct: deltaPct(signups, signupsPrior), series: signupSeries },
        activeUsers: { dau, wau, mau, stickiness: mau > 0 ? (dau / mau) * 100 : 0, series: activeSeries },
        aiJobs: {
          total: jobTotals.total,
          successRate: jobTotals.total > 0 ? (jobTotals.completed / jobTotals.total) * 100 : 0,
        },
        aiSpend: { costUsd: totalCost, tokens: totalTokens, series: tokenSeries },
        valueTracked: value,
      };
    },
  );

  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    "/admin/metrics/growth",
    { schema: { querystring: rangeQuery } },
    async (request) => {
      const range = toRange(request.query);
      const [signupSeries, funnelSteps] = await Promise.all([
        metrics.signupSeries(range),
        metrics.activationFunnel(range),
      ]);
      return {
        asOf: new Date().toISOString(),
        signupSeries,
        funnel: funnelConversions(funnelSteps),
      };
    },
  );

  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    "/admin/metrics/signup-journey",
    { schema: { querystring: rangeQuery } },
    async (request) => {
      const summary = summarizeSignupJourneys(await metrics.signupJourneys(toRange(request.query)));
      return { asOf: new Date().toISOString(), ...summary, funnel: funnelConversions(summary.funnel) };
    },
  );

  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    "/admin/metrics/engagement",
    { schema: { querystring: rangeQuery } },
    async (request) => {
      const range = toRange(request.query);
      const dayMs = 24 * 60 * 60 * 1000;
      const now = new Date();
      const [activeSeries, dau, wau, mau] = await Promise.all([
        metrics.activeUserSeries(range),
        metrics.activeUsers(new Date(now.getTime() - dayMs), now),
        metrics.activeUsers(new Date(now.getTime() - 7 * dayMs), now),
        metrics.activeUsers(new Date(now.getTime() - 30 * dayMs), now),
      ]);
      return {
        asOf: new Date().toISOString(),
        activeSeries,
        dau,
        wau,
        mau,
        stickiness: mau > 0 ? (dau / mau) * 100 : 0,
      };
    },
  );

  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    "/admin/metrics/ai-ops",
    { schema: { querystring: rangeQuery } },
    async (request) => {
      const range = toRange(request.query);
      const [tokenSeries, costByOrg, jobHealth, uncosted] = await Promise.all([
        metrics.aiTokenSeries(range),
        metrics.aiCostByOrg(range),
        metrics.aiJobHealth(range),
        metrics.uncostedTokens(range),
      ]);
      const totalTokens = tokenSeries.reduce((s, p) => s + p.tokensIn + p.tokensOut, 0);
      const totalCost = tokenSeries.reduce((s, p) => s + p.costUsd, 0);
      return {
        asOf: new Date().toISOString(),
        platform: {
          totalTokens,
          totalCostUsd: totalCost,
          uncostedTokens: uncosted.tokens,
          unpricedModels: uncosted.models,
          series: tokenSeries,
        },
        costByOrg,
        jobHealth,
      };
    },
  );
};

export default adminMetricsRoutes;
