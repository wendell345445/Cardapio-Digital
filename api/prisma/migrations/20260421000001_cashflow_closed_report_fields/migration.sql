-- CashFlow: persist closing report (A-078/A-081)
ALTER TABLE "CashFlow" ADD COLUMN "countedAmount" DOUBLE PRECISION;
ALTER TABLE "CashFlow" ADD COLUMN "closedDifference" DOUBLE PRECISION;
ALTER TABLE "CashFlow" ADD COLUMN "closedJustification" TEXT;
