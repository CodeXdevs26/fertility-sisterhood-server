import { ChecklistCategory } from "@prisma/client";
import prisma from "./app/utils/prisma.js";

// Default pre-treatment IVF checklist. Runs only when the collection is empty,
// so admin edits are never overwritten. Keep in sync with the Figma design.
const ITEMS: Record<ChecklistCategory, string[]> = {
  MEDICAL: [
    "Book initial fertility consultation",
    "Complete blood tests (AMH, FSH, thyroid)",
    "Pelvic ultrasound / antral follicle count",
    "Partner semen analysis",
    "Infectious disease screening",
    "Review current medications with your doctor",
    "Start folic acid / prenatal vitamins",
  ],
  FINANCIAL: [
    "Get a full cost breakdown from the clinic",
    "Check NHS funding eligibility",
    "Check insurance or employer benefits",
    "Set a treatment budget",
    "Plan for medication and extra costs",
  ],
  LIFESTYLE: [
    "Cut down on alcohol and caffeine",
    "Stop smoking",
    "Aim for a healthy weight",
    "Keep a regular sleep routine",
    "Add gentle exercise to your week",
  ],
  WELLBEING: [
    "Consider fertility counselling",
    "Find a support group or community",
    "Plan stress-relief activities",
    "Decide who you will tell about treatment",
  ],
  PARTNER: [
    "Discuss expectations and plans together",
    "Attend appointments together where possible",
    "Agree how to share decisions and costs",
    "Sign clinic consent forms together",
  ],
  LOGISTIC: [
    "Plan time off work for appointments",
    "Arrange travel to and from the clinic",
    "Set up medication storage at home",
    "Add appointments to your calendar",
    "Prepare a bag for egg retrieval day",
  ],
};

const seed = async () => {
  try {
    const existing = await prisma.checklistTemplate.count();
    if (existing)
      return console.log(`Checklist template already has ${existing} items`);

    const data = Object.entries(ITEMS).flatMap(([category, titles]) =>
      titles.map((title, index) => ({
        category: category as ChecklistCategory,
        title,
        order: index + 1,
      }))
    );
    await prisma.checklistTemplate.createMany({ data });
    console.log(`Seeded ${data.length} checklist template items`);
  } catch (error) {
    console.log(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

seed();
