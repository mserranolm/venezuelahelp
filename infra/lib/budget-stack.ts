import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CfnBudget } from "aws-cdk-lib/aws-budgets";

export interface BudgetStackProps extends StackProps {
  /** Email that receives the cost alerts. */
  alertEmail: string;
  /** Monthly budget ceiling in USD (default: 10). */
  monthlyLimitUsd?: number;
}

/**
 * The circuit breaker for a self-funded project: a monthly AWS cost budget that
 * emails the owner before the bill hurts. Notifies on actual spend at 50/80/100%
 * and on a forecasted 100% overrun, so a runaway cost is caught early.
 */
export class BudgetStack extends Stack {
  constructor(scope: Construct, id: string, props: BudgetStackProps) {
    super(scope, id, props);

    const amount = props.monthlyLimitUsd ?? 10;
    const subscribers = [
      { subscriptionType: "EMAIL", address: props.alertEmail },
    ];
    const actualThresholds = [50, 80, 100];

    new CfnBudget(this, "MonthlyCostBudget", {
      budget: {
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount, unit: "USD" },
      },
      notificationsWithSubscribers: [
        ...actualThresholds.map((threshold) => ({
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold,
          },
          subscribers,
        })),
        {
          notification: {
            notificationType: "FORECASTED",
            comparisonOperator: "GREATER_THAN",
            threshold: 100,
          },
          subscribers,
        },
      ],
    });
  }
}
