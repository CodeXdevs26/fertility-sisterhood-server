import fs from "fs/promises";
import axios from "axios";
import config from "../config/index.js";

type Replacements = Record<string, string | number>;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Fills `{{placeholder}}` values (HTML-escaped) and POSTs the email to
 * SEND_EMAIL_URL. Never throws: callers fire and forget, and a rejection
 * here used to crash the process via unhandledRejection.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  templatePath: string,
  replacements: Replacements
) => {
  try {
    if (!config.email.emailSendingApi) {
      console.error("SEND_EMAIL_URL is not set; email not sent:", subject);
      return;
    }
    const template = await fs.readFile(templatePath, "utf8");
    const values: Replacements = {
      ...replacements,
      year: new Date().getFullYear(),
    };
    // replacer function: `$&`-style patterns in values are not interpreted
    const html = template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
      key in values ? escapeHtml(String(values[key])) : match
    );

    await axios.post(config.email.emailSendingApi, { to, subject, html });
  } catch (error) {
    console.error(
      `Failed to send email "${subject}":`,
      error instanceof Error ? error.message : error
    );
  }
};
