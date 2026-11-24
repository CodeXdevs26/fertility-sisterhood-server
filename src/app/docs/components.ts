import { DATE_EXAMPLE, ID_EXAMPLE, ref } from "./helpers.js";

const id = { type: "string", example: ID_EXAMPLE };
const date = { type: "string", format: "date-time", example: DATE_EXAMPLE };

export const ENUMS = {
  UserRole: ["ADMIN", "USER"],
  UserStatus: ["PENDING", "ACTIVE", "BLOCKED", "DELETED"],
  OTPPurpose: ["VERIFY_ACCOUNT", "RESET_PASSWORD"],
  SubscriptionStatus: ["ACTIVE", "BILLING_ISSUE", "CANCELLED", "EXPIRED"],
  BillingCycle: ["MONTHLY", "ANNUAL"],
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
    "CRAMPING",
    "OTHER",
  ],
  NotificationModelType: [
    "ACCOUNT",
    "SUBSCRIPTION",
    "SUPPORT",
    "APPOINTMENT",
    "DIGEST",
    "MEDICATION",
    "SYSTEM",
    "NEW_USER",
    "NEW_SUBSCRIPTION",
    "SUBSCRIPTION_CANCELED",
    "PAYMENT_FAILED",
    "NEW_SUPPORT",
  ],
  LoginProvider: ["FACEBOOK", "GOOGLE", "EMAIL"],
  PaymentStatus: ["SUCCEEDED", "FAILED", "REFUNDED"],
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
    Error429: errorResponse(
      "Rate limit exceeded (auth: 20, OTP: 10 requests per 15 minutes per IP; OTP resend: once a minute)",
      "Too many attempts, please try again later!"
    ),
    Error500: errorResponse("Unexpected server error", "Something went wrong!"),
    Error502: errorResponse(
      "Upstream service (RevenueCat) failed",
      "RevenueCat request failed"
    ),
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
        isPremium: {
          type: "boolean",
          example: false,
          description: "Subscription status is ACTIVE",
        },
      },
    },
    Consent: {
      type: "object",
      nullable: true,
      description:
        '"Your consent matters" choices. `null` until the user answers.',
      properties: {
        healthData: {
          type: "boolean",
          example: true,
          description: "Explicit consent to process health data (UK GDPR)",
        },
        healthDataUpdatedAt: {
          ...date,
          description: "When healthData was last given or withdrawn",
        },
        marketing: { type: "boolean", example: false },
        cookies: { type: "boolean", example: true },
      },
    },
    Payment: {
      type: "object",
      properties: {
        id,
        amount: {
          type: "number",
          example: 9.99,
          description: "In the purchase `currency`",
        },
        amountRefunded: { type: "number", example: 0 },
        currency: { type: "string", example: "gbp" },
        amountGbp: {
          type: "number",
          nullable: true,
          example: 9.99,
          description:
            "Converted to GBP (the reporting currency); `null` if the currency could not be converted",
        },
        amountRefundedGbp: { type: "number", nullable: true, example: 0 },
        status: ref("PaymentStatus"),
        store: {
          type: "string",
          nullable: true,
          example: "APP_STORE",
          description:
            "RevenueCat store (APP_STORE, PLAY_STORE, ...), `TEST_API` for test purchases, `STRIPE` for old records",
        },
        productId: {
          type: "string",
          nullable: true,
          example: "premium_monthly",
        },
        environment: {
          type: "string",
          nullable: true,
          enum: ["SANDBOX", "PRODUCTION"],
          description: "Sandbox payments are excluded from revenue stats",
        },
        createdAt: {
          ...date,
          description: "When the transaction was purchased",
        },
        auth: {
          type: "object",
          nullable: true,
          properties: {
            id,
            name: { type: "string", example: "Jane Doe" },
            email: { type: "string", example: "jane@example.com" },
          },
        },
      },
    },
    AppSetting: {
      type: "object",
      properties: {
        supportEmail: { type: "string", example: "support@example.com" },
        supportPhone: { type: "string", example: "+44 20 1234 5678" },
        communityLink: {
          type: "string",
          example: "https://chat.whatsapp.com/abc123",
        },
        updatedAt: date,
      },
    },
    Quote: {
      type: "object",
      properties: {
        id,
        text: {
          type: "string",
          example: "Believe in the power of your body.",
        },
        author: { type: "string", nullable: true, example: null },
        isActive: { type: "boolean", example: true },
        createdAt: date,
      },
    },
    ChecklistTemplateItem: {
      type: "object",
      properties: {
        id,
        category: ref("ChecklistCategory"),
        title: {
          type: "string",
          example: "Book initial fertility consultation",
        },
        order: { type: "integer", example: 1 },
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
        provider: ref("LoginProvider"),
        consent: ref("Consent"),
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
            "Id of the related record for deep-linking (appointment, medication, subscription, support). Admin notifications about a user (new user, subscription, payment failed) carry the user id.",
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
        reminderTimes: {
          type: "array",
          items: { type: "string", example: "08:00" },
          example: ["08:00", "20:00"],
          description:
            "Local times (HH:mm, 24h, user's timezone) for push reminders; sorted, no duplicates",
        },
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
        reminderTimes: {
          type: "array",
          items: { type: "string" },
          example: ["08:00", "20:00"],
        },
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
    Package: {
      type: "object",
      properties: {
        id,
        title: { type: "string", example: "Premium Monthly" },
        billingCycle: ref("BillingCycle"),
        revenueCatProductId: { type: "string", example: "premium_monthly" },
        entitlementId: { type: "string", example: "premium" },
        description: {
          type: "array",
          items: { type: "string" },
          example: ["All trackers", "Morning digest"],
        },
        price: { type: "number", example: 9.99 },
        currency: {
          type: "string",
          example: "gbp",
          description: "ISO currency code of price (lowercase)",
        },
        isDeleted: { type: "boolean", example: false },
        createdAt: date,
        updatedAt: date,
      },
    },
    MySubscription: {
      type: "object",
      nullable: true,
      description: "`null` when the user never had a subscription.",
      properties: {
        status: ref("SubscriptionStatus"),
        isPremium: { type: "boolean", description: "status is `ACTIVE`" },
        autoRenew: {
          type: "boolean",
          description: "`false` once auto-renew is turned off in the store",
        },
        endDate: {
          ...date,
          nullable: true,
          description: "Current period end; `null` for lifetime",
        },
        store: {
          type: "string",
          nullable: true,
          example: "APP_STORE",
          description: "`TEST_API` for test purchases",
        },
        managementUrl: {
          type: "string",
          nullable: true,
          example: "https://apps.apple.com/account/subscriptions",
          description: "Open this to cancel or change the plan in the store",
        },
        package: {
          type: "object",
          nullable: true,
          properties: {
            id,
            title: { type: "string", example: "Premium Monthly" },
            billingCycle: ref("BillingCycle"),
          },
        },
        createdAt: date,
      },
    },
  },
};
