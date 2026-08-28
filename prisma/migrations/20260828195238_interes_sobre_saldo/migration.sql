-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('CUOTA_FIJA', 'INTERES_SOBRE_SALDO');

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "loanType" "LoanType" NOT NULL DEFAULT 'CUOTA_FIJA',
ADD COLUMN     "outstandingPrincipal" DECIMAL(12,2);
