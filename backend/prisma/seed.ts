import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@moneymentor.local";
  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: { email, name: "Sample Account", isSample: true },
  });

  await prisma.incomeSource.create({
    data: { userId: user.id, label: "Salary", amount: 35000, frequency: "monthly" },
  });

  await prisma.expense.createMany({
    data: [
      { userId: user.id, label: "Rent", category: "housing", amount: 10000, isRecurring: true, dueDay: 1 },
      { userId: user.id, label: "Food", category: "food", amount: 5000, isRecurring: true, dueDay: 5 },
      { userId: user.id, label: "Transport", category: "transport", amount: 2500, isRecurring: true, dueDay: 5 },
      { userId: user.id, label: "Electricity", category: "utilities", amount: 1500, isRecurring: true, dueDay: 10 },
      { userId: user.id, label: "Internet", category: "utilities", amount: 800, isRecurring: true, dueDay: 10 },
      { userId: user.id, label: "Netflix", category: "subscription", amount: 649, isRecurring: true, dueDay: 15 },
      { userId: user.id, label: "Spotify", category: "subscription", amount: 119, isRecurring: true, dueDay: 15 },
      { userId: user.id, label: "Cloud storage", category: "subscription", amount: 130, isRecurring: true, dueDay: 15 },
      { userId: user.id, label: "Gym", category: "subscription", amount: 1000, isRecurring: true, dueDay: 15 },
    ],
  });

  await prisma.loan.create({
    data: {
      userId: user.id,
      label: "Personal EMI",
      principal: 84000,
      emiAmount: 7000,
      interestRate: 12,
      remainingMonths: 12,
      dueDay: 3,
    },
  });

  await prisma.savingsAccount.create({
    data: { userId: user.id, label: "Savings", balance: 20000, type: "general" },
  });

  console.log(`Seeded demo user ${user.email} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
