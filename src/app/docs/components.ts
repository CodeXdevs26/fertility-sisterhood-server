import { DATE_EXAMPLE, ID_EXAMPLE, ref } from "./helpers.js";

const id = { type: "string", example: ID_EXAMPLE };
const date = { type: "string", format: "date-time", example: DATE_EXAMPLE };

export const ENUMS = {
  UserRole: ["ADMIN", "USER"],
  UserStatus: ["PENDING", "ACTIVE", "BLOCKED", "DELETED"],
  OTPPurpose: ["VERIFY_ACCOUNT", "RESET_PASSWORD"],
  SubscriptionStatus: [
    "INCOMPLETE",
    "INCOMPLETE_EXPIRED",
    "TRIALING",
    "ACTIVE",
    "PAST_DUE",
    "CANCELED",
    "UNPAID",
    "PAUSED",
  ],
  SupportStatus: ["PENDING", "RESOLVED"],
  PhotoMilestone: [
    "CONSULTATION",
    "STIMS",
    "TRIGGER",
    "EGG_RETRIEVAL",
    "OTHER",
  ],
  CostCategory: [
    "CONSULTATION",
    "MEDICATION",
    "MONITORING",
    "EGG_RETRIEVAL",
    "EMBRYO_TRANSFER",
    "LAB_AND_GENETIC_TEST",
    "STORAGE_AND_FREEZING",
    "TRAVEL",
    "DEPOSIT",
    "OTHER",
  ],
  CostType: ["ONE_OFF", "PACKAGE", "DEPOSIT"],
  CostIvfRound: [
    "ROUND_1",
    "ROUND_2",
    "ROUND_3",
    "ROUND_4",
    "ROUND_5",
    "ROUND_6",
    "ROUND_7",
    "ROUND_8",
    "ROUND_9",
    "ROUND_10",
    "UNSURE",
  ],
  ChecklistStatus: ["PENDING", "COMPLETED"],
  ChecklistCategory: [
    "MEDICAL",
    "FINANCIAL",
    "LIFESTYLE",
    "WELLBEING",
    "PARTNER",
    "LOGISTIC",
  ],
  Mood: ["HAPPY", "CALM", "NEUTRAL", "SAD", "ANXIOUS"],
  SymptomName: [
    "BLOATING",
    "FATIGUE",
    "HEADACHE",
    "NAUSEA",
    "BREAST_TENDERNESS",
    "CAMPING",
    "OTHER",
  ],
  NotificationModelType: [
    "ACCOUNT",
    "SUBSCRIPTION",
    "SUPPORT",
    "APPOINTMENT",
    "DIGEST",
    "SYSTEM",
  ],
} as const;

const enumSchemas = Object.fromEntries(
  Object.entries(ENUMS).map(([name, values]) => [
    name,
    { type: "string", enum: [...values] },
  ])
);

const errorResponse = (description: string, message: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: message },
          error: { description: "Error details (shape varies by error type)" },
        },
      },
    },
  },
});

export const components = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description:
        "Access token returned by `POST /auth/login`. Sent as `Authorization: Bearer <token>`.",
    },
  },
  responses: {
    Error400: errorResponse(
      "Bad request / business rule failed",
      "Invalid email or password!"
    ),
    Error401: errorResponse(
      "Missing, invalid or expired token",
      "Unauthorized"
    ),
    Error403: errorResponse(
      "Role not allowed, or premium subscription required",
      "Forbidden!"
    ),
    Error404: errorResponse("Record not found", "Appointment not found"),
    Error409: errorResponse("Conflict", "Record already exists"),
    Error422: errorResponse(
      "Validation error (zod / prisma)",
      "Validation error!"
    ),
    Error500: errorResponse("Unexpected server error", "Something went wrong!"),
  },
  schemas: {
    ...enumSchemas,
    PaginationMeta: {
      type: "object",
      properties: {
        page: { type: "integer", example: 1 },
        limit: { type: "integer", example: 10 },
        total: { type: "integer", example: 42 },
      },
    },
    User: {
      type: "object",
      properties: {
        id,
        email: { type: "string", format: "email", example: "jane@example.com" },
        name: { type: "string", example: "Jane Doe" },
        role: ref("UserRole"),
        status: ref("UserStatus"),
        createdAt: date,
      },
    },
    Profile: {
      type: "object",
      properties: {
        id,
        email: { type: "string", format: "email" },
        name: { type: "string" },
        role: ref("UserRole"),
        status: ref("UserStatus"),
        createdAt: date,
        updatedAt: date,
        isPremiumUser: { type: "boolean", example: false },
      },
    },
    Legal: {
      type: "object",
      properties: {
        id,
        privacyPolicy: { type: "string" },
        termsCondition: { type: "string" },
        aboutUs: { type: "string" },
        updatedAt: date,
      },
    },
    Symptom: {
      type: "object",
      properties: {
        id,
        symptomName: ref("SymptomName"),
        moods: { type: "array", items: ref("Mood") },
        note: { type: "string", nullable: true },
        date,
      },
    },
    Notification: {
      type: "object",
      properties: {
        id,
        message: { type: "string", example: "Appointment tomorrow" },
        description: {
          type: "string",
          nullable: true,
          example: "Dr. Smith at 10:30 AM",
        },
        modelType: ref("NotificationModelType"),
        referenceId: {
          ...id,
          nullable: true,
          description:
            "Id of the related record (appointment, subscription, support) for deep-linking",
        },
        read: { type: "boolean", example: false },
        pushed: {
          type: "boolean",
          example: true,
          description: "Whether the FCM push was accepted",
        },
        createdAt: date,
      },
    },
    Cycle: {
      type: "object",
      properties: {
        id,
        startDate: date,
        cyclePeriod: { type: "integer", nullable: true, example: 10 },
        endDate: { ...date, nullable: true },
        cycleNumber: { type: "integer", example: 1 },
        createdAt: date,
        updatedAt: date,
      },
    },
    Appointment: {
      type: "object",
      properties: {
        id,
        doctor: { type: "string", example: "Dr. Smith" },
        description: { type: "string", nullable: true },
        date,
        time: { type: "string", example: "10:30 AM" },
        createdAt: date,
      },
    },
    Medication: {
      type: "object",
      properties: {
        id,
        name: { type: "string", example: "Gonal-F" },
        dose: { type: "string", example: "150 IU" },
        frequency: { type: "string", example: "Once daily" },
        type: { type: "string", example: "Injection" },
        startDate: date,
        endDate: date,
        createdAt: date,
      },
    },
    MedicationListItem: {
      type: "object",
      description:
        "Item returned by the list endpoint (includes the state for today).",
      properties: {
        id,
        name: { type: "string" },
        dose: { type: "string" },
        frequency: { type: "string" },
        isTakenToday: { type: "boolean", example: false },
      },
    },
    Supplement: {
      type: "object",
      properties: {
        id,
        name: { type: "string", example: "Folic acid" },
        dose: { type: "string", example: "400 mcg" },
        frequency: { type: "string", example: "Once daily" },
        type: { type: "string", example: "Tablet" },
        startDate: date,
        endDate: date,
        createdAt: date,
      },
    },
    SupplementListItem: {
      type: "object",
      properties: {
        id,
        name: { type: "string" },
        dose: { type: "string" },
        frequency: { type: "string" },
        isTakenToday: { type: "boolean", example: false },
      },
    },
    MedicationTakenRecord: {
      type: "object",
      description:
        "Daily intake record. If it was already marked today, the existing record is returned.",
      properties: { id, medicationId: id, date },
    },
    SupplementTakenRecord: {
      type: "object",
      description:
        "Daily intake record. If it was already marked today, the existing record is returned.",
      properties: { id, supplementId: id, date },
    },
    Journal: {
      type: "object",
      properties: {
        id,
        title: { type: "string", example: "Day 3 of stims" },
        content: { type: "string" },
        createdAt: date,
      },
    },
    Checklist: {
      type: "object",
      properties: {
        id,
        title: { type: "string", example: "Book blood test" },
        category: ref("ChecklistCategory"),
        description: { type: "string", nullable: true },
        date,
        status: ref("ChecklistStatus"),
        createdAt: date,
      },
    },
    ChecklistListItem: {
      type: "object",
      properties: {
        id,
        title: { type: "string" },
        status: ref("ChecklistStatus"),
      },
    },
    Cost: {
      type: "object",
      properties: {
        id,
        amount: { type: "number", example: 1250.5 },
        date,
        isPaid: { type: "boolean" },
        ivfRound: ref("CostIvfRound"),
        type: ref("CostType"),
        category: ref("CostCategory"),
        description: { type: "string", nullable: true },
        createdAt: date,
      },
    },
    TestResult: {
      type: "object",
      properties: {
        id,
        category: { type: "string", nullable: true, example: "Hormone" },
        name: { type: "string", example: "AMH" },
        date,
        value: { type: "string", example: "2.1" },
        unit: { type: "string", example: "ng/mL" },
        note: { type: "string", nullable: true },
        createdAt: date,
      },
    },
    Note: {
      type: "object",
      properties: {
        id,
        title: { type: "string" },
        description: { type: "string", nullable: true },
        date,
        tags: { type: "array", items: { type: "string" } },
      },
    },
    Question: {
      type: "object",
      properties: {
        id,
        appointmentId: id,
        text: { type: "string", example: "What is the success rate?" },
        createdAt: date,
      },
    },
    Document: {
      type: "object",
      properties: {
        id,
        date,
        note: { type: "string", nullable: true },
        file: {
          type: "string",
          format: "uri",
          description: "Public URL of the uploaded file",
        },
      },
    },
    Photo: {
      type: "object",
      properties: {
        id,
        caption: { type: "string" },
        milestone: ref("PhotoMilestone"),
        date,
        file: { type: "string", format: "uri" },
        fileSize: { type: "integer", description: "Size in bytes" },
      },
    },
    Support: {
      type: "object",
      properties: {
        id,
        title: { type: "string" },
        description: { type: "string" },
        status: ref("SupportStatus"),
        createdAt: date,
      },
    },
    SubscriptionPlan: {
      type: "object",
      properties: {
        id,
        title: { type: "string", example: "Premium" },
        description: { type: "string" },
        price: { type: "number", example: 9.99, description: "EUR per month" },
        updatedAt: date,
      },
    },
    MySubscription: {
      type: "object",
      nullable: true,
      description: "`null` when the user never started a subscription.",
      properties: {
        status: ref("SubscriptionStatus"),
        isPremium: { type: "boolean" },
        autoRenew: { type: "boolean" },
        endDate: { ...date, nullable: true },
        createdAt: date,
      },
    },
    PurchaseResult: {
      type: "object",
      description: "Values needed by the Stripe PaymentSheet on the client.",
      properties: {
        subscriptionId: { type: "string", example: "sub_1Pxxxx" },
        clientSecret: { type: "string", example: "pi_xxx_secret_xxx" },
        ephemeralKey: { type: "string", example: "ek_test_xxx" },
        customerId: { type: "string", example: "cus_xxx" },
        publishableKey: { type: "string", example: "pk_test_xxx" },
      },
    },
  },
};
