import { describe, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { BudgetStack } from "../budget-stack";

function template(alertEmail = "ops@vh.org", monthlyLimitUsd?: number) {
  const app = new App();
  const stack = new BudgetStack(app, "Budget", {
    alertEmail,
    monthlyLimitUsd,
  });
  return Template.fromStack(stack);
}

describe("BudgetStack", () => {
  it("creates a monthly COST budget with the configured USD limit", () => {
    template("ops@vh.org", 10).hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({
        BudgetType: "COST",
        TimeUnit: "MONTHLY",
        BudgetLimit: { Amount: 10, Unit: "USD" },
      }),
    });
  });

  it("defaults to a $10 monthly limit when none is given", () => {
    template("ops@vh.org").hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({ BudgetLimit: { Amount: 10, Unit: "USD" } }),
    });
  });

  it("emails the alert address at 100% actual spend", () => {
    template("ops@vh.org", 10).hasResourceProperties("AWS::Budgets::Budget", {
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Notification: Match.objectLike({
            NotificationType: "ACTUAL",
            ComparisonOperator: "GREATER_THAN",
            Threshold: 100,
          }),
          Subscribers: Match.arrayWith([
            Match.objectLike({
              SubscriptionType: "EMAIL",
              Address: "ops@vh.org",
            }),
          ]),
        }),
      ]),
    });
  });

  it("also warns on a forecasted 100% overrun", () => {
    template("ops@vh.org", 10).hasResourceProperties("AWS::Budgets::Budget", {
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Notification: Match.objectLike({
            NotificationType: "FORECASTED",
            Threshold: 100,
          }),
        }),
      ]),
    });
  });
});
