import { obj, optStr } from "../../docs/fields.js";
import {
  idParam,
  jsonBody,
  ok,
  op,
  paged,
  pageParams,
  ref,
} from "../../docs/helpers.js";

const tag = "Notifications";

const countData = {
  type: "object",
  properties: { count: { type: "integer", example: 3 } },
};

export const notificationSwagger = {
  tag: {
    name: tag,
    description:
      "In-app notifications. The same notification is also sent as an FCM push when the user has an `fcmToken`.",
  },
  paths: {
    "/notifications/dummy": {
      post: op({
        tag,
        summary: "Create a dummy notification (testing)",
        description:
          "Creates a `SYSTEM` notification for yourself and tries to push it. `pushed` in the response tells whether FCM accepted it. Disabled (404) in production.",
        access: "any",
        requestBody: jsonBody(
          obj({
            message: optStr("Test notification"),
            description: optStr("This is a test push notification."),
          }),
          false
        ),
        responses: ok(
          "Notification created successfully!",
          ref("Notification"),
          201
        ),
        errors: [404],
      }),
    },
    "/notifications": {
      get: op({
        tag,
        summary: "List my notifications",
        description:
          "Newest first. `meta.unreadCount` is the unread badge count. Listing does not mark anything as read. Admins get only their own notifications (types NEW_USER, NEW_SUBSCRIPTION, SUBSCRIPTION_CANCELED, PAYMENT_FAILED, NEW_SUPPORT; in-app only, no push).",
        access: "any",
        parameters: pageParams,
        responses: ok(
          "Notifications fetched successfully!",
          paged("notifications", ref("Notification"))
        ),
      }),
      delete: op({
        tag,
        summary: "Clear all my notifications",
        access: "any",
        responses: ok("All notifications cleared!", countData),
      }),
    },
    "/notifications/read-all": {
      patch: op({
        tag,
        summary: "Mark all my notifications as read",
        access: "any",
        responses: ok("All notifications marked as read!", countData),
      }),
    },
    "/notifications/{id}/read": {
      patch: op({
        tag,
        summary: "Mark one notification as read",
        access: "any",
        parameters: [idParam()],
        responses: ok("Notification marked as read!", ref("Notification")),
        errors: [404],
      }),
    },
    "/notifications/{id}": {
      delete: op({
        tag,
        summary: "Delete a notification",
        access: "any",
        parameters: [idParam()],
        responses: ok(
          "Notification deleted successfully!",
          ref("Notification")
        ),
        errors: [404],
      }),
    },
  },
};
